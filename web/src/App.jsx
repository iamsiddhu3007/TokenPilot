import { useEffect, useState, useCallback } from 'react';
import { api } from './lib/api.js';
import ManagerView from './views/ManagerView.jsx';
import MemberView from './views/MemberView.jsx';

export default function App() {
  const [view, setView] = useState('manager'); // 'manager' | 'member'
  const [managerData, setManagerData] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [health, setHealth] = useState(null);
  const [working, setWorking] = useState(null);
  const [error, setError] = useState(null);

  const loadManager = useCallback(async () => {
    const d = await api.manager();
    setManagerData(d);
    if (!memberId && d.members[0]) setMemberId(d.members[0].id);
    return d;
  }, [memberId]);

  const loadMember = useCallback(async (id) => {
    if (!id) return;
    setMemberData(await api.member(id));
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    loadManager().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'member' && memberId) loadMember(memberId).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, memberId]);

  function openMember(id) {
    setMemberId(id);
    setView('member');
  }

  async function refresh() {
    setError(null);
    try {
      await loadManager();
      if (view === 'member') await loadMember(memberId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function work(ticketId) {
    setWorking(ticketId);
    setError(null);
    try {
      await api.work(ticketId, memberId); // attribute to the open member
      await loadMember(memberId);
      await loadManager();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(null);
    }
  }

  const members = managerData?.members || [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Token<span>Pilot</span></div>
        <div className="tagline">two agents · codebase intel → cost &amp; priority recommendations</div>

        <div className="top-actions">
          <div className="seg">
            <button className={view === 'manager' ? 'on' : ''} onClick={() => setView('manager')}>Manager</button>
            <button className={view === 'member' ? 'on' : ''} onClick={() => setView('member')}>Member</button>
          </div>

          {view === 'member' && (
            <select className="member-select" value={memberId || ''} onChange={(e) => setMemberId(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
              ))}
            </select>
          )}

          <button className="refresh" onClick={refresh}>↻</button>
        </div>
      </header>

      {health && (
        <div className="status-strip">
          {Object.entries(health)
            .filter(([k]) => k !== 'ok')
            .map(([k, v]) => (
              <span key={k} className={`chip ${String(v).includes('fallback') || String(v).includes('text-only') ? 'sim' : 'live'}`}>
                {k}: {v}
              </span>
            ))}
        </div>
      )}

      {error && <div className="error">⚠ {error}</div>}

      {view === 'manager'
        ? <ManagerView data={managerData} onOpenMember={openMember} />
        : <MemberView data={memberData} onWork={work} working={working} />}
    </div>
  );
}
