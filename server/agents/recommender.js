// agents/recommender.js — AGENT 2: Advisory / Recommendation.
//
// Consumes Agent 1's intel and decides, per ticket: priority order, estimated
// cost ($), effort/time, model tier, and a suggested assignee — then a one-line
// rationale ("why"). This agent does NOT read the codebase itself; it only acts
// on the information Agent 1 produced (the two-agent contract).
//
// Pure module: receives team members + current usage + budget as arguments so it
// stays decoupled from storage. Swap the heuristics for a real LLM call later;
// keep the returned recommendation shape stable.

import { estimateTicket, routeTicket } from '../rocketride.js';
import { TIER_PRICE_PER_1K } from '../gateway.js';

const PRIORITY_WEIGHT = { P0: 100, P1: 60, P2: 30, P3: 10 };
const SURFACE_MULT = { small: 0.85, moderate: 1.0, large: 1.4 };

function projectedCost(tier, tokens) {
  const per1k = TIER_PRICE_PER_1K[tier] ?? TIER_PRICE_PER_1K.mid;
  return +((tokens / 1000) * per1k).toFixed(2);
}

// Effort in hours: token-reasoning proxy + a code-surface proxy from intel.
function effortHours(tokens, intel) {
  const reasoning = tokens / 9000;            // ~heavier tickets take longer
  const surface = (intel?.totalLoc || 0) / 220; // bigger change surface = more time
  return +(Math.max(0.5, reasoning + surface)).toFixed(1);
}

function complexityFromTokens(tokens) {
  return tokens > 80000 ? 'high' : tokens > 45000 ? 'medium' : 'low';
}

// Pick the best assignee: prefer a skill match, then balance load. `loadByMember`
// is mutated across the pass so high-priority tickets claim capacity first.
function chooseAssignee(ticket, intel, members, loadByMember) {
  if (!members?.length) return null;
  const wants = new Set([
    ticket.type,
    ...(intel?.touchedAreas || []).map((a) => a.toLowerCase()),
  ]);

  const ranked = [...members].sort((a, b) => {
    const aMatch = a.skills?.some((s) => wants.has(s)) ? 0 : 1;
    const bMatch = b.skills?.some((s) => wants.has(s)) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    // then least-loaded relative to their weekly budget
    const aLoad = (loadByMember[a.id] || 0) / (a.weeklyBudgetUSD || 1);
    const bLoad = (loadByMember[b.id] || 0) / (b.weeklyBudgetUSD || 1);
    return aLoad - bLoad;
  });

  return ranked[0];
}

/**
 * recommendAll — Agent 2's full pass.
 * @param tickets   normalized tickets
 * @param intelList Agent 1 output (array of intel, aligned by ticketId)
 * @param ctx       { members, usage, remainingBudget }
 * @returns array of recommendations
 */
export async function recommendAll(tickets, intelList, ctx = {}) {
  const { members = [], usage = {}, remainingBudget = Infinity } = ctx;
  const intelById = Object.fromEntries(intelList.map((i) => [i.ticketId, i]));

  // 1) enrich every ticket using intel-adjusted estimates
  const enriched = await Promise.all(
    tickets.map(async (t) => {
      const intel = intelById[t.id] || {};
      const base = await estimateTicket(t);
      let tokens = Math.round(base.estimatedTokens * (SURFACE_MULT[intel.surface] || 1));
      tokens += (intel.totalLoc || 0) * 4; // more touched code → more tokens
      if (intel.signals?.crossModule) tokens = Math.round(tokens * 1.1);

      const complexity = complexityFromTokens(tokens);
      const route = routeTicket(t, complexity, false);
      const cost = projectedCost(route.tier, tokens);

      return {
        ticketId: t.id,
        title: t.title,
        priority: t.priority,
        type: t.type,
        status: t.status,
        estimatedTokens: tokens,
        estimatedCostUSD: cost,
        estimatedEffortHours: effortHours(tokens, intel),
        complexity,
        recommendedModelTier: route.tier,
        recommendedModel: route.tier,
        priorityWeight: PRIORITY_WEIGHT[t.priority] ?? 10,
        intel: {
          relatedFiles: intel.relatedFiles || [],
          touchedAreas: intel.touchedAreas || [],
          surface: intel.surface || 'unknown',
          totalLoc: intel.totalLoc || 0,
          summary: intel.summary || '',
        },
        routeWhy: route.why,
      };
    })
  );

  // 2) rank by priority-weighted value density, mark what fits the budget
  const ranked = [...enriched].sort(
    (a, b) => b.priorityWeight / b.estimatedCostUSD - a.priorityWeight / a.estimatedCostUSD
  );
  let spent = 0;

  // 3) assign members in rank order so top work claims capacity first
  const loadByMember = {};
  for (const id of Object.keys(usage)) loadByMember[id] = usage[id]?.costUSD || 0;

  return ranked.map((r, idx) => {
    const fitsBudget = spent + r.estimatedCostUSD <= remainingBudget;
    if (fitsBudget) spent += r.estimatedCostUSD;

    const assignee = chooseAssignee(r, r.intel, members, loadByMember);
    if (assignee) loadByMember[assignee.id] = (loadByMember[assignee.id] || 0) + r.estimatedCostUSD;

    const rationale =
      `${r.priority} · ${r.complexity} complexity · ${r.intel.surface} surface → ` +
      `${r.recommendedModelTier} model (~$${r.estimatedCostUSD}, ~${r.estimatedEffortHours}h)` +
      (assignee ? ` · suggest ${assignee.name}` : '') +
      (fitsBudget ? '' : ' · ⚠ over budget this period');

    return {
      ...r,
      priorityRank: idx + 1,
      fitsBudget,
      assignee: assignee ? { id: assignee.id, name: assignee.name, role: assignee.role } : null,
      rationale,
    };
  });
}
