# TokenPilot 🪄

**The autonomous cost-and-priority brain for your engineering backlog.**

Given your team's AI budget and your ticket priorities, TokenPilot decides *what to work on, in what order, and which model to use for each task* — to get the most important work done inside budget, with zero human tuning.

Stack (all FOUR mandatory): **RocketRide** (pipeline) · **Butterbase** (backend + auth + AI gateway) · **XTrace** (memory + reconciliation) · **Photon/Spectrum** (messaging delivery — Slack).

---

## Quickstart

```bash
# 1. install
npm install
cd web && npm install && cd ..

# 2. keys — fill in .env from .env.example
cp .env.example .env   # then paste your keys

# 3. ingest tickets (seed data by default; swap DATASET_PATH for Kaggle later)
node server/ingest.js

# 4. run backend
node server/index.js

# 5. run frontend (separate terminal)
cd web && npm run dev
```

## Data
- Builds with `data/seed_tickets.json` out of the box (8 realistic tickets).
- To use a Kaggle dataset: drop the CSV/JSON in `data/`, set `DATASET_PATH=data/your_file.csv` in `.env`, re-run `node server/ingest.js`. The ingest layer normalizes any schema into the internal ticket shape.

## Internal ticket shape
```json
{ "id": "TICK-101", "title": "...", "description": "...", "priority": "P0", "type": "bug", "status": "open" }
```

## Build order
See `../hackathon_build_plan.md` → "Claude Code Implementation Guide". Build top-to-bottom. Skeleton (all 3 platforms connected, fake numbers) BEFORE real logic. Make the screen look real BEFORE perfecting the backend.

## The pieces
| File | Does |
|------|------|
| `server/ingest.js` | reads CSV/JSON → normalizes → loads into Butterbase |
| `server/butterbase.js` | Butterbase client: tickets, budget, spend state |
| `server/gateway.js` | Butterbase AI Gateway — model switching lives here |
| `server/xtrace.js` | XTrace memory: write/search + reconciliation |
| `server/rocketride.js` | triggers the RocketRide pipeline, parses results |
| `server/index.js` | Express routes |
| `pipeline/tokenpilot_pipeline.json` | RocketRide pipeline def (estimator→budget→router→context→monitor) |
| `web/App.jsx` | the board screen |
