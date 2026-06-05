// index.js — Express entrypoint. Thin routing layer over the four modules.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import {
  getTickets, getBudget, addSpend, updateTicket, butterbaseStatus,
} from './butterbase.js';
import {
  enrichAll, optimalOrder, estimateTicket, routeTicket, rocketrideStatus,
} from './rocketride.js';
import { callModel, gatewayStatus } from './gateway.js';
import {
  writeMemory, searchMemory, reconcile, xtraceStatus, _allFacts,
} from './xtrace.js';
import { initPhoton, pushNotification, handleInboundFallback, photonStatus } from './photon.js';
import { signUp, logIn, requireAuth, authStatus } from './auth.js';

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

// --- actually WORK a ticket: route → call model via gateway → bill (Step 5) ---
app.post('/work/:id', requireAuth, async (req, res) => {
  const tickets = await getTickets();
  const ticket = tickets.find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ticket not found' });

  const est = await estimateTicket(ticket);
  const hasContext = !!ticket.contextSummary;
  const route = routeTicket(ticket, est.complexity, hasContext);

  const prompt = ticket.contextSummary
    ? `Context: ${ticket.contextSummary}\n\nTask: ${ticket.title}\n${ticket.description}`
    : `Task: ${ticket.title}\n${ticket.description}`;

  const result = await callModel(route.tier, prompt);
  await addSpend(result.costUSD);

  // establish context after first (expensive) pass so next call can downshift
  if (!hasContext) {
    await updateTicket(ticket.id, {
      contextSummary: `Working on ${ticket.type}: ${ticket.title}. Key details captured.`,
    });
  }

  // PROACTIVE PHOTON PUSH: high-priority work triggers a team notification.
  const budget = await getBudget();
  const remaining = budget.total - budget.consumed;
  if (ticket.priority === 'P0') {
    await pushNotification(
      process.env.PHOTON_TARGET,
      `🚨 P0 worked: ${ticket.id} "${ticket.title}" via ${result.tier} model ($${result.costUSD}). Budget left: $${remaining.toFixed(2)}.`
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
    cost: result.costUSD,
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
  // Register the agent brain with Photon so messaging delivers it.
  await initPhoton(agentBrain);
  console.log('Platform status →', {
    butterbase: butterbaseStatus(),
    auth: authStatus(),
    rocketride: rocketrideStatus(),
    gateway: gatewayStatus(),
    xtrace: xtraceStatus(),
    photon: photonStatus(),
  });
});
