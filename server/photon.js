// photon.js — Spectrum (by Photon) integration: deliver the agent through a real
// messaging platform. This is the MANDATORY distribution layer. TokenPilot doesn't
// just show a board — it PROACTIVELY messages the team: "P0 added, budget
// reallocated, here's the new order."
//
// Provider: iMessage (enabled on this Photon project). To swap to Slack later,
// change the import + provider below to `slack` from 'spectrum-ts/providers/slack'
// and target by "teamId/channel" instead of a phone/handle.
//
// Real Spectrum API (spectrum-ts v1.18, verified against the package type defs):
//   import { Spectrum } from 'spectrum-ts';
//   import { imessage } from 'spectrum-ts/providers/imessage';
//   const app = await Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
//   for await (const [space, message] of app.messages) { await message.reply('...') }
//   const space = await imessage(app).space({ phone });   // open a DM
//   await app.send(space, 'proactive alert');
//
// iMessage credentials are managed by Photon Cloud, so imessage.config() needs no
// local args.

import 'dotenv/config';
import { Spectrum } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';

const HAS_PHOTON =
  !!process.env.PHOTON_PROJECT_ID && !!process.env.PHOTON_SECRET;

let _spectrum = null;        // the connected Spectrum instance (null until connected)
let _im = null;              // imessage provider instance, for opening DM spaces
let _status = 'console-fallback';
let _fallbackOnQuery = null;

// PHOTON_TARGET for iMessage is a recipient phone number or iMessage handle
// (e.g. "+15551234567" or "name@example.com").
function targetPhone(target) {
  return (target || process.env.PHOTON_TARGET || '').trim();
}

// Pull plain text out of an inbound Spectrum message (content is a discriminated union).
function messageText(message) {
  const c = message?.content;
  return c && c.type === 'text' ? c.text : '';
}

/**
 * initPhoton — connect Spectrum and register the inbound message handler.
 * @param onQuery  async (text) => replyString   // your agent's brain
 *
 * Never throws on connect failure: degrades to the console fallback so the
 * server still boots (the inbound flow stays testable via the /chat route).
 */
export async function initPhoton(onQuery) {
  _fallbackOnQuery = onQuery;

  if (!HAS_PHOTON) {
    console.log('[photon] no keys → console fallback. Inbound messages simulated via /chat route.');
    _status = 'console-fallback';
    return { status: _status };
  }

  try {
    _spectrum = await Spectrum({
      projectId: process.env.PHOTON_PROJECT_ID,
      projectSecret: process.env.PHOTON_SECRET,
      providers: [imessage.config()],
    });
    _im = imessage(_spectrum);
    _status = 'connected';

    // Drive the inbound loop in the background — do NOT await it (it runs forever).
    (async () => {
      try {
        for await (const [space, message] of _spectrum.messages) {
          try {
            if (message.direction && message.direction !== 'inbound') continue;
            const text = messageText(message);
            if (!text) continue;
            const reply = await onQuery(text);
            await _spectrum.responding(space, async () => {
              await message.reply(reply);
            });
          } catch (err) {
            console.error('[photon] inbound handler error:', err?.message || err);
          }
        }
      } catch (err) {
        console.error('[photon] message stream ended:', err?.message || err);
        _status = 'disconnected';
      }
    })();

    console.log('[photon] Spectrum connected (iMessage provider). Listening for inbound messages.');
    return { status: _status };
  } catch (err) {
    console.error('[photon] connect failed → console fallback:', err?.message || err);
    _spectrum = null;
    _im = null;
    _status = 'error-fallback';
    return { status: _status };
  }
}

/**
 * pushNotification — PROACTIVELY message the team (the "comes to you" magic).
 * Call this when a P0 lands, budget is reallocated, or budget runs low.
 * @param target  recipient phone/handle (defaults to PHOTON_TARGET)
 * @param text    the message
 */
export async function pushNotification(target, text) {
  if (!_spectrum || !_im) {
    console.log(`\n[photon→${target || 'console'}] ${text}\n`);
    return { delivered: false, simulated: true, text };
  }
  try {
    const phone = targetPhone(target);
    if (!phone) {
      console.warn('[photon] pushNotification: no recipient; set PHOTON_TARGET=<phone or iMessage handle>');
      return { delivered: false, simulated: true, text };
    }
    const space = await _im.space({ phone });
    await _spectrum.send(space, text);
    return { delivered: true, text };
  } catch (err) {
    console.error('[photon] pushNotification failed:', err?.message || err);
    return { delivered: false, error: String(err?.message || err), text };
  }
}

/**
 * handleInboundFallback — lets you test the inbound flow without a connected
 * messaging provider, by POSTing to /chat. Mirrors what the messages loop does.
 */
export async function handleInboundFallback(text) {
  if (_fallbackOnQuery) return _fallbackOnQuery(text);
  return 'Agent not initialized.';
}

export function photonStatus() {
  return _status;
}
