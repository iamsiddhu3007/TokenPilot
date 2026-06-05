// rocketrideClient.js — REAL RocketRide integration.
//
// Connects to the local RocketRide engine (started by the VS Code extension in
// `connectionMode: local`) over the DAP WebSocket, runs the estimator pipeline
// (pipeline/estimate.pipe: chat → llm_openai_api → response_answers), and asks
// the LLM (routed through the Butterbase gateway) to estimate effort per ticket.
//
// Everything degrades gracefully: if the engine is unreachable or a call fails,
// rrEstimate() returns null and the caller (rocketride.js) uses its heuristic.
//
// Connection: the OSS engine authenticates against ITS OWN ROCKETRIDE_APIKEY env
// var; the extension starts it without one, so any non-empty key is accepted.
// The SDK reads ROCKETRIDE_URI + ROCKETRIDE_APIKEY from .env.

import 'dotenv/config';
import { RocketRideClient, Question } from 'rocketride';

const PIPE = 'pipeline/estimate.pipe';

let _client = null;
let _token = null;
let _status = 'heuristic-fallback';
let _ready = null; // memoized init promise

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms)),
  ]);
}

// Connect once and start the pipeline once (use() is expensive — do it a single
// time, then reuse the token for every chat() call). Memoized.
async function ensureReady() {
  if (_ready) return _ready;
  _ready = (async () => {
    if (!process.env.ROCKETRIDE_URI) {
      _status = 'heuristic-fallback';
      return false;
    }
    try {
      const c = new RocketRideClient(); // uri + apikey from .env
      await withTimeout(c.connect(), 6000, 'connect');
      // use() is idempotent-ish: a prior instance of this pipeline may still be
      // running on the engine (idle TTL). Create one; if it already exists,
      // attach to it with useExisting instead of failing.
      let useRes;
      try {
        useRes = await withTimeout(c.use({ filepath: PIPE, ttl: 0 }), 25000, 'use');
      } catch (e) {
        if (/already running|already exists/i.test(e?.message || '')) {
          useRes = await withTimeout(c.use({ filepath: PIPE, useExisting: true }), 25000, 'use(existing)');
        } else {
          throw e;
        }
      }
      const token = useRes.token;
      _client = c;
      _token = token;
      _status = 'engine-connected';
      console.log(`[rocketride] local engine connected; estimator pipeline live (${token}).`);
      return true;
    } catch (e) {
      console.warn('[rocketride] engine unavailable → heuristic fallback:', e?.message || e);
      _client = null;
      _token = null;
      _status = 'heuristic-fallback';
      return false;
    }
  })();
  return _ready;
}

/**
 * rrEstimate — run ONE ticket through the RocketRide pipeline.
 * @returns { estimatedTokens, complexity } or null to signal "use heuristic".
 */
export async function rrEstimate(ticket) {
  const ok = await ensureReady();
  if (!ok || !_client || !_token) return null;
  try {
    const q = new Question({ expectJson: true });
    q.addInstruction('Role', 'You are a senior estimator for AI-assisted engineering tasks.');
    q.addExample('A small, well-scoped bug', { estimatedTokens: 30000, complexity: 'low' });
    q.addExample('A cross-module refactor', { estimatedTokens: 95000, complexity: 'high' });
    q.addQuestion(
      'Estimate the effort for the ticket below. Return ONLY JSON ' +
      '{"estimatedTokens": <integer 5000-200000>, "complexity": "low" | "medium" | "high"}.\n' +
      `Type: ${ticket.type}\nPriority: ${ticket.priority}\nTitle: ${ticket.title}\n` +
      `Description: ${ticket.description || '(none)'}`
    );
    const res = await withTimeout(_client.chat({ token: _token, question: q }), 30000, 'chat');
    let a = res?.answers?.[0];
    if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = null; } }
    const tokens = a && Number(a.estimatedTokens);
    if (Number.isFinite(tokens) && tokens > 0) {
      const complexity = ['low', 'medium', 'high'].includes(a.complexity) ? a.complexity : null;
      return { estimatedTokens: Math.round(tokens), complexity };
    }
  } catch (e) {
    console.warn('[rocketride] estimate failed → heuristic:', e?.message || e);
  }
  return null;
}

export function rocketrideEngineStatus() {
  return _status;
}

// Called on boot so the engine connects up front and /health is accurate.
export async function initRocketride() {
  await ensureReady();
  return _status;
}
