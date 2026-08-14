import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_LLM_MODEL = "meta/llama-3.1-8b-instruct";
export const DEFAULT_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";

export async function testLLM(opts: {
  model: string;
  nvidiaApiKey: string;
  claudeApiKey?: string | null;
}): Promise<string> {
  const isClaude = opts.model.toLowerCase().startsWith("claude");

  if (isClaude) {
    if (!opts.claudeApiKey) throw new Error("Claude model selected but no Claude API key saved");
    const client = new Anthropic({ apiKey: opts.claudeApiKey, timeout: 30_000 });
    const msg = await client.messages.create({
      model: opts.model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with one word: working" }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  }

  // Use streaming for NVIDIA — avoids the free-tier non-streaming timeout issue
  const client = new OpenAI({ apiKey: opts.nvidiaApiKey, baseURL: NVIDIA_BASE_URL, timeout: 60_000 });
  const stream = await client.chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: "Reply with one word: working" }],
    temperature: 0.2,
    max_tokens: 16,
    stream: true,
  });

  let text = "";
  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? "";
  }
  return text.trim();
}
