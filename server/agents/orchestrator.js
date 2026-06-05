// agents/orchestrator.js — runs the two-agent pipeline.
//
//   Agent 1 (analyzer)  ──intel──▶  Agent 2 (recommender)  ──▶  recommendations
//
// Agent 1 scores tickets against the codebase in parallel; Agent 2 then turns
// that information into priority/cost/effort recommendations + assignments.
// One function the dashboards and routes all call.

import { getTickets, getBudget, getUsage } from '../butterbase.js';
import { analyzeAll, analyzerStatus } from './analyzer.js';
import { recommendAll } from './recommender.js';
import { loadMembers } from '../team.js';

export async function runPipeline() {
  const tickets = await getTickets();

  // --- Agent 1: codebase intelligence (parallel over tickets) ---
  const { intel, indexedFiles, codebasePresent } = await analyzeAll(tickets);

  // --- gather context Agent 2 needs ---
  const [budget, usage] = await Promise.all([getBudget(), getUsage()]);
  const members = loadMembers();
  const remaining = budget.total - budget.consumed;

  // --- Agent 2: recommendations (priority, cost, effort, model, assignee) ---
  const recommendations = await recommendAll(tickets, intel, {
    members,
    usage,
    remainingBudget: remaining,
  });

  return {
    codebasePresent,
    indexedFiles,
    analyzer: analyzerStatus(),
    budget,
    remaining: +remaining.toFixed(2),
    intel,
    recommendations,
  };
}
