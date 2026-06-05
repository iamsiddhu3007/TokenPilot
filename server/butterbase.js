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
};

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf-8'));
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

export function butterbaseStatus() {
  return HAS_BUTTERBASE ? 'connected' : 'in-memory-fallback';
}
