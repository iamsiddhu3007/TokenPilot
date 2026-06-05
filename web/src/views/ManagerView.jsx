// Manager / team-lead dashboard: budget + burn-rate, usage charts, per-member
// load, an add-ticket form, and the team-wide work queue with live sorting and
// drag-to-reorder. Click the Codebase stat to open the Agent-1 indexing page.

import { useState, useMemo } from 'react';
import { PriorityBadge, ModelBadge, Bar, BarChart, Donut, money, initials, dateFmt } from '../components/Bits.jsx';

function Stat({ label, value, sub, warn, onClick }) {
  return (
    <div className={`stat ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${warn ? 'warn' : ''}`}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const PRIO_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
function sortQueue(queue, key) {
  const q = [...queue];
  if (key === 'priority') return q.sort((a, b) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]);
  if (key === 'cost') return q.sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD);
  if (key === 'effort') return q.sort((a, b) => b.estimatedEffortHours - a.estimatedEffortHours);
  if (key === 'created') return q.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return q; // 'rank' — keep the agent's recommended order
}

function AddTicket({ members, onAdd }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', priority: 'P2', type: 'feature', assigneeId: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    if (!f.title.trim()) return;
    setBusy(true);
    try { await onAdd(f); setF({ title: '', description: '', priority: 'P2', type: 'feature', assigneeId: '' }); setOpen(false); }
    finally { setBusy(false); }
  }

  if (!open) return <button className="add-toggle" onClick={() => setOpen(true)}>+ Add ticket</button>;
  return (
    <div className="add-form">
      <div className="add-row">
        <input className="add-input grow" placeholder="Ticket title" value={f.title} onChange={set('title')} autoFocus />
        <select className="add-input" value={f.priority} onChange={set('priority')}>
          {['P0', 'P1', 'P2', 'P3'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="add-input" value={f.type} onChange={set('type')}>
          {['bug', 'feature', 'refactor', 'docs'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="add-input" value={f.assigneeId} onChange={set('assigneeId')}>
          <option value="">Auto-assign</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <textarea className="add-input area" placeholder="Description (optional)" value={f.description} onChange={set('description')} rows={2} />
      <div className="add-actions">
        <button className="add-cancel" onClick={() => setOpen(false)}>Cancel</button>
        <button className="add-submit" disabled={busy || !f.title.trim()} onClick={submit}>{busy ? 'Adding…' : 'Add ticket'}</button>
      </div>
    </div>
  );
}

export default function ManagerView({ data, onOpenMember, onAddTicket, onReorder, onOpenIndexing }) {
  const [sortKey, setSortKey] = useState('rank');
  const [dragOrder, setDragOrder] = useState(null); // array of ticketIds after a manual drag
  const [dragFrom, setDragFrom] = useState(null);
  const [applying, setApplying] = useState(false);

  // ALL hooks must run before any early return — derive the displayed order here.
  const queue = data?.queue || [];
  const displayed = useMemo(() => {
    const sorted = sortQueue(queue, sortKey);
    if (!dragOrder) return sorted;
    const byId = Object.fromEntries(sorted.map((r) => [r.ticketId, r]));
    return dragOrder.map((id) => byId[id]).filter(Boolean);
  }, [queue, sortKey, dragOrder]);

  if (!data) return null;
  const { team, members, codebasePresent, indexedFiles, budget } = data;

  function onDrop(toIdx) {
    if (dragFrom == null) return;
    const ids = displayed.map((r) => r.ticketId);
    const [moved] = ids.splice(dragFrom, 1);
    ids.splice(toIdx, 0, moved);
    setDragOrder(ids);
    setDragFrom(null);
  }
  async function applyOrder() {
    setApplying(true);
    try { await onReorder(displayed.map((r) => r.ticketId)); setDragOrder(null); }
    finally { setApplying(false); }
  }

  // charts
  const spendData = members.map((m) => ({ label: m.name.split(' ')[0], value: m.spentUSD, sub: `${m.budgetUsedPct}%`,
    color: m.budgetUsedPct >= 85 ? '#f59e0b' : '#6366f1' }));
  const loadData = members.map((m) => ({ label: m.name.split(' ')[0], value: m.assignedCostUSD, sub: `${m.assignedCount} tix`, color: '#22c55e' }));
  const budgetPct = budget.total ? Math.round((budget.consumed / budget.total) * 100) : 0;
  const dry = team.dryDate ? dateFmt(team.dryDate) : null;

  return (
    <div className="view">
      {/* team summary */}
      <section className="stat-row">
        <Stat label="Team spend" value={money(team.spentUSD)} sub={`of ${money(budget.total)} ${budget.period}`} />
        <Stat label="Remaining" value={money(team.remainingUSD)} warn={team.remainingUSD < budget.total * 0.15} />
        <Stat label="Burn rate" value={`${money(team.burnRatePerDay || 0)}/day`}
          sub={dry ? `dry by ${dry}${team.daysLeft != null ? ` (~${team.daysLeft}d)` : ''}` : 'no spend yet'}
          warn={team.daysLeft != null && team.daysLeft < 7} />
        <Stat label="Open work" value={team.openRecommendations} sub={team.overBudgetTickets ? `${team.overBudgetTickets} over budget` : 'all fit budget'} warn={team.overBudgetTickets > 0} />
        <Stat label="Codebase" value={codebasePresent ? `${indexedFiles} files` : 'not pasted'}
          sub={codebasePresent ? 'view indexing →' : 'text-only mode'} warn={!codebasePresent} onClick={onOpenIndexing} />
      </section>

      {/* charts */}
      <section className="charts">
        <div className="chart-card">
          <div className="chart-title">Spend by member</div>
          <BarChart data={spendData} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Recommended load (queued $)</div>
          <BarChart data={loadData} />
        </div>
        <div className="chart-card center">
          <div className="chart-title">Budget used</div>
          <Donut pct={budgetPct} label={`${money(team.spentUSD)} / ${money(budget.total)}`} warn={budgetPct >= 85} />
        </div>
      </section>

      {/* per-member cards */}
      <h2 className="section-title">Team members — usage &amp; load</h2>
      <section className="member-grid">
        {members.map((m) => (
          <button key={m.id} className="member-card" onClick={() => onOpenMember(m.id)}>
            <div className="member-head">
              <span className="avatar">{initials(m.name)}</span>
              <div>
                <div className="member-name">{m.name}</div>
                <div className="member-role">{m.role}</div>
              </div>
              <span className="open-hint">view →</span>
            </div>
            <div className="member-budget">
              <div className="member-budget-figures">
                <span>{money(m.spentUSD)}</span><span className="muted"> / {money(m.weeklyBudgetUSD)}</span><span className="muted"> · {m.budgetUsedPct}%</span>
              </div>
              <Bar pct={m.budgetUsedPct} warn={m.budgetUsedPct >= 85} />
            </div>
            <div className="member-metrics">
              <div><span className="muted">done</span> {m.ticketsWorked}</div>
              <div><span className="muted">assigned</span> {m.assignedCount}</div>
              <div><span className="muted">queued</span> {money(m.assignedCostUSD)} · {m.assignedHours}h</div>
            </div>
            {m.topRecommendation && (
              <div className="member-top"><PriorityBadge priority={m.topRecommendation.priority} /><span className="member-top-title">{m.topRecommendation.title}</span></div>
            )}
          </button>
        ))}
      </section>

      {/* work queue: add / sort / drag-reorder */}
      <div className="queue-toolbar">
        <h2 className="section-title nomargin">Work order <span className="muted">(drag to reorder)</span></h2>
        <div className="queue-controls">
          <AddTicket members={members} onAdd={onAddTicket} />
          <label className="sort-label">Sort
            <select className="sort-select" value={sortKey} onChange={(e) => { setSortKey(e.target.value); setDragOrder(null); }}>
              <option value="rank">Recommended</option>
              <option value="priority">Priority</option>
              <option value="cost">Cost</option>
              <option value="effort">Effort</option>
              <option value="created">Newest</option>
            </select>
          </label>
          {dragOrder && <button className="apply-order" disabled={applying} onClick={applyOrder}>{applying ? 'Applying…' : '✓ Apply order'}</button>}
        </div>
      </div>

      <section className="queue">
        <div className="queue-row queue-head">
          <span>#</span><span>Ticket</span><span>Pri</span><span>Model</span><span>Cost</span><span>Effort</span><span>Assignee</span><span>Fit</span>
        </div>
        {displayed.map((r, idx) => (
          <div key={r.ticketId}
            className={`queue-row drag ${r.fitsBudget ? '' : 'over'}`}
            draggable
            onDragStart={() => setDragFrom(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(idx)}>
            <span className="rank">⠿ {idx + 1}</span>
            <span className="q-title"><span className="q-id">{r.ticketId}</span> {r.title}</span>
            <span><PriorityBadge priority={r.priority} /></span>
            <span><ModelBadge model={r.recommendedModel} tier={r.recommendedModelTier} /></span>
            <span>{money(r.estimatedCostUSD)}</span>
            <span>{r.estimatedEffortHours}h</span>
            <span className="q-assignee">{r.assignee?.name || '—'}</span>
            <span>{r.fitsBudget ? '✓' : '⚠'}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
