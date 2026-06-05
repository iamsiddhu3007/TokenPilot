// xtrace.js — the memory layer. Agents WRITE facts/episodes about ticket costs
// and routing decisions to XTrace, and READ them back to ground estimates;
// reconcile() records contradictions (the demo kicker).
//
// REAL mode: when XTRACE_API_KEY + XTRACE_ORG_ID are set, writes ingest into the
// XTrace Memory API (@xtraceai/memory) and searches hit XTrace's vector recall.
// A small local mirror is kept alongside so the app's deterministic key/value
// estimate-blending and the "version history" UI panel keep working.

import 'dotenv/config';
import { MemoryClient } from '@xtraceai/memory';

const HAS_XTRACE = !!process.env.XTRACE_API_KEY && !!process.env.XTRACE_ORG_ID;
const USER_ID = 'tokenpilot';
const CONV_ID = 'tokenpilot-backlog';
const APP_ID = 'tokenpilot';

let _client = null;
function client() {
  if (!_client && HAS_XTRACE) {
    _client = new MemoryClient({
      apiKey: process.env.XTRACE_API_KEY,
      orgId: process.env.XTRACE_ORG_ID,
      ...(process.env.XTRACE_ENDPOINT ? { baseUrl: process.env.XTRACE_ENDPOINT } : {}),
    });
  }
  return _client;
}

// Local mirror: powers the key/value estimate blending + the beliefs/version UI.
const _facts = []; // { id, text, key, value, supersededBy, ts }
const _ingestedKeys = new Set(); // dedupe XTrace ingests so /board doesn't spam

// fire-and-forget ingest into XTrace (never blocks or crashes the request)
function ingestToXtrace(text, key) {
  if (!HAS_XTRACE) return;
  const episodic = key && key.startsWith('episode:');
  if (!episodic && key && _ingestedKeys.has(key)) return; // already captured this fact
  if (key) _ingestedKeys.add(key);
  Promise.resolve()
    .then(() => client().memories.ingest({
      messages: [{ role: 'user', content: text }],
      user_id: USER_ID,
      conv_id: CONV_ID,
      app_id: APP_ID,
    }))
    .catch((e) => console.warn('[xtrace] ingest failed:', e?.message || e));
}

/**
 * writeMemory — store a durable fact (locally + into XTrace).
 * @param fact { text, key?, value? }
 */
export async function writeMemory(fact) {
  const entry = {
    id: `mem-${_facts.length + 1}`,
    text: fact.text,
    key: fact.key || null,
    value: fact.value ?? null,
    supersededBy: null,
    ts: Date.now(),
  };
  _facts.push(entry);
  ingestToXtrace(entry.text, entry.key);
  return entry;
}

/**
 * searchMemory — retrieve relevant facts. Returns the local key/value facts
 * (which carry the structured `value` the estimator blends on) merged with
 * XTrace's real vector recall.
 */
export async function searchMemory(query) {
  const q = (query || '').toLowerCase();
  const local = _facts
    .filter((f) => !f.supersededBy)
    .filter((f) => f.text.toLowerCase().includes(q) || (f.key && q.includes(f.key.toLowerCase())));
  if (!HAS_XTRACE) return local;
  try {
    const res = await client().memories.search({ query, app_id: APP_ID, limit: 8 });
    const remote = (res?.data || []).map((m) => ({
      id: m.id, text: m.text, key: null, value: null, type: m.type, source: 'xtrace',
    }));
    // de-dupe by text so a locally-mirrored fact isn't shown twice
    const seen = new Set(local.map((f) => f.text));
    return [...local, ...remote.filter((r) => !seen.has(r.text))];
  } catch (e) {
    console.warn('[xtrace] search failed → local:', e?.message || e);
    return local;
  }
}

/**
 * reconcile — new info contradicts an old belief. Supersede the old locally and
 * ingest the correction into XTrace (which auto-revises contradicted memories).
 */
export async function reconcile(key, newValue, text) {
  const old = _facts.find((f) => f.key === key && !f.supersededBy);
  const updated = await writeMemory({ text, key, value: newValue });
  if (old) old.supersededBy = updated.id;
  return { superseded: old || null, current: updated };
}

/**
 * seedTeamFacts — teach XTrace the roster as durable personal facts (skills,
 * role, budget) so the agent can RECALL who's best for a ticket. Idempotent:
 * skips if the roster is already remembered. Called once on boot.
 */
export async function seedTeamFacts(members) {
  if (!HAS_XTRACE || !members?.length) return { seeded: 0 };
  try {
    const existing = await client().memories.search({ query: 'team engineer skilled budget', app_id: APP_ID, limit: 1 });
    if ((existing?.data || []).length) return { seeded: 0, skipped: true };
  } catch { /* fall through and seed */ }
  let seeded = 0;
  for (const m of members) {
    const content = `My name is ${m.name}. I am a ${m.role} engineer. I am skilled at ${(m.skills || []).join(', ')}. My weekly AI budget is $${m.weeklyBudgetUSD}.`;
    try {
      await client().memories.ingest({ messages: [{ role: 'user', content }], user_id: m.id, conv_id: 'roster', app_id: APP_ID });
      seeded++;
    } catch (e) { console.warn('[xtrace] seed', m.id, e?.message || e); }
  }
  return { seeded };
}

export function xtraceStatus() {
  return HAS_XTRACE ? 'connected' : 'in-memory-fallback';
}

// Expose raw history for the UI "agent beliefs / version history" panel.
export function _allFacts() {
  return _facts;
}
