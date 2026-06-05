# TokenPilot — Hackathon Build Plan
### The autonomous cost-and-priority brain for your engineering backlog

> **One-line pitch:** Given your team's AI budget and your ticket priorities, an agent decides *what to work on, in what order, and which model to use for each* — to get the most important work done inside budget, with zero human tuning.

---

## ⏰ The Hard Timeline (read this first)

| Time | What's happening | What it means for you |
|------|------------------|------------------------|
| 09:30 | Check-in | Arrive 9:45 latest |
| 09:45–10:30 | Keynotes | Set up accounts/keys NOW (see Pre-Flight) |
| **10:30** | **Hacking starts** | Clock starts |
| 12:00–13:00 | Lunch | **Top 5 likely chosen here** |
| 13:00–15:00 | Mentoring (Top 5 only) | You want to be in this room |
| 15:30–16:30 | Final presentations (Top 5) | The win |

**Critical read:** Top 5 are picked around **noon**. That gives you ~90 minutes of real build (10:30–12:00) to have something working. **Part 1 must be done and demoable by ~11:45.** Everything else is bonus depth.

**Your known weakness:** over-engineering the backend before the demo layer works. Today that is the single thing that can sink you. Skeleton first, polish the screen second, depth last.

---

## 🎯 Problem Statement

Every team running AI in production is bleeding money on tokens, and the existing fixes (LiteLLM, Kong, Cloudflare AI Gateway) are **tools a human has to configure** — someone manually sets routing thresholds, compression rules, and cache settings, and re-tunes them every sprint.

Two things are missing from every existing solution:
1. **Autonomy** — nobody has an agent that *decides* the cost strategy by itself instead of being configured.
2. **Priority-awareness** — cost is optimized in a vacuum, disconnected from *what work actually matters*. A P0 critical bug and a P3 cleanup task get treated the same.

Nobody is connecting **AI cost** to the **engineering backlog**. Your team's most expensive resource (flagship-model tokens) is spent without regard to which tickets deserve it.

---

## 💡 Proposed Solution

An intelligence layer that sits **on top of the existing Jira board** (you do NOT rebuild Jira). It:

1. **Pulls** the tickets from the board.
2. **Enriches** each ticket with estimated AI token cost, estimated time, complexity, and a recommended model tier.
3. **Re-organizes** the backlog — sorted/grouped by priority, cost, or time, plus a budget-period view showing what fits.
4. **Decides autonomously** the optimal work order and which model to use per ticket, to maximize priority-weighted work inside the budget.
5. **Learns** — estimates sharpen every sprint, and when a model's price/quality changes, the routing policy revises itself.

**The reframe that makes it win, not sound like a dashboard:**
> Don't say "it shows cost per ticket." Say **"it decides what to work on and which model to use, by itself, to get the most important work done inside your budget."**

---

## 🧩 How the FOUR Platforms Map (all mandatory — miss one = disqualified)

| Platform | Role | What it concretely does |
|----------|------|--------------------------|
| **RocketRide** | The agent pipeline | Parallel agents score every ticket (cost, time, complexity); a planner agent produces the optimal order + model choice. This is your visible parallel-processing moment. |
| **Butterbase** | Backend + AUTH + model gateway | Ingests & stores tickets, budget state, enriched results; **auth / user accounts (now mandatory)**; serves live numbers to the UI; its **AI Model Gateway** is the actual model-switching mechanism (one key for every model). |
| **XTrace** | Memory + self-correction | Holds "tickets like this historically cost X / took Y"; makes estimates trustworthy; **reconciles contradictions** when a model's price/quality shifts supersede the old routing belief. Episodes = sprints; this is the depth beat judges reward. |
| **Photon (Spectrum)** | Delivery / distribution | Delivers the agent through a real messaging platform (**Slack** recommended for judging). The agent **proactively pushes** "P0 added, budget reallocated, here's the new order" AND answers natural-language queries in-channel. `npm i spectrum-ts`; keys at app.photon.codes. |

> **Why Photon makes the product BETTER, not just compliant:** TokenPilot's whole thesis is "less human input, comes to you." A messaging agent that pings the team the moment a P0 lands IS that thesis made real. Lead the pitch with it: *"it lives in your Slack — it tells you what changed before you even ask."*

> ⚠️ XTrace judging note: judges specifically reward using episodes/artifacts/contradiction reconciliation, NOT treating it as plain RAG. Lead your XTrace story with "it revises its own beliefs when reality contradicts them."

---

## 🛠️ Build in Two Parts

### PART 1 — The cost-aware backlog (MUST work by ~11:45)
The floor. If everything else breaks, this still demos in 60 seconds and gives you all-day talking material.

- Ingest tickets (see data decision below).
- Each ticket shows: **estimated token cost, estimated time, model-tier badge**.
- A **budget bar**: consumed vs. remaining for the period + burn rate ("dry by Thursday 2pm").
- Backlog **re-sorts** by priority / cost / time.
- Model tier in Part 1 can be a **simple rule** (P0→flagship badge, P3→cheap badge). It does NOT have to call a live model yet — it just has to *show* the intelligence convincingly and touch all three platforms honestly.

### PART 2 — The live optimizing agent (wins top 5 if time allows)
The depth. Build in order of demo impact:

1. **Live model switching** — a real query routes to a real model via Butterbase gateway; budget bar drops live. (highest visible wow)
2. **Context-aware downshifting** — once context is established on a ticket, follow-ups auto-route to a cheap model. (your core insight, made real)
3. **XTrace self-reconciliation** — simulate "a model got cheaper/better," XTrace revises, estimates/order update live. (the closing kicker)
4. **The "why" log** — one line per decision: *"routed to cheap model — context established, low complexity, P3 ticket."* (makes autonomy legible)

---

## 📥 Data Decision — LOCKED ✅

**No live Jira. No Jira API. Ingest a static dataset (Kaggle JSON/CSV).** Zero auth, never breaks live, fully under your control.

- Source: a Jira/issue-tracker dataset from Kaggle (you'll grab it). Search Kaggle for: `jira issues`, `jira tickets`, `software issues dataset`, `bug reports`, or `github issues`.
- Drop the file in `data/` as `tickets.csv` or `tickets.json`.
- Your ingestion layer normalizes it into the internal ticket shape (below) and loads into Butterbase.
- If the Kaggle dataset is missing fields (e.g. no priority), the ingest step **derives/assigns** them so every ticket has what the agent needs.

**Internal ticket shape (normalize everything to this):**
```json
{
  "id": "TICK-101",
  "title": "Checkout fails on Safari",
  "description": "Users on Safari 17 hit a 500 at payment step...",
  "priority": "P0",          // map from dataset; derive if absent
  "type": "bug",             // bug | feature | refactor | docs
  "status": "open"
}
```

> Don't have the dataset yet? **Start building now** with `data/seed_tickets.json` (Step 1 generates 8 realistic ones). Swap in the Kaggle file the moment you have it — the ingest layer normalizes both, so nothing downstream changes.

---

## ✈️ Pre-Flight Checklist (do during 09:45–10:30 keynotes)

- [ ] RocketRide account + API key working; one test pipeline runs
- [ ] Butterbase account + project created; DB reachable; AI Gateway key works (test one model call)
- [ ] XTrace account + Memory API key; one test write + read succeeds
- [ ] Claude Code set up and authenticated, repo initialized
- [ ] Pre-seeded ticket JSON file ready (write it tonight if you can)
- [ ] (Optional) Jira API token generated + one test pull working
- [ ] All keys in a `.env`, confirmed loading

> If any platform key isn't working, that's your first-30-min problem — not the logic.

---

## 🗺️ Step-by-Step Build Order

### Phase 0 — Skeleton (10:30–11:10) — wire all three platforms, ugly
**Goal: prove the pipes connect end-to-end before any real logic.**

1. Load pre-seeded tickets into Butterbase; confirm the front end can read them back.
2. One RocketRide call that returns a **fake** estimate for one ticket — just prove the pipeline fires and returns to your app.
3. One XTrace write ("ticket type X cost ~Y") + one read — prove memory round-trips.
4. Render the raw tickets on screen, unstyled. **Skeleton done = all three platforms touched + data on screen.**

> Do NOT make anything good yet. Just make it connected. This is the discipline step.

### Phase 1 — The demoable screen (11:10–11:45) — make it look real
**Goal: Part 1 complete and presentable before the noon cutoff.**

5. Per-ticket card: token-cost estimate, time estimate, model-tier badge.
6. Budget bar at top: consumed/remaining + burn rate.
7. Re-sort controls: by priority / cost / time.
8. Make it look genuinely good (this pays off more than backend for both judging AND networking — see frontend note below).

> **At 11:45 you should be able to demo Part 1 in 60 seconds.** This is your safety floor. Breathe.

### Lunch (12:00–13:00) — pitch, don't code
- Lock your 30-second verbal pitch (lead with autonomy).
- Talk to people. This is half your real goal.

### Phase 2 — The live agent (13:00 onward) — depth for the win
9. Real classifier agent scores ticket complexity (RocketRide).
10. Router agent: checks budget vs. priority → picks model → **actually calls it** via Butterbase gateway; budget bar drops live.
11. Context-aware downshifting: establish context once, downshift follow-ups.
12. XTrace reconciliation: simulate model price/quality change → beliefs revise → order/estimates update live.
13. The "why" log line per decision.

### Phase 3 — Polish for presentation (last 30 min before 15:30)
- Rehearse the 60-second demo until it's smooth.
- Pre-seed the XTrace "it re-learned" moment so the kicker fires reliably.
- Have a fallback: if live model calls flake, demo off cached results. **Never let a live API failure kill the demo.**

---

## 🎤 The 60-Second Demo Script

1. "Here's a normal sprint backlog — flat list, no idea what any of it costs in AI." *(raw board)*
2. "Watch the agent enrich every ticket in parallel." *(cards populate: cost, time, model badge; budget bar fills)*
3. "It re-orders the backlog to get the most important work done inside our weekly budget — by itself." *(re-sort animates)*
4. "P0 gets the flagship model; the P3 grunt work auto-routes to a cheap model once context is established." *(badges + live cost drop)*
5. **Kicker:** "A cheaper model just got better — watch it revise its own strategy." *(XTrace reconciles; estimates drop live)*
6. "No human touched a single dial."

---

## 🧠 Frontend Note
Before writing any UI, read the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` — it covers the design tokens and styling constraints for a polished look. A sharp-looking single screen beats a half-working full pipeline for both judging and networking. People remember what they *saw*; they can't see your backend.

---

## ✅ Scope Discipline Reminders
- Skeleton (all 3 platforms connected) BEFORE any real logic.
- The screen looking real BEFORE the backend being perfect.
- Part 1 is the floor — protect it. Don't gamble it for Part 2.
- Lead the pitch with **autonomy + priority**, never with "dashboard."
- Networking is half the goal — leave the laptop at lunch and at 5pm.

---

## 🏷️ Naming Options
TokenPilot · BudgetBrain · Backlog Economist · SpendSense · Quota · PriorityFuel
*(Pick one you can say confidently in a sentence.)*

---
---

# 🤖 CLAUDE CODE IMPLEMENTATION GUIDE
### Paste this section into Claude Code at 10:30. Build top-to-bottom. Don't skip ahead.

> **Context for Claude Code:** We're building **TokenPilot** — an agent layer on top of a Jira backlog that estimates AI token cost/time per ticket, decides which LLM to use per task (balancing context size vs. task criticality vs. model size), and tracks spend against a team budget. Stack: **RocketRide** (multi-agent pipeline), **Butterbase** (backend + AI model gateway), **XTrace** (memory + contradiction reconciliation). Solo build, ~90 min to first demo. Optimize for a working, good-looking demo over completeness. Build the skeleton end-to-end FIRST, make it look real SECOND, add real agent logic LAST.

---

## 📁 Project Structure (create this first)

```
tokenpilot/
├── .env                      # all API keys (RocketRide, Butterbase, XTrace, Jira optional)
├── .env.example
├── README.md
├── package.json
├── data/
│   ├── seed_tickets.json     # 8 realistic tickets — build with these NOW
│   └── tickets.csv|json      # Kaggle dataset — drop in when you have it
├── server/                   # backend (Node/Express or FastAPI — pick one, keep it thin)
│   ├── index.js              # entrypoint, routes
│   ├── butterbase.js         # Butterbase client: tickets, budget, spend state
│   ├── gateway.js            # Butterbase AI Gateway calls (model switching lives here)
│   ├── xtrace.js             # XTrace client: write/read memory, reconciliation
│   ├── rocketride.js         # RocketRide pipeline trigger + result parsing
│   └── ingest.js             # loads CSV/JSON dataset → normalizes → Butterbase
├── pipeline/
│   └── tokenpilot_pipeline.json   # RocketRide pipeline definition (estimator→budget→router→context→monitor)
└── web/                      # frontend (React/Next — single screen)
    ├── App.jsx               # the board view
    ├── components/
    │   ├── TicketCard.jsx    # cost, time, model badge per ticket
    │   ├── BudgetBar.jsx     # consumed/remaining + burn rate
    │   └── SortControls.jsx  # by priority / cost / time
    └── lib/api.js            # talks to server
```

> Keep backend and frontend in ONE repo. Don't split into microservices. Don't add a database you manage — Butterbase IS your DB.

---

## STEP 0 — Scaffold + keys (10:30–10:40, 10 min)

**Goal:** repo exists, keys load, all three platforms respond to a ping.

**Tell Claude Code:**
> "Scaffold the project structure above. Create `.env.example` with placeholders for ROCKETRIDE_API_KEY, BUTTERBASE_API_KEY, BUTTERBASE_PROJECT_URL, BUTTERBASE_GATEWAY_KEY, XTRACE_API_KEY, and optional JIRA_TOKEN/JIRA_DOMAIN. Set up a thin Express server with a `/health` route, and a Vite+React frontend with one empty board screen. Don't write any logic yet."

**Then verify each key with a one-line test call** (do these yourself, don't let it stall the build):
- Butterbase: write one row, read it back.
- XTrace: write one memory, search it.
- RocketRide: trigger the simplest possible pipeline, get a response.

> ⚠️ If a key fails, THIS is your first-30-min problem. Fix it before any logic.

---

## STEP 1 — Dataset ingestion + normalization (10:40–10:55, 15 min)

**Goal:** tickets flow from a data file → normalized → Butterbase → screen. Works with seed data now, Kaggle file later.

**Tell Claude Code:**
> "Create `data/seed_tickets.json` with 8 realistic sprint tickets — mix of priorities (2× P0, 2× P1, 2× P2, 2× P3) and types (bug, feature, refactor, docs), each with `id, title, description, priority, type, status`. Then write `ingest.js` that: (1) reads EITHER a CSV or JSON file from `data/` (auto-detect by extension; use a CSV parser for .csv), (2) **normalizes** each row into the internal shape `{id, title, description, priority, type, status}`, (3) if `priority` or `type` is missing, derives a sensible value (e.g. keyword-match the title/description, or distribute priorities), (4) loads the normalized tickets into Butterbase. Make the input filename configurable via an env var `DATASET_PATH` defaulting to `data/seed_tickets.json`. Write a `/tickets` route returning all tickets from Butterbase, and render them as a plain unstyled list."

**Checkpoint:** raw tickets visible on screen, served from Butterbase. **Swapping to the Kaggle dataset later = change `DATASET_PATH`, nothing else.**

---

## STEP 2 — Skeleton enrichment, FAKE numbers (10:50–11:05, 15 min)

**Goal:** prove the full pipe (RocketRide + XTrace) round-trips before real logic.

**Tell Claude Code:**
> "Write `rocketride.js` to call a RocketRide pipeline that takes a ticket and returns `{estimatedTokens, estimatedMinutes, complexity, modelTier}`. For now the pipeline can return hardcoded/random plausible values. Write `xtrace.js` with `writeMemory(fact)` and `searchMemory(query)`. On ticket load, for each ticket: call RocketRide for an estimate, write a memory to XTrace ('ticket type X estimated at Y tokens'). Store enriched results back in Butterbase."

**Checkpoint:** every ticket now has (fake) cost/time/model + a memory exists in XTrace. **All three platforms are now touched end-to-end. This is the skeleton complete.** ✅

> Do NOT improve the numbers yet. Move to making it look real.

---

## STEP 3 — Make it LOOK real (11:05–11:45, 40 min) ← protect this

**Goal:** Part 1 demoable. This is your floor. Polish here beats backend depth.

> **First, read `/mnt/skills/public/frontend-design/SKILL.md`** for styling tokens/constraints, then build.

**Tell Claude Code:**
> "Build the real UI. `TicketCard.jsx`: show title, priority badge, estimated token cost ($ + token count), estimated time, and a model-tier badge (color-coded: flagship=purple, mid=blue, cheap=green). `BudgetBar.jsx`: a horizontal bar at top showing consumed vs. remaining for the period, plus a burn-rate line ('at this pace, budget exhausted by Thursday 2pm'). `SortControls.jsx`: buttons to re-sort the board by priority / cost / time, animating the reorder. Make it clean, modern, dark-mode, confident. This is a demo — it should look like a real product."

**Checkpoint at 11:45:** you can demo Part 1 in 60 seconds — board enriches, budget bar fills, re-sorts on click. **Breathe. You have a safe submission.**

---

## LUNCH (12:00–13:00) — pitch, don't code. Talk to people.

---

## STEP 4 — Real estimator + router (13:00–13:40)

**Goal:** numbers become real agent decisions.

**Tell Claude Code:**
> "Replace the fake RocketRide pipeline with a real multi-agent flow in `pipeline/tokenpilot_pipeline.json`: (1) Estimator agent — given ticket text + priority, and past costs retrieved from XTrace, output token/time/complexity estimates. (2) Budget agent — given all estimates + remaining quota + priorities, output an optimal work ORDER. (3) Router agent — per ticket, decide model tier by balancing context size vs. criticality vs. model size. Wire estimator to actually query XTrace for 'tickets like this' before estimating."

---

## STEP 5 — Live model switching (13:40–14:20) ← biggest demo wow

**Goal:** a real query hits a real model via Butterbase gateway; budget drops live.

**Tell Claude Code:**
> "In `gateway.js`, implement `callModel(tier, prompt)` using Butterbase's AI Model Gateway — flagship tier → a frontier model, cheap tier → a small model. Add a `/work/:ticketId` route: router picks the tier, calls the model through the gateway, captures real token usage, decrements the Butterbase budget, and returns the result + cost. On the UI, show the budget bar dropping live when a ticket is worked, and a one-line 'why' log: 'routed to cheap model — context established, low complexity, P3'."

---

## STEP 5.5 — Photon messaging delivery (MANDATORY — don't skip)

**Goal:** the agent is reachable + proactive through a real messaging platform (Slack).

**Tell Claude Code:**
> "Install `spectrum-ts`. Sign-up at app.photon.codes gives PROJECT_ID + SECRET (put in .env). In `server/photon.js`, replace the fallback: create the Spectrum client with a Slack provider, register `spectrum.onMessage` to call our `agentBrain(text)` and reply with `space.send(reply)`. Keep `pushNotification()` working so the P0/budget-low pushes from `/work/:id` go out to PHOTON_TARGET. Test: message the agent 'what should I work on next?' and confirm it replies in Slack; work a P0 and confirm the proactive push lands."

**Already built for you (fallback works now):** `agentBrain()` answers "what's next / budget / status" grounded in the live board + XTrace; `/work/:id` already fires a proactive push on P0 and on low budget. You're just swapping console-fallback for the real Slack channel.

**Checkpoint:** message in → agent replies in Slack; P0 worked → team gets pinged unprompted. **This satisfies the Photon requirement AND is your best demo moment.**

---

## STEP 6 — Context downshift + XTrace reconciliation (14:20–15:00)

**Goal:** the two depth beats that win.

**Tell Claude Code:**
> "(A) Context downshift: add a `contextSummary` per ticket in Butterbase. First call on a ticket uses flagship + builds the summary; subsequent calls pass the summary and downshift to a cheap model. (B) XTrace reconciliation: add a `/simulate-model-update` route that writes a contradicting memory ('cheap model now matches flagship quality on task type X'). XTrace supersedes the old belief; re-run estimates so the board's model badges and budget projection update live. This is the closing demo kicker."

---

## STEP 7 — Polish + rehearse (15:00–15:30)

- Rehearse the 60-second demo until smooth.
- Pre-seed the XTrace reconciliation memory so the kicker fires reliably on cue.
- **Fallback:** if live model calls flake, demo off cached enriched results. Never let a live API failure kill the demo.
- Have the 3 pitch lines (hook / depth / stack) ready.

---

## 🔑 Rules for Claude Code (give it these up front)

1. **Skeleton end-to-end before real logic.** Fake numbers are fine until Step 4.
2. **Butterbase is the database** — do not stand up Postgres/Mongo/anything else.
3. **Don't refactor for elegance.** This ships in hours, not weeks.
4. **One repo, thin server, one frontend screen.** No microservices, no auth flows beyond what Butterbase gives free.
5. **Every platform must do real work** (deep-integration requirement): RocketRide = pipeline, Butterbase = backend+gateway, XTrace = memory+reconciliation. Never stub one out.
6. **If something blocks for >10 min, fake it convincingly and move on.** The demo matters more than the plumbing.

---

## 🧯 If You Fall Behind — Cut in This Order
1. Cut Step 6B (XTrace reconciliation) — keep it as a slide/verbal claim.
2. Cut Step 6A (context downshift) — verbal claim.
3. Cut Step 5 (live model calls) — keep model SWITCHING as a rule-based badge (Step 3), demo off that.
4. **NEVER cut Step 5.5 (Photon)** — it's mandatory; missing it = disqualification. Even a single working Slack message + one proactive push satisfies it. The fallback already works; you just need the real keys wired.
5. **NEVER cut Step 3.** The good-looking board is the floor that protects both the win AND the networking.

> ⚠️ The two uncuttable items are **Step 3 (the board)** and **Step 5.5 (Photon delivery)**. Everything else is negotiable. All four platforms (RocketRide, Butterbase incl. auth, XTrace, Photon) must be touched or you're disqualified — the starter repo already touches all four via fallbacks, so even a light real-wiring of each clears the bar.
