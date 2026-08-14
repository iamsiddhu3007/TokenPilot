import amqplib, { Channel, ChannelModel } from "amqplib";

export const QUEUES = {
  INGEST: "issue.ingest",
  PRIORITY: "issue.priority",
  INDEX: "issue.index",
  ESTIMATE: "issue.estimate",
} as const;

let _connection: ChannelModel | null = null;
let _channel: Channel | null = null;

export async function getChannel(): Promise<Channel> {
  if (_channel) return _channel;
  _connection = await amqplib.connect(process.env.RABBITMQ_URL ?? "amqp://localhost");
  _channel = await (_connection as ChannelModel).createChannel();
  for (const q of Object.values(QUEUES)) {
    await (_channel as Channel).assertQueue(q, { durable: true });
  }
  return _channel as Channel;
}

export function publish(channel: Channel, queue: string, message: object): void {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
}
