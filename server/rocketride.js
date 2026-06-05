// rocketride.js — triggers the multi-agent pipeline that enriches tickets.
// Pipeline: estimator → budget → router → (context) → (monitor).
//
// Step 4 task: replace the heuristic fallbacks below with a real RocketRide
// pipeline call (pipeline/tokenpilot_pipeline.json) via the RocketRide SDK/REST
// from docs.rocketride.org. The estimator should pull "tickets like this" from
// XTrace before estimating. Keep the return shapes identical.

import 'dotenv/config';
import { searchMemory } from './xtrace.js';
import { MODEL_TIERS, TIER_PRICE_PER_1K } from './gateway.js';
import { rrEstimate, rocketrideEngineStatus } from './rocketrideClient.js';

const PRIORITY_WEIGHT = { P0: 100, P1: 60, P2: 30, P3: 10 };

// Base token estimate by type (heuristic fallback when the engine is offline)
const TYPE_BASE_TOKENS = { bug: 45000, feature: 60000, refactor: 70000, docs: 18000 };

// Per-ticket estimate cache: estimateTicket() is called many times per pipeline
// run (and across runs). Estimating via RocketRide's LLM every time would be slow
// and burn gateway credits, so each ticket is estimated once and reused.
const _estCache = new Map(); // ticketId -> { estimatedTokens, estimatedMinutes, complexity, source }

// Heuristic estimate, grounded in XTrace memory of similar tickets.
async function heuristicEstimate(ticket) {
  const prior = await searchMemory(`type=${ticket.type}`);
  let tokens = TYPE_BASE_TOKENS[ticket.type] ?? 40000;
  tokens += Math.min(40000, (ticket.description?.length || 0) * 40);
  if (ticket.priority === 'P0') tokens *= 1.25;
  if (ticket.priority === 'P3') tokens *= 0.7;
  const priorVal = prior.find((f) => f.key === `type=${ticket.type}` && typeof f.value === 'number');
  if (priorVal) tokens = Math.round((tokens + priorVal.value) / 2);
  return { tokens: Math.round(tokens), complexity: null };
}

/**
 * estimateTicket — predict tokens, time, complexity for ONE ticket.
 * Prefers the REAL RocketRide pipeline (local engine); falls back to the
 * XTrace-grounded heuristic. Cached per ticket id.
 */
export async function estimateTicket(ticket) {
  const cacheKey = ticket.id;
  if (cacheKey && _estCache.has(cacheKey)) return _estCache.get(cacheKey);

  let tokens, complexity, source;
  const rr = await rrEstimate(ticket);          // null when engine offline / call fails
  if (rr) {
    tokens = rr.estimatedTokens;
    complexity = rr.complexity;
    source = 'rocketride';
  } else {
    const h = await heuristicEstimate(ticket);
    tokens = h.tokens;
    source = 'heuristic';
  }

  if (!complexity) complexity = tokens > 80000 ? 'high' : tokens > 45000 ? 'medium' : 'low';
  const estimatedMinutes = Math.max(10, Math.round(tokens / 1500));
  const result = { estimatedTokens: tokens, estimatedMinutes, complexity, source };
  if (cacheKey) _estCache.set(cacheKey, result);
  return result;
}

/**
 * routeTicket — pick a model tier balancing criticality vs. complexity vs. context.
 * @param hasContext  true if a context summary already exists (→ allow downshift)
 */
export function routeTicket(ticket, complexity, hasContext = false) {
  // Established context → small follow-up work can downshift
  if (hasContext && complexity !== 'high') {
    return { tier: 'cheap', why: 'context established, low remaining reasoning' };
  }
  if (ticket.priority === 'P0' || complexity === 'high') {
    return { tier: 'flagship', why: `${ticket.priority} / ${complexity} complexity — needs strong reasoning` };
  }
  if (ticket.priority === 'P1' || complexity === 'medium') {
    return { tier: 'mid', why: `${ticket.priority} / ${complexity} — balanced` };
  }
  return { tier: 'cheap', why: `${ticket.priority} / ${complexity} — low-value, route cheap` };
}

function projectedCost(tier, tokens) {
  const per1k = TIER_PRICE_PER_1K[tier] ?? TIER_PRICE_PER_1K.mid;
  return +((tokens / 1000) * per1k).toFixed(2);
}

/**
 * enrichAll — run the full pipeline over every ticket (in parallel).
 * This is the visible "parallel processing" moment.
 */
export async function enrichAll(tickets) {
  // estimateTicket() routes through the real RocketRide engine when available
  // (see rocketrideClient.js), so enrichAll is RocketRide-backed automatically.
  const enriched = await Promise.all(
    tickets.map(async (t) => {
      const est = await estimateTicket(t);
      const route = routeTicket(t, est.complexity, false);
      return {
        ...t,
        ...est,
        modelTier: route.tier,
        model: MODEL_TIERS[route.tier],
        routeWhy: route.why,
        projectedCostUSD: projectedCost(route.tier, est.estimatedTokens),
        priorityWeight: PRIORITY_WEIGHT[t.priority] ?? 10,
      };
    })
  );
  return enriched;
}

/**
 * optimalOrder — budget agent: order tickets to maximize priority-weighted
 * work that fits inside the remaining budget (greedy by value/cost).
 */
export function optimalOrder(enriched, remainingBudget) {
  const ranked = [...enriched].sort(
    (a, b) => b.priorityWeight / b.projectedCostUSD - a.priorityWeight / a.projectedCostUSD
  );
  let spent = 0;
  return ranked.map((t) => {
    const fits = spent + t.projectedCostUSD <= remainingBudget;
    if (fits) spent += t.projectedCostUSD;
    return { ...t, fitsBudget: fits };
  });
}

export function rocketrideStatus() {
  return rocketrideEngineStatus();
}
