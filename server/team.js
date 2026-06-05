// team.js — the team roster and the two dashboard assemblers.
//
//   getManagerOverview() → every member's CURRENT usage + load + assigned work,
//                          plus team totals. NO history (manager wants the now).
//   getMemberDetail(id)  → one member's usage + FULL history + their recommended
//                          and worked tickets (the member's own deep view).

import fs from 'fs';
import path from 'path';
import { getUsage, getHistory, getBudget } from './butterbase.js';
import { runPipeline } from './agents/orchestrator.js';

const ROSTER = 'data/team_members.json';

// roster is small + static; read fresh so edits to the JSON show up on refresh
export function loadMembers() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(ROSTER), 'utf-8'));
  } catch {
    return [];
  }
}

export function getMember(id) {
  return loadMembers().find((m) => m.id === id) || null;
}

// group Agent 2's recommendations by suggested assignee
function recsByMember(recommendations) {
  const map = {};
  for (const r of recommendations) {
    const id = r.assignee?.id;
    if (!id) continue;
    (map[id] ||= []).push(r);
  }
  return map;
}

// ============================================================
// MANAGER VIEW — usage of each team member + team dashboard (no history)
// ============================================================
export async function getManagerOverview() {
  const [usage, budget, pipeline] = await Promise.all([
    getUsage(),
    getBudget(),
    runPipeline(),
  ]);
  const members = loadMembers();
  const byMember = recsByMember(pipeline.recommendations);

  const memberCards = members.map((m) => {
    const u = usage[m.id] || { costUSD: 0, tokens: 0, ticketsWorked: 0, lastActiveTs: 0 };
    const assigned = byMember[m.id] || [];
    const assignedCost = +assigned.reduce((n, r) => n + r.estimatedCostUSD, 0).toFixed(2);
    const assignedHours = +assigned.reduce((n, r) => n + r.estimatedEffortHours, 0).toFixed(1);
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      weeklyBudgetUSD: m.weeklyBudgetUSD,
      // current usage (spent so far this period)
      spentUSD: +u.costUSD.toFixed(2),
      tokens: u.tokens,
      ticketsWorked: u.ticketsWorked,
      budgetUsedPct: m.weeklyBudgetUSD ? Math.min(100, Math.round((u.costUSD / m.weeklyBudgetUSD) * 100)) : 0,
      lastActiveTs: u.lastActiveTs,
      // what the agent recommends they pick up next
      assignedCount: assigned.length,
      assignedCostUSD: assignedCost,
      assignedHours,
      topRecommendation: assigned[0]
        ? { ticketId: assigned[0].ticketId, title: assigned[0].title, priority: assigned[0].priority }
        : null,
    };
  });

  const teamSpent = +Object.values(usage).reduce((n, u) => n + (u.costUSD || 0), 0).toFixed(2);

  return {
    view: 'manager',
    budget,
    team: {
      memberCount: members.length,
      spentUSD: teamSpent,
      remainingUSD: +(budget.total - budget.consumed).toFixed(2),
      openRecommendations: pipeline.recommendations.length,
      overBudgetTickets: pipeline.recommendations.filter((r) => !r.fitsBudget).length,
    },
    codebasePresent: pipeline.codebasePresent,
    indexedFiles: pipeline.indexedFiles,
    members: memberCards,
    // the prioritized queue, so a manager can see team-wide order at a glance
    queue: pipeline.recommendations,
  };
}

// ============================================================
// MEMBER VIEW — usage + history + their recommendations (the deep view)
// ============================================================
export async function getMemberDetail(id) {
  const member = getMember(id);
  if (!member) return null;

  const [usage, history, pipeline] = await Promise.all([
    getUsage(),
    getHistory(id),
    runPipeline(),
  ]);

  const u = usage[id] || { costUSD: 0, tokens: 0, ticketsWorked: 0, lastActiveTs: 0 };
  const recommendations = (recsByMember(pipeline.recommendations)[id] || []).sort(
    (a, b) => a.priorityRank - b.priorityRank
  );

  return {
    view: 'member',
    member,
    usage: {
      spentUSD: +u.costUSD.toFixed(2),
      tokens: u.tokens,
      ticketsWorked: u.ticketsWorked,
      weeklyBudgetUSD: member.weeklyBudgetUSD,
      budgetUsedPct: member.weeklyBudgetUSD ? Math.min(100, Math.round((u.costUSD / member.weeklyBudgetUSD) * 100)) : 0,
      lastActiveTs: u.lastActiveTs,
    },
    recommendations, // priority, cost, effort/time, model, rationale
    history,         // every ticket this member has worked, newest first
  };
}
