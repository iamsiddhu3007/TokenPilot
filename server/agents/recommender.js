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
import { TIER_PRICE_PER_1K, MODEL_TIERS } from '../gateway.js';

const PRIORITY_WEIGHT = { P0: 100, P1: 60, P2: 30, P3: 10 };
const SURFACE_MULT = { small: 0.85, moderate: 1.0, large: 1.4 };

// SLA window per priority — drives the displayed deadline (from ticket createdAt).
const DEADLINE_DAYS = { P0: 2, P1: 5, P2: 10, P3: 21 };

// Per-tier model recommendation copy: the concrete model name + why + a cheaper alt.
const MODEL_INFO = {
  flagship: { why: 'Critical/complex work — deep multi-step reasoning is worth the cost.', alt: MODEL_TIERS.mid },
  mid: { why: 'Moderate scope — strong quality at a balanced price.', alt: MODEL_TIERS.cheap },
  cheap: { why: 'Low-risk, well-scoped work — fast and inexpensive.', alt: MODEL_TIERS.cheap },
};

function deadlineFor(ticket) {
  const base = ticket.createdAt ? new Date(ticket.createdAt).getTime() : Date.now();
  const days = DEADLINE_DAYS[ticket.priority] ?? 14;
  return new Date(base + days * 86400000).toISOString();
}

// A one-line, context-aware suggestion for how to approach the ticket.
function suggestionFor(ticket, complexity, intel) {
  if (ticket.priority === 'P0') return 'Pair with on-call and ship behind a feature flag — this is availability/revenue-impacting.';
  if (ticket.type === 'docs') return 'Low-risk — batch with other docs/chore tickets in a single cheap-model pass.';
  if (complexity === 'high') return 'Break into sub-tasks; run the first pass on the flagship model, then downshift once context is established.';
  if ((intel?.touchedAreas?.length || 0) >= 3) return 'Spans multiple modules — add integration tests before merging.';
  if (ticket.type === 'refactor') return 'No behavior change expected; lean on the existing test suite as a guardrail.';
  if (ticket.priority === 'P1') return 'Reproduce first, add a regression test, then fix.';
  return 'Straightforward — a single focused session should clear it.';
}

function projectedCost(tier, tokens) {
  const per1k = TIER_PRICE_PER_1K[tier] ?? TIER_PRICE_PER_1K.mid;
  return +((tokens / 1000) * per1k).toFixed(2);
}

// Effort in hours. Two parts:
//   baseEffort — the ticket's intrinsic size (independent of model), from
//                reasoning tokens + a (capped) code-surface signal.
//   factor     — the CHOSEN model: a stronger model needs LESS human
//                hand-holding (opus < sonnet < haiku), but costs more. That
//                cost↔effort tradeoff is exactly what the dropdown visualises.
const EFFORT_FACTOR = { flagship: 0.7, mid: 1.0, cheap: 1.4 };
// Docs/chores barely touch code, so down-weight their surface signal (the
// keyword analyzer over-matches docs words to source files).
const TYPE_SURFACE_MULT = { docs: 0.15, bug: 0.85, feature: 1.0, refactor: 1.25 };
function baseEffort(tokens, intel, type) {
  const reasoning = tokens / 11000;                      // heavier tickets take longer
  const surfaceRaw = (intel?.totalLoc || 0) / 220;       // bigger change surface = more time
  const surface = Math.min(surfaceRaw * (TYPE_SURFACE_MULT[type] ?? 1), 8);
  return Math.max(0.4, reasoning + surface);
}
function effortHours(tokens, intel, tier, type) {
  const hrs = baseEffort(tokens, intel, type) * (EFFORT_FACTOR[tier] ?? 1);
  return +Math.min(hrs, 80).toFixed(1);                  // global sanity cap
}

// Cost for a given model tier at this token estimate.
function costFor(tier, tokens) {
  return projectedCost(tier, tokens);
}

// Build the full set of model choices (suggested + alternatives), each with its
// own cost + effort, so the UI can offer a dropdown that recomputes live.
const ALL_TIERS = ['flagship', 'mid', 'cheap'];
function buildModelOptions(tokens, intel, suggestedTier, type) {
  return ALL_TIERS.map((t) => ({
    tier: t,
    model: MODEL_TIERS[t],
    costUSD: costFor(t, tokens),
    effortHours: effortHours(tokens, intel, t, type),
    suggested: t === suggestedTier,
  }));
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

      const tierInfo = MODEL_INFO[route.tier] || MODEL_INFO.mid;
      return {
        ticketId: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        type: t.type,
        status: t.status || 'open',
        createdAt: t.createdAt || null,
        deadline: deadlineFor(t),
        estimatedTokens: tokens,
        estimatedCostUSD: cost,
        estimatedEffortHours: effortHours(tokens, intel, route.tier, t.type),
        complexity,
        recommendedModelTier: route.tier,
        recommendedModel: MODEL_TIERS[route.tier],   // concrete name, e.g. claude-opus-4-8
        modelWhy: tierInfo.why,
        modelAlt: tierInfo.alt,
        // every model choice with its own cost + effort (powers the dropdown)
        modelOptions: buildModelOptions(tokens, intel, route.tier, t.type),
        suggestion: suggestionFor(t, complexity, intel),
        priorityWeight: PRIORITY_WEIGHT[t.priority] ?? 10,
        // completed-state passthrough (set when a ticket is completed via /work)
        completedAt: t.completedAt || null,
        actualCostUSD: t.actualCostUSD ?? null,
        assignedTo: t.assignedTo || null,   // manual assignee override (from "add ticket")
        manualRank: t.manualRank ?? null,   // manual drag-reorder position
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

    // a manual assignee (set via "add ticket") wins over the load-balancer.
    const assignee = (r.assignedTo && members.find((m) => m.id === r.assignedTo))
      || chooseAssignee(r, r.intel, members, loadByMember);
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
