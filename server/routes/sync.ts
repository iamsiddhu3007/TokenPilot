import { Router } from "express";
import { Octokit } from "octokit";
import { prisma } from "../db-client";
import { getChannel, QUEUES, publish } from "../queue/connection";
import { requireInternalKey } from "../middleware/auth";
import { decrypt } from "../../lib/crypto";

export const syncRouter = Router();

syncRouter.post("/:projectId", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);

    const gh = await prisma.githubConnection.findUnique({ where: { projectId } });
    if (!gh?.owner || !gh?.name) {
      res.status(400).json({ error: "No GitHub repo connected for this project" });
      return;
    }

    const pat = gh.encGithubPat ? decrypt(gh.encGithubPat) : undefined;
    const octokit = new Octokit({ auth: pat });

    // Fetch all open issues (up to 100)
    const { data: issues } = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner: gh.owner,
      repo: gh.name,
      state: "open",
      per_page: 100,
    });

    const channel = await getChannel();
    let count = 0;

    for (const issue of issues) {
      // Skip pull requests (GitHub returns PRs in issues endpoint)
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
