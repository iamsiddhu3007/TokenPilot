import { Router } from "express";
import { prisma } from "../db-client";
import { requireInternalKey } from "../middleware/auth";

export const tracesRouter = Router();

tracesRouter.get("/:projectId", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);
    const jobs = await prisma.issueJob.findMany({
      where: { projectId },
      include: { agentRuns: { orderBy: { startedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (err) {
    console.error("[traces]", err);
    res.status(500).json({ error: "internal error" });
  }
});
