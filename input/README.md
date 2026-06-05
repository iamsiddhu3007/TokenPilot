# `input/` — drop your real data here

This folder is the **held space** for the things you'll provide later. Nothing here
is committed except this README and the `.gitkeep` placeholders, so you can paste
large/private content freely (see `.gitignore`).

## `input/codebase/`
Paste (or copy) the repository you want analyzed **directly inside this folder**.

```
input/codebase/
  <your-repo>/...        # or just the files at the top level
```

**Agent 1 (Codebase Intelligence)** scans everything here — recursively, skipping
`node_modules`, `.git`, build output, and binaries — to figure out which files each
Jira ticket touches, how large the change surface is, and how complex the work looks.

If this folder is empty, Agent 1 falls back to estimating from the ticket text alone,
so the whole app still runs end-to-end before you paste anything.

## `input/jira/`
Drop your exported Jira tickets here as **`.json` or `.csv`** (any column names — the
ingest layer normalizes them). Examples it understands: `key/id`, `summary/title`,
`description`, `priority/severity`, `issuetype/type`, `status`.

```
input/jira/
  tickets.json           # or tickets.csv, or several files
```

If this folder has no ticket files, the app uses `data/seed_tickets.json` (8 demo
tickets) instead.

## How it's wired
1. **Agent 1** reads `input/codebase/` + the tickets → produces per-ticket *intel*.
2. **Agent 2** reads that intel → produces *recommendations* (priority order, cost,
   effort/time, model tier, suggested assignee).
3. The **Manager** and **Member** dashboards render the result.

No restart needed for data swaps beyond re-running ingest / refreshing the board —
see the root `README.md`.
