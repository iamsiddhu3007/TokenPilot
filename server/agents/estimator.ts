import OpenAI from "openai";
import { traceable } from "../tracing/langsmith";
import { prisma } from "../db-client";
import { callLLM, NVIDIA_BASE_URL } from "../utils/llm";

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
    model: string;
    nvidiaApiKey: string;
    claudeApiKey?: string | null;
    nvidiaEmbedModel: string;
  }): Promise<EstimateResult> => {
    const runRecord = await prisma.agentRun.create({
      data: { issueJobId: opts.issueJobId, agentType: "estimator", status: "running" },
    });

    let result: EstimateResult = { effortHours: 4, confidence: 0.5, rationale: "default estimate" };

    try {
      // 1. Embed the issue text via NVIDIA
      const embedClient = new OpenAI({ apiKey: opts.nvidiaApiKey, baseURL: NVIDIA_BASE_URL });
      const issueText = `${opts.title}\n${opts.body ?? ""}`;
      const embeddingRes = await embedClient.embeddings.create({
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

      const context = similar.length
        ? similar.map((s) => `// ${s.file_path}\n${s.content}`).join("\n---\n")
        : "(no indexed code yet)";

      // 3. LLM call — NVIDIA model or Claude
      const { text, promptTokens, completionTokens } = await callLLM({
        model: opts.model,
        nvidiaApiKey: opts.nvidiaApiKey,
        claudeApiKey: opts.claudeApiKey,
        maxTokens: 400,
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

      try {
        result = JSON.parse(text) as EstimateResult;
      } catch {
        // keep default
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

    await prisma.issueEstimate.upsert({
      where: { issueJobId: opts.issueJobId },
      create: {
        issueJobId: opts.issueJobId,
        effortHours: result.effortHours,
        confidence: result.confidence,
        rationale: result.rationale,
        similarChunks: [],
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
