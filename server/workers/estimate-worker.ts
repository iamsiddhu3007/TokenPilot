import "dotenv/config";
import { prisma } from "../db-client";
import { getChannel, QUEUES } from "../queue/connection";
import { runEstimator } from "../agents/estimator";
import { decrypt } from "../../lib/crypto";

interface EstimatePayload {
  jobId: string;
  projectId: string;
  title: string;
  body?: string;
}

async function start() {
  const channel = await getChannel();
  channel.prefetch(1);

  channel.consume(QUEUES.ESTIMATE, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as EstimatePayload;
      console.log(`[estimator] issue job ${payload.jobId}`);

      const cfg = await prisma.providerConfig.findUnique({ where: { projectId: payload.projectId } });
      if (!cfg?.encNvidiaApiKey) {
        console.warn("[estimator] no NVIDIA key — skipping");
        channel.ack(msg);
        return;
      }

      await runEstimator({
        issueJobId: payload.jobId,
        title: payload.title,
        body: payload.body ?? "",
        projectId: payload.projectId,
        claudeApiKey: decrypt(cfg.encApiKey),
        claudeModel: cfg.model,
        nvidiaApiKey: decrypt(cfg.encNvidiaApiKey),
        nvidiaEmbedModel: cfg.nvidiaEmbedModel ?? "nvidia/nv-embedqa-e5-v5",
      });

      channel.ack(msg);
    } catch (err) {
      console.error("[estimator] error:", err);
      channel.nack(msg, false, false);
    }
  });

  console.log("[estimate-worker] listening on", QUEUES.ESTIMATE);
}

start().catch(console.error);
