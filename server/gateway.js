// gateway.js — ALL model calls go through Butterbase's AI Model Gateway.
// Switching models = changing the model-name string. That's the whole point.
//
// Butterbase gateway is OpenAI-compatible (verified at docs.butterbase.ai/api-reference/ai-api):
//   POST https://api.butterbase.ai/v1/{app_id}/chat/completions
//   Authorization: Bearer {BUTTERBASE_GATEWAY_KEY}
//   body:     { model: "anthropic/claude-...", messages: [...], max_tokens }
//   response: choices[0].message.content + usage.{prompt_tokens,completion_tokens}

import 'dotenv/config';

const HAS_GATEWAY = !!process.env.BUTTERBASE_GATEWAY_KEY && !!process.env.BUTTERBASE_APP_ID;
const GATEWAY_BASE = process.env.BUTTERBASE_GATEWAY_URL || 'https://api.butterbase.ai/v1';
const APP_ID = process.env.BUTTERBASE_APP_ID || '';

// Tier → concrete model shown in the UI / dashboards.
export const MODEL_TIERS = {
  flagship: 'claude-opus-4.8',     // critical / heavy reasoning
  mid: 'claude-sonnet-4.6',        // moderate
  cheap: 'claude-haiku-4.5',       // grunt work / established context
};

// Tier → Butterbase gateway model slug (provider/model), verified against the
// live catalog. Override per tier via BUTTERBASE_MODEL_FLAGSHIP / _MID / _CHEAP.
const GATEWAY_MODELS = {
  flagship: process.env.BUTTERBASE_MODEL_FLAGSHIP || 'anthropic/claude-opus-4.8',
  mid: process.env.BUTTERBASE_MODEL_MID || 'anthropic/claude-sonnet-4.6',
  cheap: process.env.BUTTERBASE_MODEL_CHEAP || 'anthropic/claude-haiku-4.5',
};

// Rough per-1K-token prices (USD) for live cost display. Adjust to real rates.
export const TIER_PRICE_PER_1K = {
  flagship: 0.015,
  mid: 0.003,
  cheap: 0.0008,
};

// Simulated response so the demo never hard-fails (no key, or a gateway error).
function simulate(tier, model, prompt, maxTokens, reason) {
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
    ...(reason ? { reason } : {}),
  };
}

/**
 * callModel — single entry point for every LLM call in the app.
 * @returns { text, tier, model, inputTokens, outputTokens, costUSD, simulated? }
 */
export async function callModel(tier, prompt, { maxTokens = 800 } = {}) {
  const model = MODEL_TIERS[tier] || MODEL_TIERS.mid;

  if (!HAS_GATEWAY) {
    return simulate(tier, model, prompt, maxTokens);
  }

  const gatewayModel = GATEWAY_MODELS[tier] || GATEWAY_MODELS.mid;
  const url = `${GATEWAY_BASE}/${APP_ID}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BUTTERBASE_GATEWAY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[gateway] ${res.status} from Butterbase → simulating. ${body.slice(0, 160)}`);
      return simulate(tier, model, prompt, maxTokens, `gateway ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = data.usage?.completion_tokens ?? Math.ceil(text.length / 4);
    return {
      text,
      tier,
      model,
      inputTokens,
      outputTokens,
      costUSD: estimateCost(tier, inputTokens, outputTokens),
    };
  } catch (err) {
    console.warn('[gateway] call failed → simulating:', err?.message || err);
    return simulate(tier, model, prompt, maxTokens, 'gateway error');
  }
}

export function estimateCost(tier, inputTokens, outputTokens) {
  const per1k = TIER_PRICE_PER_1K[tier] ?? TIER_PRICE_PER_1K.mid;
  return +(((inputTokens + outputTokens) / 1000) * per1k).toFixed(4);
}

export function gatewayStatus() {
  return HAS_GATEWAY ? 'connected' : 'simulated-fallback';
}
