# TokenPilot 🪄

**The autonomous cost-and-priority brain for your engineering backlog.**

Given your team's AI budget and your ticket priorities, TokenPilot decides *what to work on, in what order, and which model to use for each task* — to get the most important work done inside budget, with zero human tuning.

Stack (all FOUR mandatory): **RocketRide** (pipeline) · **Butterbase** (backend + auth + AI gateway) · **XTrace** (memory + reconciliation) · **Photon/Spectrum** (messaging delivery — Slack).

---

## The two-agent design

TokenPilot runs **two cooperating agents**. Agent 1 has the context; Agent 2 makes the call.

```
input/codebase/  +  jira tickets
        │
        ▼
┌──────────────────────┐   intel    ┌──────────────────────────┐   recommendations
│  AGENT 1             │ ─────────▶ │  AGENT 2                 │ ─────────────────▶  dashboards
│  Codebase Intelligence│            │  Advisory / Recommender  │
│  (analyzer.js)       │            │  (recommender.js)        │
└──────────────────────┘            └──────────────────────────┘
 scans the whole codebase,           consumes Agent 1's intel and decides:
 finds the files each ticket          priority order · cost ($) · effort/time ·
 touches, scope/LOC, complexity        model tier · suggested assignee · "why"
```

- **Agent 1 — Codebase Intelligence** (`server/agents/analyzer.js`): reads everything in `input/codebase/`, and for each ticket produces *intel* — related files, touched areas, change-surface size (LOC), complexity signals, a summary.
- **Agent 2 — Advisory** (`server/agents/recommender.js`): never reads the codebase itself. It consumes Agent 1's intel and outputs the recommendations the dashboards show.
- The handoff is one function: `server/agents/orchestrator.js → runPipeline()`.

Both agents run on **heuristic fallbacks today** so everything works before any API keys. Wire the real codebase-aware LLM (via the Butterbase gateway) later and keep the output shapes identical — nothing downstream changes.

## The two dashboards

| View | Who | Shows |
|------|-----|-------|
| **Manager** | Team lead | Each member's **current usage** + load, the team budget, and the team-wide prioritized queue. **No per-event history** — the "now". |
| **Member** | Individual | That member's usage, their Agent-2 **recommendations** (priority/cost/effort, with a *Work* action), and their **full history** of worked tickets. |

Switch with the **Manager / Member** toggle (top right); click any member card in the manager view to jump to their dashboard.

---

## Quickstart

```bash
# 1. install
npm install
cd web && npm install && cd ..

# 2. keys — fill in .env from .env.example (optional; runs on fallbacks without them)
cp .env.example .env

# 3. run backend (auto-loads tickets from input/jira/, else data/seed_tickets.json)
node server/index.js            # :3001

# 4. run frontend (separate terminal)
cd web && npm run dev           # :5173
```

## Giving it your data — the `input/` folder

Paste your real data into the **held** `input/` folder (its contents are git-ignored, so paste freely):

- **`input/codebase/`** — drop the repo you want analyzed here. Agent 1 indexes it.
- **`input/jira/`** — drop exported Jira tickets (`.json`/`.csv`, any column names). Falls back to `data/seed_tickets.json` if empty.

See `input/README.md` for details. Both have safe fallbacks, so the app runs end-to-end before you paste anything.

## Internal ticket shape
```json
{ "id": "TICK-101", "title": "...", "description": "...", "priority": "P0", "type": "bug", "status": "open" }
```

---

## API routes

| Route | Purpose |
|-------|---------|
| `GET /health` | per-platform + per-agent status (live vs. fallback) |
| `GET /tickets` | raw normalized tickets |
| `GET /intel` | **Agent 1** output — codebase intel per ticket |
| `GET /recommendations` | **Agent 1 + 2** — full pipeline result |
| `GET /team` | **Manager dashboard** — usage per member + team queue (no history) |
| `GET /team/:id` | **Member dashboard** — usage + history + their recommendations |
| `POST /work/:id` | route → call model via gateway → bill → attribute usage to a member |
| `POST /chat` | the agent brain (what Photon delivers to Slack) |
| `POST /simulate-model-update` | XTrace reconciliation demo kicker |

## The pieces

| File | Does |
|------|------|
| `server/inputs.js` | reads `input/codebase/` + `input/jira/` (with fallbacks) |
| `server/agents/analyzer.js` | **Agent 1** — codebase intelligence |
| `server/agents/recommender.js` | **Agent 2** — priority/cost/effort recommendations |
| `server/agents/orchestrator.js` | runs Agent 1 → Agent 2 (`runPipeline`) |
| `server/team.js` | roster + assembles the manager & member dashboards |
| `server/butterbase.js` | tickets, budget, **per-member usage + history** |
| `server/gateway.js` | Butterbase AI Gateway — model switching |
| `server/xtrace.js` | XTrace memory: write/search + reconciliation |
| `server/rocketride.js` | estimate / route / order heuristics (→ real pipeline) |
| `server/photon.js` · `auth.js` | Slack delivery · Butterbase auth |
| `server/index.js` | Express routes |
| `web/src/views/ManagerView.jsx` · `MemberView.jsx` | the two dashboards |
| `data/team_members.json` | the team roster (id, role, skills, weekly budget) |

## Status: APIs pending

Everything runs on fallbacks. When you provide keys, each module flips to its real platform call — `/health` shows which are `connected` vs `*-fallback`. The build plan and key setup live in `hackathon_build_plan.md` and `tokenpilot_keys_setup.md`.
