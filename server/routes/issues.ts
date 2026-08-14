import { Router } from "express";
import { prisma } from "../db-client";
import { requireInternalKey } from "../middleware/auth";

export const issuesRouter = Router();

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

issuesRouter.get("/:projectId", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);
    const jobs = await prisma.issueJob.findMany({
      where: { projectId },
      include: { estimate: true },
      orderBy: { createdAt: "desc" },
    });

    const sorted = jobs.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority ?? "low"] ?? 3;
      const pb = PRIORITY_ORDER[b.priority ?? "low"] ?? 3;
      return pa - pb;
    });

    res.json(sorted);
  } catch (err) {
    console.error("[issues]", err);
    res.status(500).json({ error: "internal error" });
  }
});
