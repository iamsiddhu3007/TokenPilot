// butterbase.js — Butterbase client: tickets, budget, spend state.
//
// IMPORTANT: This file has an in-memory fallback so the app RUNS before you
// wire Butterbase. Step 0 task for Claude Code: replace the fallback with real
// Butterbase calls using the actual SDK/REST shape from docs.butterbase.ai.
// Keep the same exported function signatures so nothing downstream changes.

import 'dotenv/config';
import fs from 'fs';

const HAS_BUTTERBASE =
  !!process.env.BUTTERBASE_API_KEY && !!process.env.BUTTERBASE_PROJECT_URL;

// ---- Fallback store persisted to disk so `ingest` and `index` (separate
// processes) share state until real Butterbase is wired. ----
const STORE = '.fallback-store.json';
const _default = {
  tickets: [],
  budget: { period: 'weekly', total: 200, consumed: 0 }, // dollars
  usage: {},      // memberId -> { costUSD, tokens, ticketsWorked, lastActiveTs }
  history: [],    // append-only: { memberId, ticketId, title, tier, model, costUSD, tokens, effortHours, ts }
};

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
    // backfill any fields added after this store was first written
    return { ...JSON.parse(JSON.stringify(_default)), ...saved };
  } catch {
    return JSON.parse(JSON.stringify(_default));
  }
}
function persist(state) {
  if (!HAS_BUTTERBASE) fs.writeFileSync(STORE, JSON.stringify(state, null, 2));
}

const _mem = load();

// ============================================================
// TICKETS
// ============================================================
export async function saveTickets(tickets) {
  if (!HAS_BUTTERBASE) {
    _mem.tickets = tickets;
    persist(_mem);
    return tickets;
  }
  // TODO (Step 0): upsert `tickets` into a Butterbase table.
  // Example shape — replace with real client:
  //   await bb.from('tickets').upsert(tickets);
  _mem.tickets = tickets; // keep mirror until real call is in
  persist(_mem);
  return tickets;
}

export async function getTickets() {
  if (!HAS_BUTTERBASE) return _mem.tickets;
  // TODO (Step 0): return await bb.from('tickets').select('*');
  return _mem.tickets;
}

export async function updateTicket(id, patch) {
  const t = _mem.tickets.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  // TODO (Step 0): await bb.from('tickets').update(patch).eq('id', id);
  persist(_mem);
  return t;
}

// ============================================================
// BUDGET / SPEND
// ============================================================
export async function getBudget() {
  if (!HAS_BUTTERBASE) return _mem.budget;
  // TODO (Step 0): return await bb.from('budget').select('*').single();
  return _mem.budget;
}

export async function addSpend(dollars) {
  _mem.budget.consumed = +(_mem.budget.consumed + dollars).toFixed(4);
  persist(_mem);
  return _mem.budget;
}

export async function setBudget(patch) {
  Object.assign(_mem.budget, patch);
  persist(_mem);
  return _mem.budget;
}

// ============================================================
// PER-MEMBER USAGE + HISTORY (powers the manager + member dashboards)
// ============================================================

// recordUsage — attribute one worked-ticket event to a team member.
// Appends to history (member view) and bumps the rolled-up usage (manager view).
export async function recordUsage(memberId, entry) {
  if (!memberId) return null;
  const u = _mem.usage[memberId] || { costUSD: 0, tokens: 0, ticketsWorked: 0, lastActiveTs: 0 };
  u.costUSD = +(u.costUSD + (entry.costUSD || 0)).toFixed(4);
  u.tokens += entry.tokens || 0;
  u.ticketsWorked += 1;
  u.lastActiveTs = entry.ts || Date.now();
  _mem.usage[memberId] = u;

  _mem.history.push({ memberId, ts: entry.ts || Date.now(), ...entry });
  // TODO (Butterbase): upsert usage row + insert history row.
  persist(_mem);
  return u;
}

// getUsage — rolled-up usage per member (NO history). For the manager dashboard.
export async function getUsage() {
  return _mem.usage;
}

// getHistory — full event log, optionally filtered to one member. For the member dashboard.
export async function getHistory(memberId) {
  const all = [..._mem.history].sort((a, b) => b.ts - a.ts);
  return memberId ? all.filter((h) => h.memberId === memberId) : all;
}

export function butterbaseStatus() {
  return HAS_BUTTERBASE ? 'connected' : 'in-memory-fallback';
}
