import { OpenAI } from "openai";
import { traceable } from "../tracing/langsmith";
import { prisma } from "../db-client";

const CHUNK_SIZE = 400;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(" "));
  }
  return chunks.length ? chunks : [text];
}

const runIndexer = traceable(
  async (opts: {
    projectId: string;
    filePath: string;
    content: string;
    sha?: string;
    nvidiaApiKey: string;
    nvidiaEmbedModel: string;
  }): Promise<void> => {
    const embed = new OpenAI({
      apiKey: opts.nvidiaApiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
    });

    const chunks = chunkText(opts.content);

    for (let i = 0; i < chunks.length; i++) {
      const embeddingRes = await embed.embeddings.create({
        model: opts.nvidiaEmbedModel,
        input: chunks[i],
        encoding_format: "float",
      });
      const vector = embeddingRes.data[0].embedding;

      // Upsert the chunk record
      const existing = await prisma.codeChunk.findUnique({
        where: {
          projectId_filePath_chunkIndex: {
            projectId: opts.projectId,
            filePath: opts.filePath,
            chunkIndex: i,
          },
        },
      });

      let chunkId: string;
      if (existing) {
        await prisma.codeChunk.update({
          where: { id: existing.id },
          data: { content: chunks[i], sha: opts.sha },
        });
        chunkId = existing.id;
      } else {
        const created = await prisma.codeChunk.create({
          data: {
            projectId: opts.projectId,
            filePath: opts.filePath,
            chunkIndex: i,
            content: chunks[i],
            sha: opts.sha,
          },
        });
        chunkId = created.id;
      }

      // Update embedding via raw SQL (vector column not tracked by Prisma)
      await prisma.$executeRawUnsafe(
        `UPDATE "code_chunk" SET "embedding" = $1::vector WHERE "id" = $2`,
        JSON.stringify(vector),
        chunkId,
      );
    }

    // Delete stale chunks beyond current count
    await prisma.codeChunk.deleteMany({
      where: {
        projectId: opts.projectId,
        filePath: opts.filePath,
        chunkIndex: { gte: chunks.length },
      },
    });
  },
  { name: "indexer" },
);

export { runIndexer };
