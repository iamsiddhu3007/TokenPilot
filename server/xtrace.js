// xtrace.js — the memory layer. Stores facts/episodes about ticket costs and
// routing decisions, and RECONCILES contradictions (the demo kicker).
//
// Step 2 task: wire writeMemory/searchMemory to the real XTrace Memory API
// (docs.mem.xtrace.ai). Step 6: wire reconcile() to XTrace's supersede flow.
// Keep signatures identical — the fallback lets everything run meanwhile.

import 'dotenv/config';

const HAS_XTRACE = !!process.env.XTRACE_API_KEY;

// In-memory fallback memory store
const _facts = []; // { id, text, key, value, supersededBy, ts }

/**
 * writeMemory — store a durable fact.
 * @param fact { text, key?, value? }  key/value let us look up structured facts
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

  if (!HAS_XTRACE) {
    _facts.push(entry);
    return entry;
  }
  // TODO (Step 2): POST to XTrace memory endpoint; return its id.
  _facts.push(entry);
  return entry;
}

/**
 * searchMemory — retrieve relevant, NON-superseded facts.
 * @param query string
 */
export async function searchMemory(query) {
  if (!HAS_XTRACE) {
    const q = query.toLowerCase();
    return _facts
      .filter((f) => !f.supersededBy)
      .filter((f) => f.text.toLowerCase().includes(q) || (f.key && q.includes(f.key.toLowerCase())));
  }
  // TODO (Step 2): query XTrace memory search; return matching facts.
  return _facts.filter((f) => !f.supersededBy);
}

/**
 * reconcile — new info contradicts an old belief. Supersede the old, keep history.
 * This is the standout XTrace behavior judges reward.
 * @param key       structured key, e.g. "route:type=docs"
 * @param newValue  the corrected value, e.g. "cheap"
 * @param text      human-readable new fact
 */
export async function reconcile(key, newValue, text) {
  const old = _facts.find((f) => f.key === key && !f.supersededBy);
  const updated = await writeMemory({ text, key, value: newValue });
  if (old) old.supersededBy = updated.id;

  if (!HAS_XTRACE) {
    return { superseded: old || null, current: updated };
  }
  // TODO (Step 6): call XTrace supersede/contradiction API so the platform
  // records the version history, then return the reconciliation result.
  return { superseded: old || null, current: updated };
}

export function xtraceStatus() {
  return HAS_XTRACE ? 'connected' : 'in-memory-fallback';
}

// Expose raw history for the UI "agent beliefs / version history" panel
export function _allFacts() {
  return _facts;
}
