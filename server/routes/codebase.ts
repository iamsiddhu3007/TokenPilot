import { Router } from "express";
import { prisma } from "../db-client";
import { requireInternalKey } from "../middleware/auth";
import { callLLM } from "../utils/llm";
import { decrypt } from "../../lib/crypto";

export const codebaseRouter = Router();

// GET /api/codebase/:projectId — files with chunk count + existing summaries
codebaseRouter.get("/:projectId", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);

    const chunks = await prisma.codeChunk.findMany({
      where: { projectId },
      select: { filePath: true, chunkIndex: true, content: true },
      orderBy: [{ filePath: "asc" }, { chunkIndex: "asc" }],
    });

    const summaries = await prisma.fileSummary.findMany({ where: { projectId } });
    const summaryMap = Object.fromEntries(summaries.map((s) => [s.filePath, s.summary]));

    // Group chunks by file
    const fileMap: Record<string, { chunkCount: number; preview: string; summary: string | null }> = {};
    for (const chunk of chunks) {
      if (!fileMap[chunk.filePath]) {
        fileMap[chunk.filePath] = { chunkCount: 0, preview: chunk.content.slice(0, 200), summary: summaryMap[chunk.filePath] ?? null };
      }
      fileMap[chunk.filePath].chunkCount++;
    }

    const files = Object.entries(fileMap).map(([filePath, data]) => ({ filePath, ...data }));
    res.json({ files, totalFiles: files.length, summarized: summaries.length });
  } catch (err) {
    console.error("[codebase]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/codebase/:projectId/summarize — generate summaries for all files
codebaseRouter.post("/:projectId/summarize", requireInternalKey, async (req, res) => {
  try {
    const projectId = String(req.params.projectId);

    const cfg = await prisma.providerConfig.findUnique({ where: { projectId } });
    if (!cfg?.encNvidiaApiKey) {
      res.status(400).json({ error: "No NVIDIA API key configured" });
      return;
    }

    const nvidiaApiKey = decrypt(cfg.encNvidiaApiKey);
    const claudeApiKey = cfg.encApiKey ? decrypt(cfg.encApiKey) : null;

    // Get all chunks grouped by file
    const chunks = await prisma.codeChunk.findMany({
      where: { projectId },
      orderBy: [{ filePath: "asc" }, { chunkIndex: "asc" }],
    });

    const fileMap: Record<string, string[]> = {};
    for (const chunk of chunks) {
      if (!fileMap[chunk.filePath]) fileMap[chunk.filePath] = [];
      fileMap[chunk.filePath].push(chunk.content);
    }

    const files = Object.entries(fileMap);
    if (!files.length) {
      res.status(400).json({ error: "No indexed files found. Run Sync Issues first to index the codebase." });
      return;
    }

    let done = 0;
    for (const [filePath, fileChunks] of files) {
      const fullContent = fileChunks.join("\n");
      const truncated = fullContent.slice(0, 3000); // keep prompt reasonable

      try {
        const { text } = await callLLM({
          model: cfg.model,
          nvidiaApiKey,
          claudeApiKey,
          maxTokens: 200,
          messages: [
            {
              role: "user",
              content: `Analyze this source file and respond with a JSON object only (no markdown):
{"summary":"one sentence describing what this file does","exports":"comma-separated list of the main functions, classes, or exports"}

File: ${filePath}
\`\`\`
${truncated}
\`\`\``,
            },
          ],
        });

        let parsed: { summary: string; exports: string } = { summary: "", exports: "" };
        try {
          parsed = JSON.parse(text) as typeof parsed;
        } catch {
          parsed = { summary: text.slice(0, 200), exports: "" };
        }

        const summaryText = parsed.exports
          ? `${parsed.summary} | Exports: ${parsed.exports}`
          : parsed.summary;

        await prisma.fileSummary.upsert({
          where: { projectId_filePath: { projectId, filePath } },
          create: { projectId, filePath, summary: summaryText },
          update: { summary: summaryText },
        });

        done++;
      } catch (fileErr) {
        console.error(`[summarize] failed ${filePath}:`, (fileErr as Error).message);
      }
    }

    res.json({ ok: true, summarized: done, total: files.length });
  } catch (err) {
    console.error("[summarize]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});
