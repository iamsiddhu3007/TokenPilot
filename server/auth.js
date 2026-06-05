// auth.js — Butterbase auth (now mandatory: database + AUTH + AI Gateway).
//
// Step (auth) task for Claude Code: replace the fallback with Butterbase's real
// auth (signup/login/session) from docs.butterbase.ai. Keep signatures so routes
// don't change. For a hackathon demo a single signed-in user is enough.

import 'dotenv/config';

const HAS_BUTTERBASE = !!process.env.BUTTERBASE_API_KEY;

// trivial in-memory session for the fallback
let _session = null;

export async function signUp(email, password) {
  if (!HAS_BUTTERBASE) {
    _session = { user: { id: 'demo-user', email }, token: 'demo-token' };
    return _session;
  }
  // TODO: await butterbase.auth.signUp({ email, password })
  _session = { user: { id: 'demo-user', email }, token: 'demo-token' };
  return _session;
}

export async function logIn(email, password) {
  if (!HAS_BUTTERBASE) {
    _session = { user: { id: 'demo-user', email }, token: 'demo-token' };
    return _session;
  }
  // TODO: await butterbase.auth.signInWithPassword({ email, password })
  _session = { user: { id: 'demo-user', email }, token: 'demo-token' };
  return _session;
}

export async function getSession() {
  return _session;
}

// Express middleware — gate the agent routes behind a session.
export function requireAuth(req, res, next) {
  // For the demo, auto-create a session if none (so you can demo without a login screen).
  if (!_session) _session = { user: { id: 'demo-user', email: 'demo@tokenpilot.ai' }, token: 'demo-token' };
  req.user = _session.user;
  next();
}

export function authStatus() {
  return HAS_BUTTERBASE ? 'butterbase-auth' : 'fallback-auth';
}
