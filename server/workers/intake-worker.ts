import "dotenv/config";
import { getChannel, QUEUES, publish } from "../queue/connection";

interface IngestPayload {
  jobId: string;
  projectId: string;
  issueNumber: number;
  title: string;
  body?: string;
  installationId?: string;
}

async function start() {
  const channel = await getChannel();
  channel.prefetch(1);

  channel.consume(QUEUES.INGEST, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as IngestPayload;
      console.log(`[intake] issue #${payload.issueNumber} job ${payload.jobId}`);

      // Fan out to priority + index queues in parallel
      publish(channel, QUEUES.PRIORITY, payload);
      publish(channel, QUEUES.INDEX, payload);

      channel.ack(msg);
    } catch (err) {
      console.error("[intake] error:", err);
      channel.nack(msg, false, false);
    }
  });

  console.log("[intake-worker] listening on", QUEUES.INGEST);
}

start().catch(console.error);
