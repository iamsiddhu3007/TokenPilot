import { Router } from "express";
import { prisma } from "../db-client";
import { requireInternalKey } from "../middleware/auth";

export const costsRouter = Router();

costsRouter.get("/:projectId", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);
    const jobs = await prisma.issueJob.findMany({ where: { projectId }, select: { id: true } });
    const jobIds = jobs.map((j) => j.id);

    const runs = await prisma.agentRun.findMany({
      where: { issueJobId: { in: jobIds } },
    });

    const byType: Record<string, { count: number; promptTokens: number; completionTokens: number; costUsd: number }> = {};
    for (const run of runs) {
      if (!byType[run.agentType]) byType[run.agentType] = { count: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };
      byType[run.agentType].count++;
      byType[run.agentType].promptTokens += run.promptTokens ?? 0;
      byType[run.agentType].completionTokens += run.completionTokens ?? 0;
      byType[run.agentType].costUsd += run.costUsd ?? 0;
    }

    res.json(byType);
  } catch (err) {
    console.error("[costs]", err);
    res.status(500).json({ error: "internal error" });
  }
});
