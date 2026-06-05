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

const HAS_ROCKETRIDE = !!process.env.ROCKETRIDE_API_KEY;

const PRIORITY_WEIGHT = { P0: 100, P1: 60, P2: 30, P3: 10 };

// Base token estimate by type (heuristic until real pipeline lands)
const TYPE_BASE_TOKENS = { bug: 45000, feature: 60000, refactor: 70000, docs: 18000 };

/**
 * estimateTicket — predict tokens, time, complexity for ONE ticket.
 * Pulls prior similar-ticket facts from XTrace to ground the estimate.
 */
export async function estimateTicket(ticket) {
  // Ground the estimate in memory of similar tickets
  const prior = await searchMemory(`type=${ticket.type}`);

  let tokens = TYPE_BASE_TOKENS[ticket.type] ?? 40000;
  // length signal from the description
  tokens += Math.min(40000, (ticket.description?.length || 0) * 40);
  // priority nudges complexity (critical work tends to be hairier)
  if (ticket.priority === 'P0') tokens *= 1.25;
  if (ticket.priority === 'P3') tokens *= 0.7;

  // if memory has a concrete prior, blend toward it
  const priorVal = prior.find((f) => f.key === `type=${ticket.type}` && typeof f.value === 'number');
  if (priorVal) tokens = Math.round((tokens + priorVal.value) / 2);

  tokens = Math.round(tokens);
  const complexity = tokens > 80000 ? 'high' : tokens > 45000 ? 'medium' : 'low';
  const estimatedMinutes = Math.max(10, Math.round(tokens / 1500)); // rough effort proxy

  return { estimatedTokens: tokens, estimatedMinutes, complexity };
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
  if (HAS_ROCKETRIDE) {
    // TODO (Step 4): trigger the real RocketRide pipeline with `tickets`,
    // parse its output into the same enriched shape returned below.
  }

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
  return HAS_ROCKETRIDE ? 'connected' : 'heuristic-fallback';
}
