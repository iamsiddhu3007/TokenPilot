const BASE = process.env.LITELLM_BASE_URL ?? "http://localhost:4000";
const MASTER = process.env.LITELLM_MASTER_KEY ?? "";

export type ProviderId = "anthropic" | "openai" | "google";

export const PROVIDERS: { id: ProviderId; label: string; defaultModel: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)", defaultModel: "anthropic/claude-3-5-sonnet-20241022" },
  { id: "openai", label: "ChatGPT (OpenAI)", defaultModel: "openai/gpt-4o-mini" },
  { id: "google", label: "Gemini (Google)", defaultModel: "gemini/gemini-1.5-flash" },
];

export function defaultModel(provider: ProviderId): string {
  return PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "anthropic/claude-3-5-sonnet-20241022";
}

/**
 * Routes a chat completion through the LiteLLM gateway using the team's own
 * provider key (BYOK). The key is sent per-request and never stored by LiteLLM.
 */
export async function chatCompletion(opts: {
  model: string;
  apiKey: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MASTER}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      api_key: opts.apiKey,
      max_tokens: opts.maxTokens ?? 64,
    }),
  });

  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    const message =
      (json as { error?: { message?: string } })?.error?.message ?? raw.slice(0, 300);
    throw new Error(`gateway ${res.status}: ${message}`);
  }

  return (
    (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? ""
  );
}

/** Is the LiteLLM proxy up? */
export async function gatewayHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health/readiness`, {
      headers: { Authorization: `Bearer ${MASTER}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
