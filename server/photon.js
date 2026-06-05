// photon.js — Spectrum (by Photon) integration: deliver the agent through a real
// messaging platform (Slack / iMessage / Telegram / WhatsApp).
//
// This is the MANDATORY distribution layer. TokenPilot doesn't just show a board —
// it PROACTIVELY messages the team: "P0 added, budget reallocated, here's the new order."
//
// Pattern (from Spectrum docs):
//   const spectrum = Spectrum({ providers: [...], config: {...} })
//   spectrum.onMessage(async ({ space, message }) => { ... await space.send(reply) })
//   await spectrum.send(target, text)
//
// Step (Photon) task for Claude Code: `npm install spectrum-ts`, sign up at
// app.photon.codes for PROJECT_ID + SECRET, pick a provider (Slack is judged-friendly),
// and replace the fallback below with the real Spectrum client. Keep signatures.

import 'dotenv/config';

const HAS_PHOTON =
  !!process.env.PHOTON_PROJECT_ID && !!process.env.PHOTON_SECRET;

let _spectrum = null;

/**
 * initPhoton — set up Spectrum and register the inbound message handler.
 * @param onQuery  async (text) => replyString   // your agent's brain
 */
export async function initPhoton(onQuery) {
  if (!HAS_PHOTON) {
    console.log('[photon] no keys → console fallback. Inbound messages simulated via /chat route.');
    _fallbackOnQuery = onQuery;
    return { status: 'console-fallback' };
  }

  // TODO (Photon step): real wiring —
  // import { Spectrum } from 'spectrum-ts';
  // _spectrum = Spectrum({
  //   providers: [/* slack(...) | imessage() | telegram(...) */],
  //   config: { projectId: process.env.PHOTON_PROJECT_ID, secret: process.env.PHOTON_SECRET },
  // });
  // _spectrum.onMessage(async ({ space, message }) => {
  //   if (message.type === 'text') {
  //     const reply = await onQuery(message.content);
  //     await space.send(reply);
  //   }
  // });
  // return { status: 'connected' };

  throw new Error('Photon configured but Spectrum client not wired yet (Photon step).');
}

let _fallbackOnQuery = null;

/**
 * pushNotification — PROACTIVELY message the team (the "comes to you" magic).
 * Call this when a P0 lands, budget is reallocated, or budget runs low.
 * @param target  channel / phone / handle (or omit in fallback)
 * @param text    the message
 */
export async function pushNotification(target, text) {
  if (!HAS_PHOTON) {
    console.log(`\n[photon→${target || 'console'}] ${text}\n`);
    return { delivered: false, simulated: true, text };
  }
  // TODO (Photon step): await _spectrum.send(target, text);
  return { delivered: true, text };
}

/**
 * handleInboundFallback — lets you test the inbound flow without Photon keys,
 * by POSTing to /chat. Mirrors what spectrum.onMessage would do.
 */
export async function handleInboundFallback(text) {
  if (_fallbackOnQuery) return _fallbackOnQuery(text);
  return 'Agent not initialized.';
}

export function photonStatus() {
  return HAS_PHOTON ? 'connected' : 'console-fallback';
}
