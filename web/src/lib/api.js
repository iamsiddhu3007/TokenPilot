// Backend client. Uses the Vite proxy (/api → :3001).

const BASE = '/api';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  health: () => req('/health'),
  // dashboards
  manager: () => req('/team'),
  member: (id) => req(`/team/${id}`),
  // two-agent pipeline (raw)
  recommendations: () => req('/recommendations'),
  intel: () => req('/intel'),
  // actions
  work: (id, assigneeId) =>
    req(`/work/${id}`, { method: 'POST', body: JSON.stringify({ assigneeId }) }),
  simulateModelUpdate: () => req('/simulate-model-update', { method: 'POST' }),
};
