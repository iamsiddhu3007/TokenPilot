// inputs.js — reads the two things you paste into input/:
//   1. input/codebase/  → the repository Agent 1 analyzes
//   2. input/jira/       → the tickets (falls back to data/seed_tickets.json)
//
// Everything here is read-only and has a safe fallback, so the app runs before
// you've pasted anything.

import fs from 'fs';
import path from 'path';
import { loadRaw, normalize } from './ingest.js';

const CODEBASE_DIR = 'input/codebase';
const JIRA_DIR = 'input/jira';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
  '.cache', 'vendor', '__pycache__', '.venv', 'venv',
]);
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rb', '.java', '.kt', '.rs',
  '.c', '.h', '.cpp', '.cs', '.php', '.swift', '.scala', '.sql', '.sh',
  '.html', '.css', '.scss', '.vue', '.svelte', '.json', '.yml', '.yaml',
  '.md', '.txt',
]);

const MAX_FILES = 4000;
const MAX_FILE_BYTES = 512 * 1024; // skip files larger than 512KB

// --- recursively list source files under input/codebase/ ---
export function listCodebaseFiles() {
  const root = path.resolve(CODEBASE_DIR);
  if (!fs.existsSync(root)) return [];
  const out = [];

  function walk(dir) {
    if (out.length >= MAX_FILES) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      if (e.name.startsWith('.') && e.name !== '.gitkeep') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;
        let size = 0;
        try {
          size = fs.statSync(full).size;
        } catch {
          continue;
        }
        if (size > MAX_FILE_BYTES) continue;
        out.push({ path: path.relative(root, full), ext, size });
      }
    }
  }

  walk(root);
  return out;
}

// --- read a single codebase file's text (safe) ---
export function readCodebaseFile(relPath) {
  try {
    return fs.readFileSync(path.resolve(CODEBASE_DIR, relPath), 'utf-8');
  } catch {
    return '';
  }
}

// --- is there an actual codebase pasted in yet? ---
export function hasCodebase() {
  return listCodebaseFiles().length > 0;
}

// --- load + normalize jira tickets from input/jira/, else seed ---
export function loadJiraTickets() {
  const dir = path.resolve(JIRA_DIR);
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(json|csv)$/i.test(f))
    : [];

  let raw = [];
  let source = 'seed';
  if (files.length) {
    source = `input/jira (${files.length} file${files.length > 1 ? 's' : ''})`;
    for (const f of files) {
      try {
        raw = raw.concat(loadRaw(path.join(dir, f)));
      } catch {
        /* skip unreadable file */
      }
    }
  }
  if (!raw.length) {
    raw = loadRaw('data/seed_tickets.json');
    source = 'data/seed_tickets.json (fallback)';
  }

  const tickets = raw.map(normalize);
  return { tickets, source, codebasePresent: hasCodebase() };
}
