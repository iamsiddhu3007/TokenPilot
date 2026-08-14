# TokenPilot — Product & Architecture Plan

> **Status: rebuilding.** TokenPilot started as a hackathon project wired to four sponsor
> platforms (Butterbase, RocketRide, XTrace, Photon). We're rebuilding it as a real,
> open-source-first, bootstrapped-budget SaaS. The original hackathon build is preserved
> in the archive repo **`iamsiddhu3007/TokenPilot-AWS-Builder-Loft`** and in git history.

## What it is

**An AI engineering manager that lives in VS Code and runs on your GitHub repo.**

Connect a repo once → TokenPilot continuously understands your code, issues, and PRs
(re-reading on every merge) → every developer gets a **sorted, realistically-estimated
queue of GitHub issues** inside VS Code → click an issue and a **context-aware coding
agent** (chat, later a claude-code-style terminal) helps do the work → the manager gets an
**honest capacity forecast** → the system **learns from every merged PR**.

> Terminology: the app speaks **"issues,"** mapped 1:1 to GitHub issues (not "tickets").

## Who it's for

| Surface | Who | What they do |
|---|---|---|
| **Web dashboard** (hosted) | Manager | Sign up, create a project, connect a GitHub repo, pick an AI provider + paste the **team API key**, add members by username, see the board / timelines / load, review ideas, assign |
| **VS Code extension** | Developer | Sorted personal issue queue, click an issue → coding agent, override order/estimates |
| **Terminal coding agent** (later) | Developer | The same per-issue agent in a claude-code-style CLI |

## Principles (hard constraints)

- **Open-source first**, near-zero idle cost.
- **We never pay for customers' inference.** Each team brings its own model key (BYOK).
- **Cheaply self-hostable** so managers can log in.

## Auth & membership

- **Username/password self-registration** for everyone (no GitHub login required to use the app).
- A **manager adds members to a project by username.** Adding people to the GitHub
  team/repo itself is the manager's job outside TokenPilot.
- Repo access is separate from login: the manager connects a repo via a **GitHub App** install.
- Per-project (tenant) data isolation; the team API key is stored **encrypted**, never shared across tenants.

## The model / BYOK layer

- The **manager selects one provider per team** — Claude, Gemini, or ChatGPT — and pastes a
  **team API key**. Every member uses it; **inference is billed to the team, not to us.**
- **Gateway = [LiteLLM](https://github.com/BerriAI/litellm)** (open-source, self-hosted): one
  OpenAI-compatible interface across all providers, with per-team budgets and cost tracking.
- **Coding/chat history is stored locally per developer** (in the editor/CLI), not on our servers.
- Our own credits cover only app hosting, the embedding model, and an optional small **capped trial**.

## Architecture

```
   VS Code extension      Web dashboard      Terminal agent (later)
        └──────────── REST / WS API ───────────┘
                          │
   Backend: Auth/teams · GitHub App · Planning engine · Idea engine
            Coding-agent context service · LiteLLM gateway (BYOK)
            │                    │                     │
      Indexer (chunk+embed   Postgres + pgvector   LiteLLM → team's
      + git history)         (data + vectors)      Claude / Gemini / OpenAI key
            ▲
   GitHub App webhooks (PR merged / issue / push) → re-index only the delta
```

- **Indexer** — chunk code → open CPU embedding model → pgvector; parse git history into
  features (code ownership, PR cycle times). On each webhook, re-embed only the changed files.
- **Planning engine** — GitHub issues → prioritized, estimated, assigned, scheduled. Manual
  overrides always win. Phase 1 uses heuristics + LLM; a cheap CPU-trained estimator comes later.
- **Idea engine** — scans the index and proposes refactors / bugs / missing tests / tech debt as draft issues.
- **Coding-agent context service** — for a clicked issue, returns the retrieved files, the issue
  context, and a **per-repo style guide**. The agent loop runs **client-side**; file edits and
  history stay on the developer's machine, minimizing our cost and data liability.
- **Estimates + learning loop** — estimate = code surface + team velocity + assignee pace. On PR
  merge, record estimated-vs-actual, recalc timelines, and calibrate. Features + outcomes are
  logged from day one so a trained estimator can replace the heuristics later.

## Tech stack (v0.3.0 — Apr–Jun 2026)

| Concern | Choice |
|---|---|
| Frontend | **React** via **Next.js 15** (App Router) |
| Backend API | **Express.js** (:3001) — agent routes, issue board, traces, costs |
| ORM | **Prisma** — replaces Drizzle |
| DB + vectors | **PostgreSQL + pgvector** — `code_chunk.embedding vector(1024)` |
| Message broker | **RabbitMQ** — 4 durable queues (ingest → priority + index → estimate) |
| LLM | **Claude** via `@anthropic-ai/sdk` (user BYOK — key entered in Settings) |
| Embeddings | **NVIDIA free API** (`integrate.api.nvidia.com/v1`, OpenAI-compatible) |
| Observability | **LangSmith** — traces all agent runs, stores run IDs + token counts |
| Auth | Better Auth (username/password + sessions) |
| GitHub | GitHub App + Octokit webhooks |

## Multi-agent pipeline

```
GitHub webhook (issues.opened/edited/reopened)
  → POST /api/pipeline/trigger (Express, internal key auth)
  → Creates IssueJob in Postgres
  → RabbitMQ: issue.ingest
  → intake-worker fans out to: issue.priority + issue.index (parallel)
  → priority-worker: Claude (LangSmith traced) → priority + budgetTier → issue.estimate
  → index-worker: Octokit files → chunk → NVIDIA embed → pgvector (code_chunk)
  → estimate-worker: pgvector similarity → Claude (LangSmith traced) → effortHours
```

## Build phases

- **Phase 0 ✅** — Auth + projects + GitHub App + BYOK keys (encrypted)
- **Phase 1 ✅** — Prisma migration + Express server + RabbitMQ + multi-agent pipeline + LangSmith + Issue Board / Agent Runs / Costs dashboard pages
- **Phase 2** — VS Code extension (sorted personal issue queue per developer)
- **Phase 3** — Per-issue coding agent (chat + context + style guide, local history)
- **Phase 4** — Proactive idea engine (scans index → proposes refactors/bugs/missing tests)

## Design notes

- **Server-light agent** — context from the backend, execution + history local. Cost & privacy win.
- **Per-repo style guide** — derived once from lint config + exemplar code, injected into the agent.
- **Cost guardrails** — per-team budget caps in LiteLLM so a runaway agent can't drain a key.
- **Closed loop** — the agent's PR links to its issue; on merge the issue auto-closes and feeds calibration.
- **Cold start** — ship heuristics now, log outcomes, graduate to ML when there's enough data.
- **Security** — encrypt team keys, minimal GitHub App scopes, strict per-tenant isolation.

## Development

A private sandbox repo, **`iamsiddhu3007/tokenpilot-testbed`**, holds sample GitHub issues
(bug / feature / refactor / test-gap, varied priority) to develop the indexer and board against.

---

## Running locally (Phase 0)

```bash
cp .env.example .env            # then set BETTER_AUTH_SECRET + ENCRYPTION_KEY (openssl rand -base64 32)
docker compose up -d            # Postgres+pgvector (:5432) + LiteLLM gateway (:4000)
npm install
npm run db:migrate              # apply Drizzle migrations
npm run dev                     # http://localhost:3000
```

Sign up → create a project → add a member by username → open project **Settings** to set the
AI provider + team key and connect a repo.

### Phase 0b checklist — credentials to light up the live paths

These two integrations are coded and verified structurally, but need real credentials to run live:

**1. Provider key (BYOK).** In a project's **Settings → AI provider**, choose Claude/OpenAI/Gemini,
paste the team's API key (stored AES-256-GCM encrypted), and hit **Test gateway**. The call routes
through LiteLLM on that key. (Verified: a fake key is correctly rejected by the provider.)

**2. GitHub App.** Create one at **github.com/settings/apps/new**:
- Callback/Setup URL: `http://localhost:3000/api/github/setup` (check "Redirect on update").
- Webhook URL: a smee.io tunnel → `http://localhost:3000/api/github/webhook`; set a **Webhook secret**.
- Permissions: Repository → Contents (Read), Issues (Read), Metadata (Read), Pull requests (Read).
- Subscribe to events: Push, Issues, Pull request.
- Generate a private key; copy App ID, slug, client id/secret.
- Fill `GITHUB_APP_*` in `.env` (the webhook secret too), restart, then **Settings → Connect GitHub**.

> Local webhooks need a public tunnel: `npx smee-client --url https://smee.io/<channel> --target http://localhost:3000/api/github/webhook`.
