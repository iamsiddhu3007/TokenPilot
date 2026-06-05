// Agent-1 (Codebase Intelligence) page: shows how the analyzer indexed the
// repo and what it inferred for each ticket — related files, change surface,
// touched areas. Opened from the manager dashboard's Codebase stat.

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { PriorityBadge } from '../components/Bits.jsx';

const SURFACE_COLOR = { small: '#22c55e', moderate: '#3b82f6', large: '#a855f7', unknown: '#64748b' };

export default function IndexingView({ onBack }) {
  const [data, setData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    Promise.all([api.intel(), api.recommendations()])
      .then(([intel, recs]) => { setData(intel); setTickets(recs.recommendations || []); })
      .catch((e) => setErr(e.message));
  }, []);

  const titleFor = (id) => tickets.find((t) => t.ticketId === id)?.title || '';
  const prioFor = (id) => tickets.find((t) => t.ticketId === id)?.priority;

  return (
    <div className="view">
      <button className="back-btn" onClick={onBack}>← Back to dashboard</button>
      <div className="idx-head">
        <div>
          <h1 className="idx-title">Agent 1 · Codebase Intelligence</h1>
          <div className="idx-sub">
            {data ? (data.codebasePresent
              ? <>Indexed <strong>{data.indexedFiles}</strong> files from <code>input/codebase/</code> and scored every ticket against them.</>
              : <>No codebase pasted — estimates derived from ticket text only.</>) : 'Indexing…'}
          </div>
        </div>
        {data && <div className="idx-badge"><span className="idx-pulse" />{data.indexedFiles} files indexed</div>}
      </div>

      {err && <div className="error">⚠ {err}</div>}
      {!data && !err && <div className="empty">Running Agent 1…</div>}

      {data && (
        <section className="idx-grid">
          {data.intel.map((it) => (
            <div key={it.ticketId} className="idx-card">
              <div className="idx-card-head">
                {prioFor(it.ticketId) && <PriorityBadge priority={prioFor(it.ticketId)} />}
                <span className="q-id">{it.ticketId}</span>
                <span className="idx-card-title">{titleFor(it.ticketId)}</span>
                <span className="idx-surface" style={{ color: SURFACE_COLOR[it.surface] || '#64748b', borderColor: SURFACE_COLOR[it.surface] || '#64748b' }}>
                  {it.surface} surface
                </span>
              </div>
              <div className="idx-metrics">
                <span><strong>{it.fileCount}</strong> files</span>
                <span><strong>~{it.totalLoc}</strong> LOC</span>
                {it.touchedAreas?.length > 0 && <span>areas: {it.touchedAreas.join(', ')}</span>}
                {it.signals?.crossModule && <span className="idx-flag">cross-module</span>}
                {it.signals?.testTouch && <span className="idx-flag">tests</span>}
              </div>
              <div className="idx-summary">{it.summary}</div>
              {it.relatedFiles?.length > 0 && (
                <div className="idx-files">
                  {it.relatedFiles.slice(0, 8).map((f, i) => (
                    <span key={i} className="idx-file" style={{ animationDelay: `${i * 40}ms` }}>{f}</span>
                  ))}
                  {it.relatedFiles.length > 8 && <span className="idx-file more">+{it.relatedFiles.length - 8} more</span>}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
