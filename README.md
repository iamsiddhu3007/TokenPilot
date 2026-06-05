# TokenPilot 🪄

**The autonomous cost-and-priority brain for your engineering backlog.**

Given your team's AI budget and your ticket priorities, TokenPilot decides *what to work on, in what order, and which model to use for each task* — to get the most important work done inside budget, with zero human tuning. It reads your real codebase and your real tickets, routes each task to the right‑sized **Claude** model, bills every call against a team/per‑member budget, and proactively messages the team when priorities shift.

Built on four sponsor platforms:

| Platform | Role in TokenPilot |
|---|---|
| **RocketRide** | the multi‑agent pipeline runtime (estimate → budget → route → context → monitor) |
| **Butterbase** | backend (tickets, budget, usage) **+ auth + the AI Model Gateway** that does the actual model switching |
| **XTrace** | the memory layer — facts/episodes about ticket costs, plus contradiction/supersede reconciliation |
| **Photon / Spectrum** | messaging delivery — the agent answers in‑channel **and** proactively pushes alerts (iMessage) |

![TokenPilot manager dashboard](docs/dashboard-manager.png)

---

## Table of contents

1. [How it works — the two‑agent design](#how-it-works--the-two-agent-design)
2. [The two dashboards](#the-two-dashboards)
3. [Prerequisites](#prerequisites)
4. [Quickstart (TL;DR)](#quickstart-tldr)
5. [Environment configuration (`.env`)](#environment-configuration-env)
6. [The Butterbase MCP server](#the-butterbase-mcp-server)
7. [Giving it data — repo + tickets](#giving-it-data--repo--tickets)
8. [Running the project](#running-the-project)
9. [Verifying everything works](#verifying-everything-works)
10. [Features](#features)
11. [API reference](#api-reference)
12. [Platform integration status](#platform-integration-status)
13. [Messaging (Photon / iMessage)](#messaging-photon--imessage)
14. [Project structure](#project-structure)
15. [Troubleshooting](#troubleshooting)
16. [Roadmap / upgrades](#roadmap--upgrades)

---

## How it works — the two‑agent design

TokenPilot runs **two cooperating agents**. Agent 1 has the context; Agent 2 makes the call.

```
input/codebase/  +  input/jira/ (tickets)
        │
        ▼
┌───────────────────────┐   intel    ┌──────────────────────────┐   recommendations
│  AGENT 1              │ ─────────▶ │  AGENT 2                 │ ─────────────────▶  dashboards
│  Codebase Intelligence│            │  Advisory / Recommender  │                     + messaging
│  (analyzer.js)        │            │  (recommender.js)        │
└───────────────────────┘            └──────────────────────────┘
 scans the whole codebase,            consumes Agent 1's intel and decides:
 finds the files each ticket          priority order · cost ($) · effort/time ·
 touches, scope/LOC, complexity        model tier · suggested assignee · "why"
```

- **Agent 1 — Codebase Intelligence** (`server/agents/analyzer.js`): recursively reads everything in `input/codebase/` (skipping `node_modules`, `.git`, build output, binaries) and, for each ticket, produces *intel* — related files, touched areas, change‑surface size (LOC), complexity signals, a summary.
- **Agent 2 — Advisory / Recommender** (`server/agents/recommender.js`): never reads the codebase itself. It consumes Agent 1's intel + the team roster + current usage + remaining budget, and outputs the recommendations the dashboards render — **priority order, projected cost, effort/time, model tier, suggested assignee, and a one‑line "why."**
- The handoff is one function: `server/agents/orchestrator.js → runPipeline()`.

**Model routing.** Each ticket is routed to a Claude tier by priority + complexity + whether context is already established:

| Tier | Model | When |
|---|---|---|
| `flagship` | `claude-opus-4-8` | P0 / heavy reasoning |
| `mid` | `claude-sonnet-4-6` | moderate work |
| `cheap` | `claude-haiku-4-5` | grunt work / once context is established |

The actual model call goes through the **Butterbase AI Gateway** (`server/gateway.js`). Switching models = changing one string — that's the whole point.

## The two dashboards

| View | Who | Shows |
|------|-----|-------|
| **Manager** | Team lead | Each member's **current usage** + load, the team budget, and the team‑wide prioritized queue. **No per‑event history** — the "now." |
| **Member** | Individual | That member's usage, their Agent‑2 **recommendations** (priority/cost/effort, with a *Work* action), and their **full history** of worked tickets. |

Switch with the **Manager / Member** toggle (top right); click any member card in the manager view to jump to their dashboard.

---

## Prerequisites

- **Node.js ≥ 18** (the project uses native `fetch` and ESM). Tested on Node 26.
- **npm** (bundled with Node).
- Optional, for full live mode:
  - **Docker** — to run the self‑hosted RocketRide engine.
  - A **Butterbase** account (DB + AI Gateway), an **XTrace** account (memory), and a **Photon** project (messaging). All have graceful fallbacks, so the app runs end‑to‑end without them.
  - **`gh`** (GitHub CLI) — only if you want to pull a repo's issues as tickets the way the demo does.

## Quickstart (TL;DR)

```bash
# 1. install backend + frontend deps
npm install
cd web && npm install && cd ..

# 2. create your env file (runs on fallbacks even if left mostly blank)
cp .env.example .env        # then fill in keys — see "Environment configuration" below

# 3. (optional) give it real data — see "Giving it data"
#    else it falls back to data/seed_tickets.json automatically

# 4. run the backend            (auto-loads tickets on boot)
npm start                   # → http://localhost:3001

# 5. run the frontend (new terminal)
cd web && npm run dev       # → http://localhost:5173
```

Open **http://localhost:5173**. That's the whole app.

> **It runs before you configure anything.** Every platform has a fallback, so you get working dashboards immediately and flip each platform to "live" as you add keys.

---

## Environment configuration (`.env`)

Copy `.env.example` → `.env` and fill what you have. Every variable, what it's for, and where to get it:

### RocketRide — the pipeline runtime
| Variable | Required? | Notes |
|---|---|---|
| `ROCKETRIDE_API_KEY` | Only for **RocketRide Cloud** | Leave **blank** for self‑hosted. |
| `ROCKETRIDE_ENDPOINT` | Yes | Self‑hosted: `ws://localhost:5565`. Cloud: `https://api.rocketride.ai`. |

RocketRide is open‑source. Self‑host the engine with Docker (no key needed):
```bash
docker pull ghcr.io/rocketride-org/rocketride-engine:latest
docker create --name rocketride-engine -p 5565:5565 ghcr.io/rocketride-org/rocketride-engine:latest
docker start rocketride-engine
```
Build your `.pipe` pipeline visually with the **RocketRide VS Code extension**.

### Butterbase — backend + auth + AI Gateway
| Variable | Required? | Notes |
|---|---|---|
| `BUTTERBASE_API_KEY` | Yes | `bb_sk_…` — project API key (DB + auth). |
| `BUTTERBASE_PROJECT_URL` | For real DB | Project URL/ID from Butterbase settings. Until set, the DB uses an in‑memory store. |
| `BUTTERBASE_GATEWAY_KEY` | For real model calls | Bearer token for the AI Gateway. |
| `BUTTERBASE_APP_ID` | For real model calls | The `{app_id}` in `https://api.butterbase.ai/v1/{app_id}/chat/completions`. |
| `BUTTERBASE_GATEWAY_URL` | No | Override gateway base (default `https://api.butterbase.ai/v1`). |
| `BUTTERBASE_MODEL_FLAGSHIP` / `_MID` / `_CHEAP` | No | Override the gateway model slugs (default `anthropic/claude-opus-4-8`, `…sonnet-4-6`, `…haiku-4-5`). |

The gateway is **OpenAI‑compatible**: `POST /v1/{app_id}/chat/completions`, `Authorization: Bearer …`, response in `choices[0].message.content` with `usage.{prompt,completion}_tokens`.

### XTrace — memory layer
| Variable | Required? | Notes |
|---|---|---|
| `XTRACE_API_KEY` | Yes | `xtk_…` from app.xtrace.ai. |
| `XTRACE_ENDPOINT` | Yes | `https://api.production.xtrace.ai`. |
| `XTRACE_ORG_ID` | For SDK wiring | Org ID from app.xtrace.ai settings (needed by `@xtraceai/memory`). |

### Photon / Spectrum — messaging
| Variable | Required? | Notes |
|---|---|---|
| `PHOTON_PROJECT_ID` | Yes | From app.photon.codes. |
| `PHOTON_SECRET` | Yes | From app.photon.codes. |
| `PHOTON_TARGET` | For proactive pushes | iMessage recipient — phone `+15551234567` or handle `name@example.com`. Inbound replies work without it. |
| `PHOTON_TEAM_ID` | No | Only if you switch the provider back to Slack. |

### Data + server + optional fallback
| Variable | Notes |
|---|---|
| `DATASET_PATH` | Seed dataset path (default `data/seed_tickets.json`). |
| `PORT` | Backend port (default `3001`). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Optional direct‑LLM insurance if the gateway flakes. |

> **`.env` is git‑ignored** — your keys never get committed. So is `.mcp.json` (see below).

## The Butterbase MCP server

Butterbase is designed to be provisioned **by your coding agent** (Claude Code / Cursor). Register its MCP server once, globally:

```bash
claude mcp add butterbase https://api.butterbase.ai/mcp \
  --transport http --scope user \
  --header "Authorization: Bearer bb_sk_YOUR_KEY"
```

Verify with `claude mcp list` (should show `butterbase: ✓ Connected`), then in a fresh chat:

> *I'm using Butterbase as my backend. Call the butterbase_docs tool with topic "overview" to learn about the platform.*

This lets the agent provision DB tables (tickets, budget, usage, history) directly. The credential lives in `~/.claude.json` (user scope), not in the repo.

## Giving it data — repo + tickets

Paste your real data into the **held** `input/` folder (its contents are git‑ignored, so paste freely):

- **`input/codebase/`** — drop (or clone) the repo you want analyzed here. Agent 1 indexes it.
- **`input/jira/`** — drop exported tickets as `.json`/`.csv` (any column names — the ingest normalizes `key/id`, `summary/title`, `description`, `priority/severity`, `issuetype/type`, `status`). Falls back to `data/seed_tickets.json` if empty.

### Demo: turn a real GitHub repo's issues into tickets

This is exactly how the screenshot above was produced — Express's source as the codebase, its open issues as the backlog:

```bash
# 1. clone the repo to analyze
git clone --depth 1 https://github.com/expressjs/express input/codebase/express

# 2. pull its open issues as JSON
gh issue list --repo expressjs/express --state open --limit 16 \
  --json number,title,body,labels,createdAt > /tmp/issues.json

# 3. convert issues -> tickets (maps labels to P0–P3 / bug·feature·refactor·docs),
#    writing input/jira/tickets.json  (see commit history for the transform snippet)
```

Each issue becomes `{ id: "EXP-<number>", title, description, priority, type, status, labels }`. On boot the server loads `input/jira/` if present, else the seed.

**Internal ticket shape:**
```json
{ "id": "TICK-101", "title": "...", "description": "...", "priority": "P0", "type": "bug", "status": "open" }
```

**Team roster** lives in `data/team_members.json` — id, name, role, `skills`, and `weeklyBudgetUSD`. Agent 2 assigns tickets by skill match + load balancing.

## Running the project

```bash
# backend — Express API on :3001 (auto-loads tickets, connects Photon, etc.)
npm start            # or: npm run dev   (node --watch, auto-restart on change)

# frontend — Vite dev server on :5173, proxies /api → :3001
cd web && npm run dev
```

To re‑load a fresh set of tickets, delete the local fallback store so the server re‑ingests on boot:
```bash
rm -f .fallback-store.json && npm start
```

Populate the dashboards with worked usage by running the agent on tickets (auto‑creates a demo session):
```bash
curl -s -X POST http://localhost:3001/work/EXP-7304 -H 'Content-Type: application/json' -d '{}'
```

## Verifying everything works

```bash
# platform + agent status (live vs fallback)
curl -s http://localhost:3001/health

# tickets loaded
curl -s http://localhost:3001/tickets | head

# manager dashboard (per-member usage + team queue)
curl -s http://localhost:3001/team

# the agent brain (what Photon delivers to iMessage)
curl -s -X POST http://localhost:3001/chat -H 'Content-Type: application/json' \
  -d '{"text":"what should I work on next?"}'
```

A healthy boot logs:
```
TokenPilot server on :3001
[ingest] loaded 16 tickets from input/jira (1 file)
[photon] Spectrum connected (iMessage provider). Listening for inbound messages.
Platform status → { butterbase: 'in-memory-fallback', auth: 'butterbase-auth',
  rocketride: 'heuristic-fallback', analyzer: 'codebase-indexed',
  gateway: 'simulated-fallback', xtrace: 'connected', photon: 'connected' }
```

## Features

- **Budget‑aware prioritization** — Agent 2 orders the whole backlog to maximize important work done inside the remaining budget; flags tickets that don't fit.
- **Per‑ticket model routing** — P0/complex → Opus, moderate → Sonnet, grunt work / established context → Haiku. One gateway, swap models by name.
- **Live cost + token accounting** — every model call is billed against the team budget and attributed to a member (powers both dashboards).
- **Codebase‑aware estimates** — Agent 1 reads the actual repo to size each ticket (touched files, LOC, complexity) instead of guessing from text.
- **Skill‑ + load‑based assignment** — Agent 2 suggests an assignee per ticket from the roster.
- **Two dashboards** — manager "now" view and member deep view (recommendations + history).
- **Proactive messaging** — a P0 landing or a low budget triggers an iMessage push; the same agent brain answers natural‑language questions in‑channel.
- **Memory + reconciliation** — XTrace stores facts/episodes about ticket costs and can supersede a stale belief when new info contradicts it.
- **Runs on fallbacks** — every platform degrades gracefully, so the app never hard‑fails during a demo.

## API reference

| Route | Purpose |
|-------|---------|
| `GET /health` | per‑platform + per‑agent status (live vs. fallback) |
| `GET /tickets` | raw normalized tickets |
| `GET /board` | tickets grouped/ordered for the board |
| `GET /intel` | **Agent 1** output — codebase intel per ticket |
| `GET /recommendations` | **Agent 1 + 2** — full pipeline result |
| `GET /budget` | current budget (period, total, consumed) |
| `GET /team` | **Manager dashboard** — usage per member + team queue (no history) |
| `GET /team/:id` | **Member dashboard** — usage + history + their recommendations |
| `POST /work/:id` | estimate → route → call model via gateway → bill → attribute to a member → maybe push |
| `POST /chat` | the agent brain (what Photon delivers to iMessage) |
| `GET /memory` | XTrace beliefs + version history (pass `?q=` to search) |
| `POST /simulate-model-update` | XTrace reconciliation demo kicker |
| `POST /auth/signup` · `POST /auth/login` | Butterbase auth (demo auto‑session via `requireAuth`) |

## Platform integration status

`/health` reports each platform as `connected` or a `*-fallback`. Current wiring:

| Platform | Keys configured | Code wired | Live now? | To go fully live |
|---|---|---|---|---|
| **Photon (iMessage)** | ✅ | ✅ real Spectrum client | ✅ **connected** | set `PHOTON_TARGET` for proactive pushes |
| **XTrace** | ✅ key + endpoint | ⚠️ status `connected`, but read/write/supersede still use the in‑memory store | partial | wire `server/xtrace.js` to the `@xtraceai/memory` SDK (needs `XTRACE_ORG_ID`) |
| **Butterbase — Gateway** | ⏳ needs `GATEWAY_KEY` + `APP_ID` | ✅ OpenAI‑compatible call in `gateway.js` | simulated | add the two env vars → flips to real Claude |
| **Butterbase — DB/auth** | ✅ API key + MCP server | ⏳ DB still in‑memory | fallback | add `PROJECT_URL` + wire `butterbase.js` to real tables |
| **RocketRide** | endpoint set (self‑hosted) | ⏳ heuristics, SDK not wired | fallback | start the Docker engine + wire `rocketride.js` to the SDK |

> The app is fully usable in every "fallback" state — these are upgrades, not blockers.

## Messaging (Photon / iMessage)

`server/photon.js` uses the real **Spectrum** SDK (`spectrum-ts`) with the **iMessage** provider (Photon Cloud‑managed credentials, so no local token).

- **Inbound:** an async‑iterator loop (`for await … of app.messages`) routes each message to the agent brain and replies in‑thread. Runs in the background; never blocks boot.
- **Outbound (proactive):** `pushNotification(target, text)` opens a DM space (`imessage(app).space({ phone })`) and sends. Targets come from `PHOTON_TARGET` (a phone/handle).
- **Resilient:** if Spectrum can't connect, it logs and degrades to the console fallback (the `/chat` route still exercises the inbound flow), so the server always boots.
- **Switching to Slack:** change the import + provider in `photon.js` to `slack` from `spectrum-ts/providers/slack`, target by `teamId/channel`, and enable Slack on your Photon project.

## Project structure

| File | Does |
|------|------|
| `server/index.js` | Express routes + boot (ingest, Photon init, status log) |
| `server/inputs.js` | reads `input/codebase/` + `input/jira/` (with fallbacks) |
| `server/ingest.js` | normalizes any CSV/JSON dataset → internal ticket shape |
| `server/agents/analyzer.js` | **Agent 1** — codebase intelligence |
| `server/agents/recommender.js` | **Agent 2** — priority/cost/effort/assignee recommendations |
| `server/agents/orchestrator.js` | runs Agent 1 → Agent 2 (`runPipeline`) |
| `server/team.js` | roster + assembles the manager & member dashboards |
| `server/butterbase.js` | tickets, budget, **per‑member usage + history** |
| `server/gateway.js` | Butterbase AI Gateway — model switching (OpenAI‑compatible) |
| `server/xtrace.js` | XTrace memory: write/search + reconciliation |
| `server/rocketride.js` | estimate / route / order heuristics (→ real pipeline) |
| `server/photon.js` · `auth.js` | iMessage delivery (Spectrum) · Butterbase auth |
| `web/src/views/ManagerView.jsx` · `MemberView.jsx` | the two dashboards |
| `data/team_members.json` · `data/seed_tickets.json` | roster · seed backlog |

## Troubleshooting

- **Port already in use** — `lsof -ti:3001 | xargs kill -9` (or `:5173` for the web server).
- **Tickets didn't refresh** — the server only auto‑loads when the store is empty: `rm -f .fallback-store.json && npm start`.
- **`gateway: simulated-fallback`** — you still need `BUTTERBASE_GATEWAY_KEY` **and** `BUTTERBASE_APP_ID`; both must be set.
- **Gateway 4xx with valid keys** — the model slug may not match Butterbase's catalog; set `BUTTERBASE_MODEL_FLAGSHIP/_MID/_CHEAP` to the IDs your gateway exposes.
- **`photon: error-fallback` / "X is not enabled for this project"** — enable that provider (iMessage/Slack) on your Photon project at app.photon.codes.
- **Frontend shows no data** — make sure the backend is up on `:3001` (the Vite proxy maps `/api` → `:3001`).

## Roadmap / upgrades

These are the next steps to take each platform from fallback → fully live (the app works today without them):

- [ ] **Butterbase DB** — wire `butterbase.js` to real tables (tickets, budget, usage, history); add `PROJECT_URL`.
- [ ] **Butterbase Gateway** — add `GATEWAY_KEY` + `APP_ID` to make real Claude calls; confirm model slugs.
- [ ] **XTrace** — wire `xtrace.js` to the `@xtraceai/memory` SDK so facts/episodes and supersede/reconcile hit the real platform.
- [ ] **RocketRide** — run the Docker engine and wire `rocketride.js` to the SDK pipeline.
- [ ] **Photon** — set `PHOTON_TARGET` for proactive pushes; optionally add a Slack provider.
- [ ] **Auth** — replace the demo auto‑session with real Butterbase auth (signup/login/session).

Background and key‑setup notes live in `hackathon_build_plan.md` and `tokenpilot_keys_setup.md`.
