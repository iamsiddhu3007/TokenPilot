import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_LLM_MODEL = "meta/llama-3.1-8b-instruct";

type Message = { role: "system" | "user" | "assistant"; content: string };
type LLMResult = { text: string; promptTokens: number; completionTokens: number };

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

  // NVIDIA path — use streaming to avoid hanging on overloaded free-tier servers
  const client = new OpenAI({ apiKey: opts.nvidiaApiKey, baseURL: NVIDIA_BASE_URL, timeout: 90_000 });
  const stream = await client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    temperature: 0.2,
    top_p: 0.7,
    max_tokens: opts.maxTokens ?? 512,
    stream: true,
  });

  let text = "";
  let promptTokens = 0;
  let completionTokens = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    text += delta;
    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens ?? 0;
      completionTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  return { text, promptTokens, completionTokens };
}
