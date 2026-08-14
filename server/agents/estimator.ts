import Anthropic from "@anthropic-ai/sdk";
import { OpenAI } from "openai";
import { traceable } from "../tracing/langsmith";
import { prisma } from "../db-client";

type EstimateResult = {
  effortHours: number;
  confidence: number;
  rationale: string;
};

const runEstimator = traceable(
  async (opts: {
    issueJobId: string;
    title: string;
    body: string;
    projectId: string;
    claudeApiKey: string;
    claudeModel: string;
    nvidiaApiKey: string;
    nvidiaEmbedModel: string;
  }): Promise<EstimateResult> => {
    await prisma.agentRun.create({
      data: { issueJobId: opts.issueJobId, agentType: "estimator", status: "running" },
    });

    const runRecord = await prisma.agentRun.findFirst({
      where: { issueJobId: opts.issueJobId, agentType: "estimator", status: "running" },
      orderBy: { startedAt: "desc" },
    });

    let result: EstimateResult = { effortHours: 4, confidence: 0.5, rationale: "default estimate" };

    try {
      // 1. Embed the issue text
      const embed = new OpenAI({
        apiKey: opts.nvidiaApiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      });
      const issueText = `${opts.title}\n${opts.body ?? ""}`;
      const embeddingRes = await embed.embeddings.create({
        model: opts.nvidiaEmbedModel,
        input: issueText,
        encoding_format: "float",
      });
      const vector = embeddingRes.data[0].embedding;

      // 2. Find similar code chunks via pgvector
      const similar = await prisma.$queryRawUnsafe<{ id: string; content: string; file_path: string }[]>(
        `SELECT id, content, file_path FROM "code_chunk"
         WHERE "project_id" = $1 AND "embedding" IS NOT NULL
         ORDER BY "embedding" <=> $2::vector
         LIMIT 5`,
        opts.projectId,
        JSON.stringify(vector),
      );

      // 3. Claude call with retrieved context
      const client = new Anthropic({ apiKey: opts.claudeApiKey });
      const context = similar.length
        ? similar.map((s) => `// ${s.file_path}\n${s.content}`).join("\n---\n")
        : "(no indexed code yet)";

      const message = await client.messages.create({
        model: opts.claudeModel,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `Estimate implementation effort for this GitHub issue. Respond with JSON only (no markdown):
{"effortHours":number,"confidence":0.0-1.0,"rationale":"one sentence"}

Issue: ${opts.title}
${opts.body ?? ""}

Relevant code:
${context}`,
          },
        ],
      });

      const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
      try {
        result = JSON.parse(text) as EstimateResult;
      } catch {
        // keep default
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

    // Store estimate
    const similarIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "code_chunk" WHERE "project_id" = $1 AND "embedding" IS NOT NULL ORDER BY "embedding" <=> (SELECT "embedding" FROM "code_chunk" WHERE "project_id" = $1 LIMIT 1) LIMIT 5`,
      opts.projectId,
    ).catch(() => [] as { id: string }[]);

    await prisma.issueEstimate.upsert({
      where: { issueJobId: opts.issueJobId },
      create: {
        issueJobId: opts.issueJobId,
        effortHours: result.effortHours,
        confidence: result.confidence,
        rationale: result.rationale,
        similarChunks: similarIds.map((s) => s.id),
      },
      update: {
        effortHours: result.effortHours,
        confidence: result.confidence,
        rationale: result.rationale,
      },
    });

    await prisma.issueJob.update({
      where: { id: opts.issueJobId },
      data: { status: "done" },
    });

    return result;
  },
  { name: "estimator" },
);

export { runEstimator };
