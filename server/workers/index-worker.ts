import "dotenv/config";
import { App } from "octokit";
import { prisma } from "../db-client";
import { getChannel, QUEUES } from "../queue/connection";
import { runIndexer } from "../agents/indexer";
import { decrypt } from "../../lib/crypto";

interface IndexPayload {
  jobId: string;
  projectId: string;
  installationId?: string;
}

function getOctokitApp() {
  return new App({
    appId: process.env.GITHUB_APP_ID ?? "",
    privateKey: (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET ?? "" },
  });
}

async function start() {
  const channel = await getChannel();
  channel.prefetch(3); // allow parallel indexing

  channel.consume(QUEUES.INDEX, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as IndexPayload;
      console.log(`[indexer] project ${payload.projectId}`);

      const cfg = await prisma.providerConfig.findUnique({ where: { projectId: payload.projectId } });
      const gh = await prisma.githubConnection.findUnique({ where: { projectId: payload.projectId } });

      if (!cfg?.encNvidiaApiKey || !gh?.installationId || !gh.owner || !gh.name) {
        console.warn("[indexer] missing config — skipping");
        channel.ack(msg);
        return;
      }

      const octokitApp = getOctokitApp();
      const octokit = await octokitApp.getInstallationOctokit(Number(gh.installationId));

      // Fetch top-level TS/JS/Python files (keep it simple)
      const { data: contents } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: gh.owner,
        repo: gh.name,
        path: "",
      });

      const files = Array.isArray(contents)
        ? contents.filter((f: { type: string; name: string }) =>
            f.type === "file" && /\.(ts|tsx|js|jsx|py|md)$/.test(f.name),
          )
        : [];

      for (const file of files.slice(0, 20)) { // limit to 20 files
        try {
          const { data: fileData } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner: gh.owner,
            repo: gh.name,
            path: file.path,
          });
          const content = Buffer.from((fileData as { content: string }).content, "base64").toString("utf8");

          await runIndexer({
            projectId: payload.projectId,
            filePath: file.path,
            content,
            sha: (fileData as { sha: string }).sha,
            nvidiaApiKey: decrypt(cfg.encNvidiaApiKey!),
            nvidiaEmbedModel: cfg.nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5",
          });
        } catch (fileErr) {
          console.error(`[indexer] failed file ${file.path}:`, fileErr);
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
