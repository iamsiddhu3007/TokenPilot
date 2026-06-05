// gateway.js — ALL model calls go through Butterbase's AI Model Gateway.
// Switching models = changing the model-name string. That's the whole point.
//
// Step 5 task for Claude Code: implement callModel() against the real Butterbase
// gateway endpoint from docs.butterbase.ai. Keep the tier → model mapping here.

import 'dotenv/config';

const HAS_GATEWAY = !!process.env.BUTTERBASE_GATEWAY_KEY;

// Tier → concrete model. Tune model names to whatever the gateway exposes.
export const MODEL_TIERS = {
  flagship: 'claude-opus-4-8',     // critical / heavy reasoning
  mid: 'claude-sonnet-4-6',        // moderate
  cheap: 'claude-haiku-4-5',       // grunt work / established context
};

// Rough per-1K-token prices (USD) for live cost display. Adjust to real rates.
export const TIER_PRICE_PER_1K = {
  flagship: 0.015,
  mid: 0.003,
  cheap: 0.0008,
};

/**
 * callModel — single entry point for every LLM call in the app.
 * @returns { text, tier, model, inputTokens, outputTokens, costUSD }
 */
export async function callModel(tier, prompt, { maxTokens = 800 } = {}) {
  const model = MODEL_TIERS[tier] || MODEL_TIERS.mid;

  if (!HAS_GATEWAY) {
    // Fallback so the demo never hard-fails: simulate a response + usage.
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(maxTokens * 0.5);
    return {
      text: `[simulated ${tier} response]`,
      tier,
      model,
      inputTokens,
      outputTokens,
      costUSD: estimateCost(tier, inputTokens, outputTokens),
      simulated: true,
    };
  }

  // TODO (Step 5): real Butterbase gateway call. Example skeleton:
  // const res = await fetch(`${process.env.BUTTERBASE_PROJECT_URL}/ai/gateway`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.BUTTERBASE_GATEWAY_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens }),
  // });
  // const data = await res.json();
  // const inputTokens = data.usage.input_tokens;
  // const outputTokens = data.usage.output_tokens;
  // return { text: data.content, tier, model, inputTokens, outputTokens,
  //          costUSD: estimateCost(tier, inputTokens, outputTokens) };

  throw new Error('Gateway configured but callModel not implemented yet (Step 5).');
}

export function estimateCost(tier, inputTokens, outputTokens) {
  const per1k = TIER_PRICE_PER_1K[tier] ?? TIER_PRICE_PER_1K.mid;
  return +(((inputTokens + outputTokens) / 1000) * per1k).toFixed(4);
}

export function gatewayStatus() {
  return HAS_GATEWAY ? 'connected' : 'simulated-fallback';
}
