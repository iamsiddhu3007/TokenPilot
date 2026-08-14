import "dotenv/config";
import { prisma } from "../db-client";
import { getChannel, QUEUES } from "../queue/connection";
import { runIndexer } from "../agents/indexer";
import { decrypt } from "../../lib/crypto";

interface IndexPayload {
  jobId: string;
  projectId: string;
}

async function githubFetch(url: string, pat?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (pat) headers.Authorization = `Bearer ${pat}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

async function start() {
  const channel = await getChannel();
  channel.prefetch(3);

  channel.consume(QUEUES.INDEX, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as IndexPayload;
      console.log(`[indexer] project ${payload.projectId}`);

      const cfg = await prisma.providerConfig.findUnique({ where: { projectId: payload.projectId } });
      const gh = await prisma.githubConnection.findUnique({ where: { projectId: payload.projectId } });

      if (!cfg?.encNvidiaApiKey || !gh?.owner || !gh?.name) {
        console.warn("[indexer] missing config — skipping");
        channel.ack(msg);
        return;
      }

      const pat = gh.encGithubPat ? decrypt(gh.encGithubPat) : undefined;
      const base = `https://api.github.com/repos/${gh.owner}/${gh.name}`;

      const contents = await githubFetch(`${base}/contents/`, pat) as
        { type: string; name: string; path: string; sha: string }[];

      const files = Array.isArray(contents)
        ? contents.filter((f) => f.type === "file" && /\.(ts|tsx|js|jsx|py|md)$/.test(f.name))
        : [];

      for (const file of files.slice(0, 20)) {
        try {
          const fileData = await githubFetch(`${base}/contents/${file.path}`, pat) as
            { content: string; sha: string };
          const content = Buffer.from(fileData.content, "base64").toString("utf8");

          await runIndexer({
            projectId: payload.projectId,
            filePath: file.path,
            content,
            sha: fileData.sha,
            nvidiaApiKey: decrypt(cfg.encNvidiaApiKey!),
            nvidiaEmbedModel: cfg.nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5",
          });
        } catch (fileErr) {
          console.error(`[indexer] failed ${file.path}:`, fileErr);
        }
      }

      channel.ack(msg);
    } catch (err) {
      console.error("[indexer] error:", err);
      channel.nack(msg, false, false);
    }
  });

  console.log("[index-worker] listening on", QUEUES.INDEX);
}

start().catch(console.error);
