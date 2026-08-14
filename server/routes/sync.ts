import { Router } from "express";
import { prisma } from "../db-client";
import { getChannel, QUEUES, publish } from "../queue/connection";
import { requireInternalKey } from "../middleware/auth";
import { decrypt } from "../../lib/crypto";

export const syncRouter = Router();

async function githubFetch(url: string, pat?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (pat) headers.Authorization = `Bearer ${pat}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

syncRouter.post("/:projectId", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);

    const gh = await prisma.githubConnection.findUnique({ where: { projectId } });
    if (!gh?.owner || !gh?.name) {
      res.status(400).json({ error: "No GitHub repo connected for this project" });
      return;
    }

    const pat = gh.encGithubPat ? decrypt(gh.encGithubPat) : undefined;

    const issues = await githubFetch(
      `https://api.github.com/repos/${gh.owner}/${gh.name}/issues?state=open&per_page=100`,
      pat,
    ) as { number: number; title: string; body?: string; pull_request?: object }[];

    const channel = await getChannel();
    let count = 0;

    for (const issue of issues) {
      if (issue.pull_request) continue;

      let job = await prisma.issueJob.findFirst({
        where: { projectId, githubIssueNumber: issue.number },
      });
      if (job) {
        job = await prisma.issueJob.update({
          where: { id: job.id },
          data: { title: issue.title, body: issue.body ?? "", status: "pending" },
        });
      } else {
        job = await prisma.issueJob.create({
          data: { projectId, githubIssueNumber: issue.number, title: issue.title, body: issue.body ?? "", status: "pending" },
        });
      }

      publish(channel, QUEUES.INGEST, {
        jobId: job.id,
        projectId,
        issueNumber: issue.number,
        title: issue.title,
        body: issue.body ?? "",
      });

      count++;
    }

    res.json({ ok: true, synced: count });
  } catch (err) {
    console.error("[sync]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});
