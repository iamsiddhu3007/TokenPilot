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

// Shows the concrete model name (e.g. "claude-opus-4-8"), coloured by its tier.
export function ModelBadge({ model, tier }) {
  return (
    <span className="model-badge" style={{ borderColor: TIER_COLOR[tier] || '#3b82f6', color: TIER_COLOR[tier] || '#3b82f6' }}>
      {model || tier}
    </span>
  );
}

// Horizontal bar chart (SVG-free, CSS). data: [{label, value, sub?, color?}].
export function BarChart({ data, unit = '$' }) {
  const max = Math.max(0.0001, ...data.map((d) => d.value));
  return (
    <div className="chart-bars">
      {data.map((d, i) => (
        <div key={i} className="cbar-row">
          <span className="cbar-label">{d.label}</span>
          <div className="cbar-track">
            <div className="cbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || 'var(--accent)' }} />
          </div>
          <span className="cbar-val">{unit}{(d.value).toFixed(2)}{d.sub ? <span className="muted"> · {d.sub}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}

// Donut gauge (SVG). pct 0-100.
export function Donut({ pct, label, sub, warn }) {
  const r = 34, c = 2 * Math.PI * r, p = Math.min(100, Math.max(0, pct || 0));
  const off = c - (p / 100) * c;
  return (
    <div className="donut">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={warn ? '#f59e0b' : 'var(--accent)'} strokeWidth="9"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 42 42)" />
        <text x="42" y="40" textAnchor="middle" className="donut-pct">{Math.round(p)}%</text>
        {sub && <text x="42" y="55" textAnchor="middle" className="donut-sub">{sub}</text>}
      </svg>
      <div className="donut-label">{label}</div>
    </div>
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

// "Jun 3, 2026" — the date a ticket was created.
export function dateFmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Relative deadline → { text, overdue }. e.g. "in 4 days" / "due today" / "2 days overdue".
export function deadlineFmt(iso) {
  if (!iso) return { text: '—', overdue: false };
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { text: 'due today', overdue: true };
  if (days === 1) return { text: 'in 1 day', overdue: false };
  return { text: `in ${days} days`, overdue: false };
}
