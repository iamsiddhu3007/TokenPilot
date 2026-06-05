// index.js — Express entrypoint. Thin routing layer over the four modules.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import {
  getTickets, saveTickets, getBudget, addSpend, updateTicket,
  recordUsage, butterbaseStatus,
} from './butterbase.js';
import {
  enrichAll, optimalOrder, estimateTicket, routeTicket, rocketrideStatus,
} from './rocketride.js';
import { callModel, gatewayStatus, TIER_PRICE_PER_1K } from './gateway.js';
import {
  writeMemory, searchMemory, reconcile, xtraceStatus, _allFacts,
} from './xtrace.js';
import { initPhoton, pushNotification, handleInboundFallback, photonStatus } from './photon.js';
import { signUp, logIn, requireAuth, authStatus } from './auth.js';

import { runPipeline } from './agents/orchestrator.js';
import { analyzeAll, analyzerStatus } from './agents/analyzer.js';
import { getManagerOverview, getMemberDetail } from './team.js';
import { loadJiraTickets } from './inputs.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- health: shows which platforms are live vs. fallback ---
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    butterbase: butterbaseStatus(),
    auth: authStatus(),
    rocketride: rocketrideStatus(),
    analyzer: analyzerStatus(),
    gateway: gatewayStatus(),
    xtrace: xtraceStatus(),
    photon: photonStatus(),
  });
});

// ============================================================
// AUTH (Butterbase — mandatory)
// ============================================================
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  res.json(await signUp(email, password));
});
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  res.json(await logIn(email, password));
});

// ============================================================
// THE AGENT BRAIN — natural-language queries over the backlog.
// This is what Photon delivers to Slack/iMessage. Same logic, any channel.
// ============================================================
async function agentBrain(text) {
  const q = (text || '').toLowerCase();
  const tickets = await getTickets();
  const enriched = await enrichAll(tickets);
  const budget = await getBudget();
  const remaining = budget.total - budget.consumed;
  const ordered = optimalOrder(enriched, remaining);

  // ground the answer in XTrace memory
  await writeMemory({ text: `User asked via messaging: "${text}"`, key: 'episode:chat' });

  if (q.includes('budget') || q.includes('spend') || q.includes('left')) {
    return `💰 Budget (${budget.period}): $${budget.consumed.toFixed(2)} used of $${budget.total} — $${remaining.toFixed(2)} left.`;
  }
  if (q.includes('next') || q.includes('work on') || q.includes('priorit') || q.includes('what should')) {
    const top = ordered.filter((t) => t.fitsBudget).slice(0, 3);
    return `🎯 Optimal next work (fits budget):\n` +
      top.map((t, i) => `${i + 1}. ${t.id} [${t.priority}] ${t.title} → ${t.modelTier} model ($${t.projectedCostUSD})`).join('\n');
  }
  // default: a quick board summary
  const overBudget = ordered.filter((t) => !t.fitsBudget).length;
  return `📋 ${ordered.length} tickets. Top: ${ordered[0].id} [${ordered[0].priority}] → ${ordered[0].modelTier}. ` +
    `$${remaining.toFixed(2)} budget left${overBudget ? `, ${overBudget} tickets don't fit.` : '.'}`;
}

// Inbound message route (fallback for Photon — POST what a user would text).
app.post('/chat', async (req, res) => {
  const reply = await handleInboundFallback(req.body?.text || '');
  res.json({ reply });
});

// --- raw tickets (Step 1) ---
app.get('/tickets', async (_req, res) => {
  res.json(await getTickets());
});

// --- enriched + optimally ordered board (Steps 2–4) ---
app.get('/board', async (_req, res) => {
  const tickets = await getTickets();
  const enriched = await enrichAll(tickets);

  // write memories from this enrichment pass (so XTrace has real content)
  for (const t of enriched) {
    await writeMemory({
      text: `Ticket type ${t.type} estimated at ~${t.estimatedTokens} tokens (${t.complexity}).`,
      key: `type=${t.type}`,
      value: t.estimatedTokens,
    });
  }

  const budget = await getBudget();
  const remaining = budget.total - budget.consumed;
  const ordered = optimalOrder(enriched, remaining);

  res.json({ budget, remaining, tickets: ordered });
});

app.get('/budget', async (_req, res) => res.json(await getBudget()));

// ============================================================
// TWO-AGENT PIPELINE
//   Agent 1 (analyzer) → intel ;  Agent 2 (recommender) → recommendations
// ============================================================

// Agent 1 only: codebase intelligence per ticket.
app.get('/intel', async (_req, res) => {
  const tickets = await getTickets();
  res.json(await analyzeAll(tickets));
});

// Full pipeline: Agent 1 + Agent 2 (priority, cost, effort/time, model, assignee).
app.get('/recommendations', async (_req, res) => {
  res.json(await runPipeline());
});

// ============================================================
// DASHBOARDS
//   /team       → MANAGER view: each member's usage + team board (no history)
//   /team/:id   → MEMBER view : usage + history + their recommendations
// ============================================================
app.get('/team', async (_req, res) => {
  res.json(await getManagerOverview());
});

app.get('/team/:id', async (req, res) => {
  const detail = await getMemberDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'member not found' });
  res.json(detail);
});

// --- actually WORK a ticket: route → call model via gateway → bill (Step 5) ---
app.post('/work/:id', requireAuth, async (req, res) => {
  const tickets = await getTickets();
  const ticket = tickets.find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });

  const est = await estimateTicket(ticket);
  const hasContext = !!ticket.contextSummary;
  // Honor a manually-selected model tier from the UI dropdown; else auto-route.
  const route = req.body?.tier
    ? { tier: req.body.tier, why: `manually selected ${req.body.tier} model` }
    : routeTicket(ticket, est.complexity, hasContext);

  const prompt = ticket.contextSummary
    ? `Context: ${ticket.contextSummary}\n\nTask: ${ticket.title}\n${ticket.description}`
    : `Task: ${ticket.title}\n${ticket.description}`;

  const result = await callModel(route.tier, prompt);

  // EXPECTED vs ACTUAL cost. The UI sends the expected (recommended) cost it
  // displayed; the "real" cost used is that expected figure with random usage
  // variance applied (simulated actual consumption). Falls back to a token-based
  // estimate if no expected cost was provided (e.g. a raw curl).
  const expectedCostUSD = req.body?.expectedCostUSD != null
    ? Number(req.body.expectedCostUSD)
    : +((est.estimatedTokens / 1000) * (TIER_PRICE_PER_1K[route.tier] ?? 0.003)).toFixed(2);
  const jitter = 0.75 + Math.random() * 0.7;                  // 0.75x – 1.45x
  const actualCostUSD = +Math.max(0.0001, expectedCostUSD * jitter).toFixed(4);

  await addSpend(actualCostUSD);

  // attribute this work to a team member so the dashboards have usage + history.
  // Assignee comes from the request, else from Agent 2's recommendation.
  let assigneeId = req.body?.assigneeId;
  let effortHours = +(est.estimatedMinutes / 60).toFixed(1) || 1;
  if (!assigneeId) {
    const pipe = await runPipeline();
    const rec = pipe.recommendations.find((r) => r.ticketId === ticket.id);
    assigneeId = rec?.assignee?.id;
    if (rec) effortHours = rec.estimatedEffortHours;
  }
  await recordUsage(assigneeId, {
    ticketId: ticket.id,
    title: ticket.title,
    priority: ticket.priority,
    tier: result.tier,
    model: result.model,
    costUSD: actualCostUSD,
    tokens: (result.inputTokens || 0) + (result.outputTokens || 0),
    effortHours,
  });

  // Mark the ticket COMPLETED with its real (random) cost so the dashboards can
  // show "expected → actual". Establish context too (downshifts any re-run).
  const completedAt = Date.now();
  await updateTicket(ticket.id, {
    status: 'completed',
    completedAt,
    actualCostUSD,
    estimatedCostUSD: expectedCostUSD,
    contextSummary: ticket.contextSummary
      || `Completed ${ticket.type}: ${ticket.title}. Key details captured.`,
  });

  // PROACTIVE PHOTON PUSH: high-priority work triggers a team notification.
  const budget = await getBudget();
  const remaining = budget.total - budget.consumed;
  if (ticket.priority === 'P0') {
    await pushNotification(
      process.env.PHOTON_TARGET,
      `🚨 P0 completed: ${ticket.id} "${ticket.title}" via ${result.tier} model ($${actualCostUSD}). Budget left: $${remaining.toFixed(2)}.`
    );
  }
  if (remaining < budget.total * 0.15) {
    await pushNotification(
      process.env.PHOTON_TARGET,
      `⚠️ Budget low: only $${remaining.toFixed(2)} left this ${budget.period}. Throttling non-critical tickets to cheap models.`
    );
  }

  res.json({
    ticket: ticket.id,
    routedTo: result.tier,
    model: result.model,
    why: route.why,
    estimatedCostUSD: expectedCostUSD,
    actualCostUSD,
    cost: actualCostUSD,
    completed: true,
    completedAt,
    assignedTo: assigneeId || null,
    simulated: result.simulated || false,
    budget,
  });
});

// --- XTrace inspection: current beliefs + version history (UI panel) ---
app.get('/memory', async (req, res) => {
  if (req.query.q) return res.json(await searchMemory(String(req.query.q)));
  res.json(_allFacts());
});

// --- the demo KICKER: a model got cheaper/better → reconcile → re-enrich (Step 6) ---
app.post('/simulate-model-update', async (_req, res) => {
  const r = await reconcile(
    'route:type=feature',
    'cheap',
    'Cheap model now matches flagship quality on feature tasks — route features cheap.'
  );
  // re-run the board so estimates/badges shift live
  const tickets = await getTickets();
  const enriched = await enrichAll(tickets);
  const budget = await getBudget();
  const ordered = optimalOrder(enriched, budget.total - budget.consumed);
  res.json({ reconciled: r, budget, tickets: ordered });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`TokenPilot server on :${PORT}`);

  // Auto-load tickets if none are present yet: prefer input/jira/, else seed.
  const existing = await getTickets();
  if (!existing.length) {
    const { tickets, source, codebasePresent } = loadJiraTickets();
    await saveTickets(tickets);
    console.log(`[ingest] loaded ${tickets.length} tickets from ${source}` +
      (codebasePresent ? '' : ' (no codebase pasted yet — Agent 1 in text-only mode)'));
  }

  // Register the agent brain with Photon so messaging delivers it.
  await initPhoton(agentBrain);
  console.log('Platform status →', {
    butterbase: butterbaseStatus(),
    auth: authStatus(),
    rocketride: rocketrideStatus(),
    analyzer: analyzerStatus(),
    gateway: gatewayStatus(),
    xtrace: xtraceStatus(),
    photon: photonStatus(),
  });
});
