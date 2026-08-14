import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_LLM_MODEL = "meta/llama-3.3-70b-instruct";

type Message = { role: "system" | "user" | "assistant"; content: string };
type LLMResult = { text: string; promptTokens: number; completionTokens: number };

/**
 * Routes to Anthropic SDK for claude-* models (requires claudeApiKey),
 * or to NVIDIA's OpenAI-compatible API for everything else.
 */
export async function callLLM(opts: {
  model: string;
  nvidiaApiKey: string;
  claudeApiKey?: string | null;
  messages: Message[];
  maxTokens?: number;
}): Promise<LLMResult> {
  const isClaude = opts.model.toLowerCase().startsWith("claude");

  if (isClaude && opts.claudeApiKey) {
    const client = new Anthropic({ apiKey: opts.claudeApiKey, timeout: 60_000 });
    const msg = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 512,
      messages: opts.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
    return {
      text: msg.content[0].type === "text" ? msg.content[0].text : "",
      promptTokens: msg.usage.input_tokens,
      completionTokens: msg.usage.output_tokens,
    };
  }

  // NVIDIA (or any OpenAI-compatible) path
  const client = new OpenAI({ apiKey: opts.nvidiaApiKey, baseURL: NVIDIA_BASE_URL, timeout: 60_000 });
  const completion = await client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    temperature: 0.2,
    top_p: 0.7,
    max_tokens: opts.maxTokens ?? 512,
  });
  return {
    text: completion.choices[0].message.content ?? "",
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}
