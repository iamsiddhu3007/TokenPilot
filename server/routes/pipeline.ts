import { Router } from "express";
import { prisma } from "../db-client";
import { getChannel, QUEUES, publish } from "../queue/connection";
import { requireInternalKey } from "../middleware/auth";

export const pipelineRouter = Router();

pipelineRouter.post("/trigger", requireInternalKey, async (req, res) => {
  try {
    const { projectId, issueNumber, title, body, installationId } = req.body as {
      projectId: string;
      issueNumber: number;
      title: string;
      body?: string;
      installationId?: string;
    };

    if (!projectId || !issueNumber || !title) {
      res.status(400).json({ error: "projectId, issueNumber, title required" });
      return;
    }

    let job = await prisma.issueJob.findFirst({ where: { projectId, githubIssueNumber: issueNumber } });
    if (job) {
      job = await prisma.issueJob.update({ where: { id: job.id }, data: { title, body, status: "pending" } });
    } else {
      job = await prisma.issueJob.create({ data: { projectId, githubIssueNumber: issueNumber, title, body, status: "pending" } });
    }

    const channel = await getChannel();
    const payload = { jobId: job.id, projectId, issueNumber, title, body, installationId };
    publish(channel, QUEUES.INGEST, payload);

    res.json({ ok: true, jobId: job.id });
  } catch (err) {
    console.error("[pipeline/trigger]", err);
    res.status(500).json({ error: "internal error" });
  }
});
