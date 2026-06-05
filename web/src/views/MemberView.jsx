// Member dashboard: this member's usage + their assigned tickets as focused,
// expandable cards. Each card: date · priority · effort · recommended model
// (with a dropdown to pick a different model — effort & cost update live) ·
// deadline · suggestion · expected cost · Complete. Completed tickets drop out
// of the list and live only in History below.

import { useState } from 'react';
import {
  PriorityBadge, TierBadge, ModelBadge, Bar,
  money, tokensFmt, timeAgo, dateFmt, deadlineFmt, initials,
} from '../components/Bits.jsx';

function Stat({ label, value, sub, warn }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${warn ? 'warn' : ''}`}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Field({ label, children, warn }) {
  return (
    <div className="tk-field">
      <span className="tk-field-label">{label}</span>
      <span className={`tk-field-value ${warn ? 'warn' : ''}`}>{children}</span>
    </div>
  );
}

function TicketCard({ r, onComplete, completing }) {
  const [open, setOpen] = useState(false);
  // Default selected model = the suggested one; the dropdown can change it.
  const [tier, setTier] = useState(r.recommendedModelTier);
  const options = r.modelOptions || [{ tier: r.recommendedModelTier, model: r.recommendedModel, costUSD: r.estimatedCostUSD, effortHours: r.estimatedEffortHours, suggested: true }];
  const sel = options.find((o) => o.tier === tier) || options[0];
  const isSuggested = sel.tier === r.recommendedModelTier;
  const dl = deadlineFmt(r.deadline);
  const busy = completing === r.ticketId;

  return (
    <div className={`tk ${r.fitsBudget ? '' : 'over'}`}>
      <div className="tk-top">
        <PriorityBadge priority={r.priority} />
        <span className="tk-id">{r.ticketId}</span>
        <span className="tk-title">{r.title}</span>
        <button className="complete-btn" disabled={busy} onClick={() => onComplete(r.ticketId, sel.costUSD, sel.tier)}>
          {busy ? 'Completing…' : 'Complete'}
        </button>
      </div>

      <div className="tk-fields">
        <Field label="Created">{dateFmt(r.createdAt)}</Field>
        <Field label="Effort">{sel.effortHours}h</Field>
        <Field label="Deadline" warn={dl.overdue}>{dl.text}</Field>
        <Field label="Expected cost">{money(sel.costUSD)}</Field>
      </div>

      <div className="tk-model">
        <span className="tk-model-label">Model</span>
        <select className="model-select" value={tier} onChange={(e) => setTier(e.target.value)}>
          {options.map((o) => (
            <option key={o.tier} value={o.tier}>
              {o.model} · {money(o.costUSD)} · {o.effortHours}h{o.suggested ? '  (suggested)' : ''}
            </option>
          ))}
        </select>
        <ModelBadge model={sel.model} tier={sel.tier} />
        {!isSuggested && (
          <button className="tk-reset" onClick={() => setTier(r.recommendedModelTier)}>
            ↩ use suggested ({r.recommendedModel})
          </button>
        )}
      </div>
      <div className="tk-model-why">{isSuggested ? r.modelWhy : 'Manually selected — cost & effort updated above.'}</div>

      <div className="tk-suggest">💡 {r.suggestion}</div>

      <button className="tk-expand" onClick={() => setOpen((v) => !v)}>
        {open ? '▾ Hide details' : '▸ More details'}
      </button>

      {open && (
        <div className="tk-details">
          {r.description && <p className="tk-desc">{r.description}</p>}
          <div className="tk-detail-grid">
            <Field label="Type">{r.type}</Field>
            <Field label="Complexity">{r.complexity}</Field>
            <Field label="Est. tokens">{tokensFmt(r.estimatedTokens)}</Field>
            <Field label="Code surface">{r.intel.surface}{r.intel.totalLoc ? ` · ~${r.intel.totalLoc} LOC` : ''}</Field>
            <Field label="Assignee">{r.assignee?.name || '—'}</Field>
            <Field label="Priority rank">#{r.priorityRank}</Field>
          </div>
          {r.intel.summary && <div className="tk-intel">🔎 {r.intel.summary}</div>}
          {r.intel.relatedFiles?.length > 0 && (
            <div className="tk-files">
              <span className="muted">Likely files:</span> {r.intel.relatedFiles.slice(0, 6).join(', ')}
              {r.intel.relatedFiles.length > 6 ? ` +${r.intel.relatedFiles.length - 6} more` : ''}
            </div>
          )}
          <div className="tk-rationale">{r.rationale}</div>
        </div>
      )}
    </div>
  );
}

export default function MemberView({ data, onComplete, completing }) {
  if (!data) return null;
  const { member, usage, recommendations, history } = data;
  // Completed tickets leave the active list — they live in History only.
  const openTickets = recommendations.filter((r) => r.completedAt == null && r.actualCostUSD == null);

  return (
    <div className="view">
      <div className="member-banner">
        <span className="avatar lg">{initials(member.name)}</span>
        <div>
          <div className="member-name lg">{member.name}</div>
          <div className="member-role">{member.role} · {member.id}</div>
        </div>
      </div>

      {/* usage */}
      <section className="stat-row">
        <Stat label="Spent this period" value={money(usage.spentUSD)} sub={`of ${money(usage.weeklyBudgetUSD)} · ${usage.budgetUsedPct}%`} warn={usage.budgetUsedPct >= 85} />
        <Stat label="Tickets completed" value={usage.ticketsWorked} />
        <Stat label="Tokens used" value={tokensFmt(usage.tokens)} />
        <Stat label="Last active" value={timeAgo(usage.lastActiveTs)} />
      </section>
      <div className="member-budget wide">
        <Bar pct={usage.budgetUsedPct} warn={usage.budgetUsedPct >= 85} />
      </div>

      {/* open (assigned) tickets */}
      <h2 className="section-title">Assigned tickets <span className="muted">(recommended order)</span></h2>
      <section className="tk-list">
        {openTickets.length === 0 && <div className="empty">No open tickets assigned right now.</div>}
        {openTickets.map((r) => (
          <TicketCard key={r.ticketId} r={r} onComplete={onComplete} completing={completing} />
        ))}
      </section>

      {/* history (completed tickets land here) */}
      <h2 className="section-title">History <span className="muted">({history.length} completed)</span></h2>
      <section className="queue">
        <div className="queue-row hist-head">
          <span>Ticket</span><span>Pri</span><span>Model</span><span>Real cost</span><span>Tokens</span><span>Effort</span><span>When</span>
        </div>
        {history.length === 0 && <div className="empty">Nothing completed yet.</div>}
        {history.map((h, i) => (
          <div key={`${h.ticketId}-${i}`} className="queue-row hist">
            <span className="q-title"><span className="q-id">{h.ticketId}</span> {h.title}</span>
            <span><PriorityBadge priority={h.priority} /></span>
            <span><TierBadge tier={h.tier} /></span>
            <span>{money(h.costUSD)}</span>
            <span>{tokensFmt(h.tokens)}</span>
            <span>{h.effortHours}h</span>
            <span className="muted">{timeAgo(h.ts)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
