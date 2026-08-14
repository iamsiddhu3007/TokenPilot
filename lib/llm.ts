import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_LLM_MODEL = "meta/llama-3.3-70b-instruct";
export const DEFAULT_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";

/** Test that the configured LLM is reachable. Routes to Claude or NVIDIA based on model name. */
export async function testLLM(opts: {
  model: string;
  nvidiaApiKey: string;
  claudeApiKey?: string | null;
}): Promise<string> {
  const isClaude = opts.model.toLowerCase().startsWith("claude");

  if (isClaude && opts.claudeApiKey) {
    const client = new Anthropic({ apiKey: opts.claudeApiKey });
    const msg = await client.messages.create({
      model: opts.model,
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply with one word: working" }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text : "";
  }

  const client = new OpenAI({ apiKey: opts.nvidiaApiKey, baseURL: NVIDIA_BASE_URL });
  const completion = await client.chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: "Reply with one word: working" }],
    max_tokens: 10,
  });
  return completion.choices[0].message.content ?? "";
}
