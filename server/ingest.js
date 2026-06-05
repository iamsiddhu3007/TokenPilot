// ingest.js — reads a CSV or JSON dataset, normalizes every row into the
// internal ticket shape, and loads it into Butterbase.
//
// Swap datasets by setting DATASET_PATH in .env (default: data/seed_tickets.json).
// Works with the seed file now and a Kaggle CSV/JSON later — no downstream changes.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { saveTickets } from './butterbase.js';

const DATASET_PATH = process.env.DATASET_PATH || 'data/seed_tickets.json';

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const VALID_TYPES = ['bug', 'feature', 'refactor', 'docs'];

// --- Map messy dataset priority values onto P0–P3 ---
function normalizePriority(raw, idx) {
  if (!raw) return distribute(idx);
  const v = String(raw).toLowerCase().trim();
  if (['p0', 'blocker', 'critical', 'highest', '1'].includes(v)) return 'P0';
  if (['p1', 'high', 'major', '2'].includes(v)) return 'P1';
  if (['p2', 'medium', 'normal', '3'].includes(v)) return 'P2';
  if (['p3', 'low', 'minor', 'trivial', 'lowest', '4', '5'].includes(v)) return 'P3';
  if (VALID_PRIORITIES.includes(raw.toUpperCase?.())) return raw.toUpperCase();
  return distribute(idx);
}

// Even spread when priority is absent, so the board always looks balanced
function distribute(idx) {
  return VALID_PRIORITIES[idx % VALID_PRIORITIES.length];
}

// --- Derive a type from text when the dataset doesn't provide one ---
function normalizeType(raw, title = '', desc = '') {
  if (raw) {
    const v = String(raw).toLowerCase().trim();
    if (v.includes('bug') || v.includes('defect') || v.includes('error')) return 'bug';
    if (v.includes('feature') || v.includes('story') || v.includes('enhance')) return 'feature';
    if (v.includes('refactor') || v.includes('debt') || v.includes('cleanup')) return 'refactor';
    if (v.includes('doc')) return 'docs';
    if (VALID_TYPES.includes(v)) return v;
  }
  const text = `${title} ${desc}`.toLowerCase();
  if (/\b(bug|crash|fail|broken|500|error|regression)\b/.test(text)) return 'bug';
  if (/\b(refactor|cleanup|migrate|debt|deprecat)\b/.test(text)) return 'refactor';
  if (/\b(doc|documentation|readme)\b/.test(text)) return 'docs';
  return 'feature';
}

function pick(row, keys) {
  for (const k of keys) {
    const hit = Object.keys(row).find((c) => c.toLowerCase().trim() === k);
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') return row[hit];
  }
  return '';
}

export function normalize(row, idx) {
  const title = pick(row, ['title', 'summary', 'name', 'issue']) || `Ticket ${idx + 1}`;
  const description = pick(row, ['description', 'body', 'details', 'text']) || title;
  const created = pick(row, ['createdat', 'created_at', 'created', 'date', 'opened']);
  return {
    id: pick(row, ['id', 'key', 'issue_id', 'ticket_id']) || `TICK-${1000 + idx}`,
    title: String(title).slice(0, 160),
    description: String(description).slice(0, 1000),
    priority: normalizePriority(pick(row, ['priority', 'severity', 'importance']), idx),
    type: normalizeType(pick(row, ['type', 'issuetype', 'category', 'label']), title, description),
    status: pick(row, ['status', 'state']) || 'open',
    // ISO timestamp the UI shows as "date created"; default to now when absent.
    createdAt: created ? new Date(created).toISOString() : new Date().toISOString(),
  };
}

export function loadRaw(file) {
  const ext = path.extname(file).toLowerCase();
  const content = fs.readFileSync(file, 'utf-8');
  if (ext === '.json') {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : data.issues || data.tickets || data.records || [];
  }
  if (ext === '.csv') {
    return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
  }
  throw new Error(`Unsupported dataset extension: ${ext}`);
}

export async function ingest(file = DATASET_PATH, limit = 40) {
  console.log(`[ingest] reading ${file}`);
  const raw = loadRaw(file).slice(0, limit); // cap for demo speed
  const tickets = raw.map(normalize);
  console.log(`[ingest] normalized ${tickets.length} tickets`);
  await saveTickets(tickets);
  console.log(`[ingest] loaded into Butterbase ✅`);
  return tickets;
}

// Run directly: `node server/ingest.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  ingest().catch((e) => {
    console.error('[ingest] FAILED:', e.message);
    process.exit(1);
  });
}
