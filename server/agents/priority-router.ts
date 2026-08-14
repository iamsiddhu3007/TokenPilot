import { traceable } from "../tracing/langsmith";
import { prisma } from "../db-client";
import { callLLM } from "../utils/llm";

type PriorityResult = {
  priority: "critical" | "high" | "medium" | "low";
  budgetTier: "XS" | "S" | "M" | "L" | "XL";
  rationale: string;
};

const runPriorityRouter = traceable(
  async (opts: {
    issueJobId: string;
    title: string;
    body: string;
    model: string;
    nvidiaApiKey: string;
    claudeApiKey?: string | null;
  }): Promise<PriorityResult> => {
    const runRecord = await prisma.agentRun.create({
      data: { issueJobId: opts.issueJobId, agentType: "priority_router", status: "running" },
    });

    let result: PriorityResult = { priority: "medium", budgetTier: "M", rationale: "default" };

    try {
      const { text, promptTokens, completionTokens } = await callLLM({
        model: opts.model,
        nvidiaApiKey: opts.nvidiaApiKey,
        claudeApiKey: opts.claudeApiKey,
        maxTokens: 300,
        messages: [
          {
            role: "user",
            content: `Classify this GitHub issue. Respond with JSON only (no markdown):
{"priority":"critical"|"high"|"medium"|"low","budgetTier":"XS"|"S"|"M"|"L"|"XL","rationale":"one sentence"}

XS=<2h, S=2-4h, M=4-8h, L=8-16h, XL=>16h

Title: ${opts.title}
Body: ${opts.body || "(no body)"}`,
          },
        ],
      });

      try {
        result = JSON.parse(text) as PriorityResult;
      } catch {
        // keep default if parse fails
      }

      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: { status: "success", promptTokens, completionTokens, finishedAt: new Date() },
      });
    } catch (err) {
      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: { status: "failed", finishedAt: new Date() },
      });
      throw err;
    }

    await prisma.issueJob.update({
      where: { id: opts.issueJobId },
      data: { priority: result.priority, budgetTier: result.budgetTier },
    });

    return result;
  },
  { name: "priority-router" },
);

export { runPriorityRouter };
