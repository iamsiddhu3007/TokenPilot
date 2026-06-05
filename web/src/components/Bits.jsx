// Small shared presentational pieces + formatters.

export const PRIORITY_COLOR = { P0: '#ef4444', P1: '#f59e0b', P2: '#3b82f6', P3: '#64748b' };
export const TIER_COLOR = { flagship: '#a855f7', mid: '#3b82f6', cheap: '#22c55e' };

export function PriorityBadge({ priority }) {
  return (
    <span className="badge" style={{ background: PRIORITY_COLOR[priority] || '#64748b' }}>
      {priority}
    </span>
  );
}

export function TierBadge({ tier }) {
  return (
    <span className="tier-badge" style={{ background: TIER_COLOR[tier] || '#3b82f6' }}>
      {tier}
    </span>
  );
}

// A labelled progress bar (used for budget usage).
export function Bar({ pct, warn }) {
  return (
    <div className="bar-track">
      <div
        className="bar-fill"
        style={{
          width: `${Math.min(100, pct || 0)}%`,
          background: warn ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#6366f1,#a855f7)',
        }}
      />
    </div>
  );
}

export const money = (n) => `$${(n ?? 0).toFixed(2)}`;
export const tokensFmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n ?? 0}`);

export function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function initials(name = '') {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
