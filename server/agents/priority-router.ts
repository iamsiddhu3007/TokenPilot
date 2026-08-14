import Anthropic from "@anthropic-ai/sdk";
import { traceable } from "../tracing/langsmith";
import { prisma } from "../db-client";

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
    apiKey: string;
    model: string;
  }): Promise<PriorityResult> => {
    const client = new Anthropic({ apiKey: opts.apiKey });

    await prisma.agentRun.create({
      data: { issueJobId: opts.issueJobId, agentType: "priority_router", status: "running" },
    });

    let result: PriorityResult = { priority: "medium", budgetTier: "M", rationale: "default" };
    let runRecord = await prisma.agentRun.findFirst({
      where: { issueJobId: opts.issueJobId, agentType: "priority_router", status: "running" },
      orderBy: { startedAt: "desc" },
    });

    try {
      const message = await client.messages.create({
        model: opts.model,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Classify this GitHub issue. Respond with JSON only (no markdown):
{"priority":"critical"|"high"|"medium"|"low","budgetTier":"XS"|"S"|"M"|"L"|"XL","rationale":"one sentence"}

XS=<2h, S=2-4h, M=4-8h, L=8-16h, XL=>16h

Title: ${opts.title}
Body: ${opts.body ?? "(no body)"}`,
          },
        ],
      });

      const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
      try {
        result = JSON.parse(text) as PriorityResult;
      } catch {
        // keep default if parse fails
      }

      if (runRecord) {
        await prisma.agentRun.update({
          where: { id: runRecord.id },
          data: {
            status: "success",
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
            finishedAt: new Date(),
          },
        });
      }
    } catch (err) {
      if (runRecord) {
        await prisma.agentRun.update({
          where: { id: runRecord.id },
          data: { status: "failed", finishedAt: new Date() },
        });
      }
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
