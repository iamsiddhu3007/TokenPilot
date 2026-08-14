import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5";

/** Test that a Claude API key works by sending a single token request. */
export async function testClaudeKey(apiKey: string, model: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: model || DEFAULT_CLAUDE_MODEL,
    max_tokens: 10,
    messages: [{ role: "user", content: "Reply with one word: working" }],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}
