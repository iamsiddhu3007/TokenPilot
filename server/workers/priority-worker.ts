import "dotenv/config";
import { prisma } from "../db-client";
import { getChannel, QUEUES, publish } from "../queue/connection";
import { runPriorityRouter } from "../agents/priority-router";
import { decrypt } from "../../lib/crypto";

interface PriorityPayload {
  jobId: string;
  projectId: string;
  issueNumber: number;
  title: string;
  body?: string;
}

async function start() {
  const channel = await getChannel();
  channel.prefetch(2);

  channel.consume(QUEUES.PRIORITY, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as PriorityPayload;
      console.log(`[priority] issue #${payload.issueNumber}`);

      const cfg = await prisma.providerConfig.findUnique({ where: { projectId: payload.projectId } });
      if (!cfg) {
        console.warn(`[priority] no provider config for project ${payload.projectId}`);
        channel.nack(msg, false, false);
        return;
      }

      await runPriorityRouter({
        issueJobId: payload.jobId,
        title: payload.title,
        body: payload.body ?? "",
        apiKey: decrypt(cfg.encApiKey),
        model: cfg.model,
      });

      // Route to estimator after priority is set
      publish(channel, QUEUES.ESTIMATE, payload);
      channel.ack(msg);
    } catch (err) {
      console.error("[priority] error:", err);
      channel.nack(msg, false, false);
    }
  });

  console.log("[priority-worker] listening on", QUEUES.PRIORITY);
}

start().catch(console.error);
