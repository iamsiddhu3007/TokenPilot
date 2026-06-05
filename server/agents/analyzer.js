// agents/analyzer.js — AGENT 1: Codebase Intelligence.
//
// Has access to the ENTIRE codebase (input/codebase/) + the tickets. For each
// ticket it generates the *information* that Agent 2 consumes: which files the
// work likely touches, how big the change surface is, and how complex it looks.
//
// FALLBACK now / REAL later: today this is a deterministic static-analysis pass
// (keyword↔file matching + size signals). When you wire the real codebase-aware
// LLM agent via the Butterbase gateway, replace `analyzeTicket`'s body and keep
// the returned `intel` shape identical so Agent 2 doesn't change.

import { listCodebaseFiles, readCodebaseFile, hasCodebase } from '../inputs.js';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'has',
  'not', 'but', 'all', 'any', 'can', 'use', 'used', 'add', 'fix', 'on', 'in',
  'to', 'of', 'a', 'an', 'is', 'it', 'be', 'at', 'or', 'as', 'by', 'we', 'our',
  'users', 'user', 'page', 'after', 'when', 'should', 'still', 'into', 'new',
]);

// pull meaningful keywords out of a ticket
function keywords(ticket) {
  const text = `${ticket.title} ${ticket.description}`.toLowerCase();
  const words = text.match(/[a-z][a-z0-9_]{2,}/g) || [];
  const freq = new Map();
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.keys()];
}

// cheap relevance score of a file to a ticket's keywords
function scoreFile(file, kws, contentSample) {
  const hay = (file.path + ' ' + contentSample).toLowerCase();
  let score = 0;
  for (const k of kws) {
    if (file.path.toLowerCase().includes(k)) score += 3; // path match is strong
    else if (hay.includes(k)) score += 1;
  }
  return score;
}

// Cache the file list + a small content sample once per analysis pass.
function buildIndex() {
  const files = listCodebaseFiles();
  return files.map((f) => ({
    ...f,
    // sample first ~2KB for keyword presence without reading whole repo into RAM
    sample: readCodebaseFile(f.path).slice(0, 2048),
    loc: estimateLoc(f),
  }));
}

function estimateLoc(f) {
  // ~1 line per 40 bytes is a decent average for source; good enough as a signal
  return Math.max(1, Math.round(f.size / 40));
}

/**
 * analyzeTicket — produce intel for ONE ticket against the indexed codebase.
 * @returns intel {
 *   ticketId, relatedFiles[], touchedAreas[], fileCount, totalLoc,
 *   surface ('small'|'moderate'|'large'), signals{}, summary
 * }
 */
export function analyzeTicket(ticket, index) {
  const kws = keywords(ticket);

  const scored = index
    .map((f) => ({ file: f, score: scoreFile(f, kws, f.sample) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const relatedFiles = scored.map((s) => s.file.path);
  const totalLoc = scored.reduce((n, s) => n + s.file.loc, 0);
  const touchedAreas = [
    ...new Set(relatedFiles.map((p) => p.split('/')[0]).filter(Boolean)),
  ].slice(0, 6);

  // surface = how much code the change appears to span
  const surface = totalLoc > 1200 || relatedFiles.length > 8
    ? 'large'
    : totalLoc > 350 || relatedFiles.length > 3
      ? 'moderate'
      : 'small';

  // signals Agent 2 uses to refine its estimates
  const signals = {
    crossModule: touchedAreas.length >= 3,
    testTouch: relatedFiles.some((p) => /test|spec/i.test(p)),
    keywordHits: scored.reduce((n, s) => n + s.score, 0),
    hasCodebase: index.length > 0,
  };

  const summary = index.length === 0
    ? `No codebase pasted yet — intel derived from ticket text only. Paste a repo into input/codebase/ for file-level analysis.`
    : relatedFiles.length === 0
      ? `No obvious file matches in the codebase for this ticket; likely net-new code or vague scope.`
      : `Touches ~${relatedFiles.length} files (${surface} surface, ~${totalLoc} LOC) across ${touchedAreas.join(', ') || 'one area'}.` +
        (signals.crossModule ? ' Spans multiple modules.' : '') +
        (signals.testTouch ? ' Test files involved.' : '');

  return {
    ticketId: ticket.id,
    relatedFiles,
    touchedAreas,
    fileCount: relatedFiles.length,
    totalLoc,
    surface,
    signals,
    summary,
  };
}

/**
 * analyzeAll — Agent 1's full pass. Indexes the codebase once, then scores
 * every ticket against it IN PARALLEL (the visible parallel-processing moment).
 */
export async function analyzeAll(tickets) {
  const index = buildIndex();
  const intel = await Promise.all(
    tickets.map(async (t) => analyzeTicket(t, index))
  );
  return { intel, indexedFiles: index.length, codebasePresent: hasCodebase() };
}

export function analyzerStatus() {
  return hasCodebase() ? 'codebase-indexed' : 'text-only-fallback';
}
