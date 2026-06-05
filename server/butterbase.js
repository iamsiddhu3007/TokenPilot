// butterbase.js — Butterbase client: tickets, budget, spend state.
//
// REAL mode: when BUTTERBASE_API_KEY + BUTTERBASE_PROJECT_URL are set, every
// call hits the live Butterbase REST data API (auto-generated from the schema):
//   GET/POST/PATCH  ${PROJECT_URL}/{table}   with  Authorization: Bearer {key}
// PROJECT_URL already includes /v1/{app_id}. Butterbase rows use a uuid `id` PK
// (required by the by-id PATCH route), so the app's business keys live in
// separate unique columns: tickets.key, budget.slot, usage.member_id. We look up
// the uuid by the business key, then PATCH by uuid.
// FALLBACK mode: an in-memory store persisted to .fallback-store.json.

import 'dotenv/config';
import fs from 'fs';

const BASE = process.env.BUTTERBASE_PROJECT_URL;            // .../v1/{app_id}
const KEY = process.env.BUTTERBASE_API_KEY;
const HAS_BUTTERBASE = !!KEY && !!BASE;

// ---------- REST helpers ----------
async function bb(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`butterbase ${method} ${path} → ${res.status} ${txt.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}
const num = (v) => (v == null ? 0 : Number(v));
const one = (r) => (Array.isArray(r) ? r[0] : r);

// ---------- ticket <-> row mapping ----------
function rowToTicket(r) {
  let labels = [];
  try { labels = r.labels ? JSON.parse(r.labels) : []; } catch { labels = []; }
  return {
    id: r.key,                                   // the app's business id, e.g. "EXP-7304"
    title: r.title,
    description: r.description,
    priority: r.priority,
    type: r.type,
    status: r.status,
    createdAt: r.created_at,
    labels,
    contextSummary: r.context_summary || undefined,
    completedAt: r.completed_at != null ? num(r.completed_at) : undefined,
    actualCostUSD: r.actual_cost_usd != null ? num(r.actual_cost_usd) : undefined,
    estimatedCostUSD: r.estimated_cost_usd != null ? num(r.estimated_cost_usd) : undefined,
    assignedTo: r.assigned_to || undefined,
    manualRank: r.manual_rank != null ? num(r.manual_rank) : undefined,
  };
}
function ticketToRow(t) {
  return {
    key: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    type: t.type,
    status: t.status || 'open',
    created_at: t.createdAt || new Date().toISOString(),
    labels: JSON.stringify(t.labels || []),
    context_summary: t.contextSummary ?? null,
    completed_at: t.completedAt ?? null,
    actual_cost_usd: t.actualCostUSD ?? null,
    estimated_cost_usd: t.estimatedCostUSD ?? null,
    assigned_to: t.assignedTo ?? null,
    manual_rank: t.manualRank ?? null,
  };
}
const PATCH_MAP = {
  status: 'status', completedAt: 'completed_at', actualCostUSD: 'actual_cost_usd',
  estimatedCostUSD: 'estimated_cost_usd', contextSummary: 'context_summary',
  title: 'title', description: 'description', priority: 'priority', type: 'type',
  assignedTo: 'assigned_to', manualRank: 'manual_rank',
};
function patchToRow(patch) {
  const row = {};
  for (const [k, v] of Object.entries(patch)) if (PATCH_MAP[k]) row[PATCH_MAP[k]] = v;
  return row;
}
// resolve a table's uuid id from a business-key column
async function uuidByKey(table, col, val) {
  const rows = await bb('GET', `/${table}?${col}=eq.${encodeURIComponent(val)}&select=id&limit=1`);
  return rows && rows.length ? rows[0].id : null;
}

// ---- Fallback store (used only when HAS_BUTTERBASE is false) ----
const STORE = '.fallback-store.json';
const _default = { tickets: [], budget: { period: 'weekly', total: 200, consumed: 0 }, usage: {}, history: [] };
function load() {
  try { return { ...JSON.parse(JSON.stringify(_default)), ...JSON.parse(fs.readFileSync(STORE, 'utf-8')) }; }
  catch { return JSON.parse(JSON.stringify(_default)); }
}
function persist(state) { if (!HAS_BUTTERBASE) fs.writeFileSync(STORE, JSON.stringify(state, null, 2)); }
const _mem = load();

// ============================================================
// TICKETS
// ============================================================
export async function saveTickets(tickets) {
  if (!HAS_BUTTERBASE) { _mem.tickets = tickets; persist(_mem); return tickets; }
  // POST each; a duplicate `key` (already seeded) just skips.
  for (const t of tickets) {
    await bb('POST', '/tickets', ticketToRow(t)).catch(() => {});
  }
  return tickets;
}

export async function getTickets() {
  if (!HAS_BUTTERBASE) return _mem.tickets;
  const rows = await bb('GET', '/tickets?limit=500');
  return (rows || []).map(rowToTicket);
}

// createTicket — insert ONE new ticket (manager "add ticket"). Returns the saved ticket.
export async function createTicket(t) {
  if (!HAS_BUTTERBASE) { _mem.tickets.push(t); persist(_mem); return t; }
  const created = await bb('POST', '/tickets', ticketToRow(t));
  return rowToTicket(one(created));
}

export async function updateTicket(id, patch) {
  if (!HAS_BUTTERBASE) {
    const t = _mem.tickets.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    persist(_mem);
    return t;
  }
  const uuid = await uuidByKey('tickets', 'key', id);
  if (!uuid) return null;
  const updated = await bb('PATCH', `/tickets/${uuid}`, patchToRow(patch));
  const r = one(updated);
  return r ? rowToTicket(r) : null;
}

// ============================================================
// BUDGET / SPEND  (single row, slot = 'current')
// ============================================================
async function budgetRow() {
  const rows = await bb('GET', '/budget?slot=eq.current&limit=1');
  if (rows && rows.length) return rows[0];
  const created = await bb('POST', '/budget', { slot: 'current', period: 'weekly', total: 200, consumed: 0 });
  return one(created);
}
export async function getBudget() {
  if (!HAS_BUTTERBASE) return _mem.budget;
  const b = await budgetRow();
  return { period: b.period, total: num(b.total), consumed: num(b.consumed) };
}
export async function addSpend(dollars) {
  if (!HAS_BUTTERBASE) {
    _mem.budget.consumed = +(_mem.budget.consumed + dollars).toFixed(4);
    persist(_mem);
    return _mem.budget;
  }
  const b = await budgetRow();
  const consumed = +(num(b.consumed) + dollars).toFixed(4);
  await bb('PATCH', `/budget/${b.id}`, { consumed });
  return { period: b.period, total: num(b.total), consumed };
}
export async function setBudget(patch) {
  if (!HAS_BUTTERBASE) { Object.assign(_mem.budget, patch); persist(_mem); return _mem.budget; }
  const b = await budgetRow();
  await bb('PATCH', `/budget/${b.id}`, patch);
  return getBudget();
}

// ============================================================
// PER-MEMBER USAGE + HISTORY
// ============================================================
export async function recordUsage(memberId, entry) {
  if (!memberId) return null;
  const ts = entry.ts || Date.now();
  if (!HAS_BUTTERBASE) {
    const u = _mem.usage[memberId] || { costUSD: 0, tokens: 0, ticketsWorked: 0, lastActiveTs: 0 };
    u.costUSD = +(u.costUSD + (entry.costUSD || 0)).toFixed(4);
    u.tokens += entry.tokens || 0;
    u.ticketsWorked += 1;
    u.lastActiveTs = ts;
    _mem.usage[memberId] = u;
    _mem.history.push({ memberId, ts, ...entry });
    persist(_mem);
    return u;
  }
  const existing = one(await bb('GET', `/usage?member_id=eq.${encodeURIComponent(memberId)}&limit=1`));
  const prev = existing
    ? { costUSD: num(existing.cost_usd), tokens: num(existing.tokens), ticketsWorked: num(existing.tickets_worked) }
    : { costUSD: 0, tokens: 0, ticketsWorked: 0 };
  const next = {
    cost_usd: +(prev.costUSD + (entry.costUSD || 0)).toFixed(4),
    tokens: prev.tokens + (entry.tokens || 0),
    tickets_worked: prev.ticketsWorked + 1,
    last_active_ts: ts,
  };
  if (existing) await bb('PATCH', `/usage/${existing.id}`, next);
  else await bb('POST', '/usage', { member_id: memberId, ...next });

  await bb('POST', '/history', {
    member_id: memberId, ticket_id: entry.ticketId, title: entry.title, priority: entry.priority,
    tier: entry.tier, model: entry.model, cost_usd: entry.costUSD || 0,
    tokens: entry.tokens || 0, effort_hours: entry.effortHours || 0, ts,
  }).catch(() => {});
  return { costUSD: next.cost_usd, tokens: next.tokens, ticketsWorked: next.tickets_worked, lastActiveTs: ts };
}

export async function getUsage() {
  if (!HAS_BUTTERBASE) return _mem.usage;
  const rows = await bb('GET', '/usage?limit=500');
  const out = {};
  for (const r of rows || []) {
    out[r.member_id] = {
      costUSD: num(r.cost_usd), tokens: num(r.tokens),
      ticketsWorked: num(r.tickets_worked), lastActiveTs: num(r.last_active_ts),
    };
  }
  return out;
}

export async function getHistory(memberId) {
  if (!HAS_BUTTERBASE) {
    const all = [..._mem.history].sort((a, b) => b.ts - a.ts);
    return memberId ? all.filter((h) => h.memberId === memberId) : all;
  }
  const filter = memberId ? `&member_id=eq.${encodeURIComponent(memberId)}` : '';
  const rows = await bb('GET', `/history?order=ts.desc&limit=500${filter}`);
  return (rows || []).map((r) => ({
    memberId: r.member_id, ticketId: r.ticket_id, title: r.title, priority: r.priority,
    tier: r.tier, model: r.model, costUSD: num(r.cost_usd), tokens: num(r.tokens),
    effortHours: num(r.effort_hours), ts: num(r.ts),
  }));
}

export function butterbaseStatus() {
  return HAS_BUTTERBASE ? 'connected' : 'in-memory-fallback';
}
