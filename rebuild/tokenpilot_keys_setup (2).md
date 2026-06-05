# TokenPilot — Keys & Credentials Setup
### Everything you need to authenticate, and exactly how to get each one

> **Do this the night before / during the 09:45–10:30 keynote.** A broken key at 10:30 is the most common way solo builds lose the first hour. Test every one before hacking starts.

---

## ⚡ TL;DR — What you actually need

| # | Credential | Required? | Where it goes | Hardest to get? |
|---|-----------|-----------|---------------|-----------------|
| 1 | **RocketRide API key** | ✅ Mandatory | `.env` | Check at venue — likely provided |
| 2 | **Butterbase API key + project URL** | ✅ Mandatory | `.env` | Easy, self-serve |
| 3 | **Butterbase AI Gateway key** | ✅ Mandatory | `.env` | Comes with Butterbase |
| 4 | **XTrace API key** | ✅ Mandatory | `.env` | Easy, self-serve |
| 5 | **Photon PROJECT_ID + SECRET** | ✅ Mandatory | `.env` | Easy — app.photon.codes |
| 6 | **Butterbase auth** | ✅ Mandatory | (part of Butterbase) | Comes with Butterbase |
| 7 | **Jira API token + domain** | ❌ Not used | — | Using Kaggle dataset instead |
| 6 | **Anthropic / OpenAI key** | ⚠️ Fallback only | `.env` | Easy — backup if gateway flakes |

> **The FOUR mandatory platforms are RocketRide, Butterbase (incl. auth + gateway), XTrace, and Photon.** Everything else is optional polish. Don't let optional keys block you.
>
> ✅ **DECIDED: No AWS. No Photon/Slack. All models route through Butterbase's gateway only** (you have Butterbase credits). This keeps the build to three platforms — simpler, and exactly what the rubric wants.

---

## 🔴 IMPORTANT: Ask at the venue first

Hackathons almost always provide **pre-provisioned keys or credits** for the sponsor tools (RocketRide, Butterbase, XTrace) and sometimes extra credits. **Before signing up for anything yourself, check:**
- The welcome email / Discord / Slack channel
- The keynote slides (they usually flash sign-up links + promo codes)
- The sponsor booths — ask a rep directly: *"Do you have a hackathon key or credits for us?"*

This can save you all the setup below. Only self-serve if they don't provide it.

---

## 1️⃣ RocketRide API Key (MANDATORY)

**What it's for:** triggering your multi-agent pipeline (estimator → budget → router → context → monitor).

**How to get it:**
1. Go to **rocketride.ai** → sign up / log in.
2. Look for **API Keys** / **Developer** / **Settings** in the dashboard.
3. Generate a key.
4. Docs: **docs.rocketride.org** — confirm whether pipelines are triggered via SDK or REST, and grab the exact endpoint.

**Test it:** trigger the simplest pipeline (or a hello-world) and confirm you get a response.

```
ROCKETRIDE_API_KEY=...
ROCKETRIDE_ENDPOINT=...   # from docs
```

> ⚠️ This is open-source + IDE-based (VS Code). You may need the VS Code extension installed too — check docs.rocketride.org for whether you build the pipeline visually in the IDE and export JSON, vs. pure API. **Confirm this tonight if you can** — it affects your Step 0.

---

## 2️⃣ + 3️⃣ Butterbase API Key + AI Gateway Key (MANDATORY)

**What it's for:** your entire backend (database, tickets, budget, spend state) AND the AI Model Gateway that does the actual model switching.

**How to get it:**
1. Go to **butterbase.ai** → sign up / log in.
2. **Create a new project** — this gives you a project URL/ID and a database.
3. In project settings, find **API Keys** → copy the project API key.
4. Find the **AI Gateway** / **Model Gateway** section → get the gateway key (one key for GPT/Claude/Gemini/300+).
5. Docs: **docs.butterbase.ai** — grab the client setup snippet and the gateway call format.

**Test it:**
- Write one row to a table, read it back (DB works).
- Make one model call through the gateway (gateway works).

```
BUTTERBASE_API_KEY=...
BUTTERBASE_PROJECT_URL=...
BUTTERBASE_GATEWAY_KEY=...
```

> 💡 Butterbase is designed to be set up BY your coding agent (Claude Code / Cursor). You can literally point Claude Code at it and have it provision tables. But get the keys yourself first.

---

## 4️⃣ XTrace API Key (MANDATORY)

**What it's for:** the memory layer — storing facts/episodes/artifacts, and contradiction reconciliation.

**How to get it:**
1. Go to **xtrace.ai** → sign up / log in.
2. Find **API Keys** / **Settings**.
3. Generate a Memory API key.
4. Docs: **docs.mem.xtrace.ai** — grab the write-memory and search-memory endpoints, and look specifically for how **contradiction/supersede** is triggered (that's your demo kicker).

**Test it:** write one memory, search and retrieve it.

```
XTRACE_API_KEY=...
XTRACE_ENDPOINT=...   # from docs.mem.xtrace.ai
```

> ⚠️ Read the docs for **episodes** and **reconciliation** specifically — judges score depth here, and you need to know the API shape to demo the "it revised its own belief" moment.

---

## 5️⃣ Photon / Spectrum (MANDATORY — messaging delivery)

**What it's for:** delivering your agent through a real messaging platform (Slack recommended). The agent answers queries in-channel AND proactively pushes alerts. This is a disqualification-level requirement — do not skip.

**How to get it:**
1. Go to **app.photon.codes** → sign up → create a project.
2. Copy your **PROJECT_ID** and **SECRET**.
3. Install the SDK: `npm install spectrum-ts` (TypeScript/JS, MIT licensed).
4. Pick a provider. **Slack** is the most judge-friendly + easiest to show on a projector. (iMessage needs a Mac/iCloud; Telegram needs a bot token.)
5. Docs/repo: **github.com/photon-hq/spectrum-ts** and **photon.codes/spectrum**.
6. **Ask the Photon booth** — they sponsor hackathons and hand out credits; they'll have keys + help on-site.

**Test it:** message your agent and confirm it replies; trigger a proactive push.

```
PHOTON_PROJECT_ID=
PHOTON_SECRET=
PHOTON_TARGET=        # slack channel id / phone / handle to push to
```

> 💡 The starter repo already has `server/photon.js` with the Spectrum pattern stubbed + a console fallback. You just swap in real keys + pick the Slack provider. The agent brain and proactive pushes already work.

> 🏆 Bonus: Photon offers cash + credits for projects that integrate them well and post about it. Worth doing for your networking/job goal too.

---

## 6️⃣ Butterbase Auth (MANDATORY — part of Butterbase)

Auth is now a required Butterbase integration (database + **auth** + gateway). No separate signup — it's in your Butterbase project. The starter repo has `server/auth.js` with signup/login/session stubbed + a demo fallback. Wire it to Butterbase's real auth from docs.butterbase.ai. For the demo, a single signed-in user is enough.

---

## 7️⃣ Jira API Token (NOT USED — Kaggle dataset instead)

**What it's for:** pulling real tickets to prove "it's live." For the actual demo, you can run off `seed_tickets.json` instead.

**How to get it (Atlassian Cloud):**
1. Log in to your Atlassian account.
2. Go to **id.atlassian.com/manage-profile/security/api-tokens** (Account Settings → Security → Create and manage API tokens).
3. Click **Create API token**, name it "tokenpilot", copy it (you won't see it again).
4. Your Jira domain is `https://YOUR-SITE.atlassian.net`.
5. Auth is **Basic Auth**: email + API token, base64-encoded. The REST endpoint for issues:
   `GET https://YOUR-SITE.atlassian.net/rest/api/3/search?jql=project=KEY`

```
JIRA_DOMAIN=https://your-site.atlassian.net
JIRA_EMAIL=you@email.com
JIRA_TOKEN=...
```

> 💡 No Jira account / project? Create a free Atlassian Cloud site (free tier, ~10 users) and add 8 sample tickets — OR just skip Jira entirely and use `seed_tickets.json`. **For the demo, seed data is safer.** Pull from Jira once for the screenshot/credibility, demo off seed.

---

## 6️⃣ Direct LLM Keys — Anthropic / OpenAI (OPTIONAL fallback)

**What it's for:** a safety net if Butterbase's gateway misbehaves and you need to call a model directly to keep the demo alive.

**How to get it:**
- **Anthropic:** console.anthropic.com → API Keys → create key.
- **OpenAI:** platform.openai.com → API Keys → create key.

```
ANTHROPIC_API_KEY=...   # fallback only
OPENAI_API_KEY=...      # fallback only
```

> 💡 You have Butterbase credits, so ALL model calls go through Butterbase's gateway by design (it's a judging requirement). These direct keys are pure insurance — only grab them if quick.

---

## 📄 Final `.env` template

```bash
# === MANDATORY (the three platforms) ===
ROCKETRIDE_API_KEY=
ROCKETRIDE_ENDPOINT=

BUTTERBASE_API_KEY=
BUTTERBASE_PROJECT_URL=
BUTTERBASE_GATEWAY_KEY=
# (Butterbase auth uses the same project — no extra key)

XTRACE_API_KEY=
XTRACE_ENDPOINT=

PHOTON_PROJECT_ID=
PHOTON_SECRET=
PHOTON_TARGET=

# === OPTIONAL (data source) ===
JIRA_DOMAIN=
JIRA_EMAIL=
JIRA_TOKEN=

# === OPTIONAL (direct LLM fallback) ===
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## ✅ Pre-Hack Verification Checklist (do before 10:30)

- [ ] Asked venue/Discord/booths whether sponsor keys are pre-provided
- [ ] RocketRide: key works, one pipeline returns a response
- [ ] RocketRide: confirmed whether VS Code extension is needed
- [ ] Butterbase: project created, wrote+read one row
- [ ] Butterbase: one model call through the gateway succeeds
- [ ] XTrace: wrote+searched one memory; found the reconciliation API in docs
- [ ] Photon: signed up at app.photon.codes; got PROJECT_ID+SECRET; `spectrum-ts` installs; agent replies to a test Slack message
- [ ] Butterbase auth: signup/login works (or demo fallback accepted)
- [ ] (Optional) Jira: pulled one ticket OR decided to use seed data
- [ ] All keys loading correctly from `.env`
- [ ] `seed_tickets.json` ready as the reliable fallback data source

> **If all FOUR mandatory platforms (RocketRide, Butterbase incl. auth, XTrace, Photon) pass their test calls, you're cleared to build.** Everything else is optional. Don't burn your morning on optional keys.

---

## 🧠 One honest note
You haven't used RocketRide, Butterbase, or XTrace before. Their exact API shapes (endpoint names, payload formats, auth header style) may differ from what you'd expect. **When you do your test calls, copy the real request/response format you get and feed it to Claude Code** — let it adapt the integration code to the actual API. The setup steps above get you the keys; the docs + your test calls give you the exact shapes.
