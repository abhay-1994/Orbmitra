const { useEffect, useMemo, useRef, useState } = React;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: #0d0e12;
    color: #e8eaf0;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  button, input, select, textarea { font: inherit; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2a2d38; border-radius: 4px; }

  .shell { display: flex; height: 100vh; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #111318;
    border-right: 1px solid #1e2130;
    overflow: hidden;
  }
  .brand {
    padding: 20px 18px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #1e2130;
  }
  .brand-logo {
    width: 32px; height: 32px;
    border-radius: 8px;
    object-fit: contain;
    background: #1a1d26;
    display: block;
  }
  .brand-name {
    font-size: 15px;
    font-weight: 600;
    color: #f0f2f8;
    letter-spacing: -0.02em;
  }
  .brand-sub { font-size: 11px; color: #4a5070; margin-top: 1px; }

  .nav { flex: 1; padding: 10px 8px; overflow-y: auto; }
  .nav-section {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #3a3f55;
    padding: 14px 10px 6px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    border-radius: 7px;
    cursor: pointer;
    color: #6070a0;
    font-size: 13.5px;
    font-weight: 500;
    transition: background 0.12s, color 0.12s;
    margin-bottom: 1px;
  }
  .nav-item:hover { background: #191c28; color: #c0c8e8; }
  .nav-item.active { background: #1c2236; color: #7b9cff; }
  .nav-icon { font-size: 13px; width: 16px; text-align: center; opacity: 0.85; }

  .sidebar-bottom {
    padding: 12px 8px;
    border-top: 1px solid #1e2130;
  }
  .conn-card {
    padding: 10px 12px;
    background: #0d0f16;
    border-radius: 8px;
    border: 1px solid #1e2130;
  }
  .conn-label { font-size: 10px; color: #3a3f55; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; margin-bottom: 6px; }
  .conn-status { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .dot-on { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.5); }
  .dot-off { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.5); }

  /* Main */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 56px;
    border-bottom: 1px solid #1e2130;
    background: #111318;
    flex-shrink: 0;
  }
  .topbar-left { display: flex; align-items: center; gap: 12px; }
  .page-title { font-size: 15px; font-weight: 600; color: #e8eaf0; }
  .topbar-right { display: flex; align-items: center; gap: 8px; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
    border: none;
    outline: none;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: #2d4aff; color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #3a56ff; }
  .btn-ghost { background: #1a1d28; color: #8090c0; border: 1px solid #1e2130; }
  .btn-ghost:hover:not(:disabled) { background: #1e2236; color: #c0c8e8; }
  .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 6px; }
  .btn-danger { background: #3a1a1a; color: #f87171; border: 1px solid #4a2020; }
  .btn-danger:hover:not(:disabled) { background: #451e1e; }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 11px 5px 8px;
    background: #1a1d28;
    border: 1px solid #1e2130;
    border-radius: 20px;
    font-size: 12.5px;
    color: #8090c0;
  }
  .user-avatar {
    width: 20px; height: 20px;
    background: #2d4aff22;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: #7b9cff;
  }

  .content { flex: 1; overflow-y: auto; padding: 24px; }

  /* Cards */
  .card {
    background: #111318;
    border: 1px solid #1e2130;
    border-radius: 10px;
  }
  .card-pad { padding: 18px 20px; }
  .card-head {
    padding: 14px 20px;
    border-bottom: 1px solid #1e2130;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .card-title { font-size: 13px; font-weight: 600; color: #c0c8e8; }
  .card-sub { font-size: 12px; color: #4a5070; margin-top: 2px; }

  /* Grid */
  .grid { display: grid; gap: 16px; }
  .g4 { grid-template-columns: repeat(4, 1fr); }
  .g2 { grid-template-columns: 1fr 1fr; }
  .g3 { grid-template-columns: repeat(3, 1fr); }
  .split { grid-template-columns: 1.35fr 0.85fr; }

  /* Metric */
  .metric {
    padding: 18px 20px;
    background: #111318;
    border: 1px solid #1e2130;
    border-radius: 10px;
    position: relative;
    overflow: hidden;
  }
  .metric::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--accent, #2d4aff);
    opacity: 0.7;
  }
  .metric-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #4a5070; }
  .metric-value { font-size: 26px; font-weight: 600; font-family: 'DM Mono', monospace; color: #e8eaf0; margin-top: 6px; line-height: 1; }
  .metric-note { font-size: 11.5px; color: #4a5070; margin-top: 5px; }

  /* Pill / Badge */
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    background: #1a1d28;
    border: 1px solid #1e2130;
    border-radius: 5px;
    font-size: 11.5px;
    font-family: 'DM Mono', monospace;
    color: #6070a0;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .badge-green { background: #0f2a1a; color: #4ade80; border: 1px solid #1a4030; }
  .badge-yellow { background: #2a1f0a; color: #fbbf24; border: 1px solid #3a2d10; }
  .badge-blue { background: #0d1a3a; color: #7b9cff; border: 1px solid #1a2850; }
  .badge-red { background: #2a0f0f; color: #f87171; border: 1px solid #401818; }

  /* Events list */
  .event-list { display: flex; flex-direction: column; gap: 8px; padding: 14px 0; max-height: 500px; overflow-y: auto; }
  .event-item {
    padding: 12px 16px;
    border: 1px solid #1e2130;
    border-radius: 8px;
    background: #0d0f16;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
  }
  .event-item:hover { border-color: #2d3555; background: #111420; }
  .event-item.selected { border-color: #2d4aff66; background: #0f1530; }
  .event-title { font-size: 13px; font-weight: 500; color: #c8d0e8; }
  .event-body { font-size: 12.5px; color: #505878; margin-top: 5px; line-height: 1.55; }
  .event-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  .event-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #3a3f55; padding: 0 8px 8px 0; border-bottom: 1px solid #1e2130; }
  td { padding: 10px 8px 10px 0; font-size: 12.5px; color: #8090b8; border-bottom: 1px solid #141720; vertical-align: top; }
  tr:last-child td { border-bottom: none; }

  /* Form elements */
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .field-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #4a5070; }
  .input, .select, .textarea {
    background: #0d0f16;
    border: 1px solid #1e2130;
    border-radius: 7px;
    padding: 9px 12px;
    color: #c8d0e8;
    font-size: 13.5px;
    outline: none;
    transition: border-color 0.12s;
    width: 100%;
  }
  .input:focus, .select:focus, .textarea:focus { border-color: #2d4aff66; }
  .textarea { resize: vertical; min-height: 140px; font-family: 'DM Mono', monospace; font-size: 12.5px; line-height: 1.6; }
  .error-box {
    padding: 10px 14px;
    background: #1f0f0f;
    border: 1px solid #3a1818;
    border-radius: 7px;
    color: #f87171;
    font-size: 12.5px;
    line-height: 1.5;
  }

  /* Auth */
  .auth-shell {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0d0e12;
    padding: 24px;
  }
  .auth-card {
    width: 400px;
    background: #111318;
    border: 1px solid #1e2130;
    border-radius: 14px;
    padding: 32px;
  }
  .auth-logo-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
  }
  .auth-logo {
    width: 42px; height: 42px;
    border-radius: 10px;
    object-fit: contain;
    background: #1a1d26;
  }
  .auth-brand-name { font-size: 18px; font-weight: 600; color: #e8eaf0; }
  .auth-brand-sub { font-size: 12px; color: #4a5070; margin-top: 2px; }
  .auth-heading { font-size: 22px; font-weight: 600; color: #f0f2f8; margin-bottom: 6px; }
  .auth-copy { font-size: 13px; color: #505878; line-height: 1.6; margin-bottom: 24px; }

  /* Topic bar */
  .topic-row { margin-bottom: 12px; }
  .topic-info { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12.5px; }
  .topic-name { color: #8090b8; text-transform: capitalize; }
  .topic-count { font-family: 'DM Mono', monospace; color: #6070a0; font-size: 12px; }
  .topic-bar { height: 4px; background: #1a1d28; border-radius: 2px; overflow: hidden; }
  .topic-fill { height: 100%; background: #2d4aff; border-radius: 2px; transition: width 0.4s; }

  /* Empty state */
  .empty { padding: 32px 20px; text-align: center; color: #3a3f55; font-size: 13px; }

  /* DB rows */
  .db-row-title { font-size: 12.5px; color: #c0c8e8; font-weight: 500; }
  .db-row-body { font-size: 11.5px; color: #4a5070; margin-top: 3px; }

  /* Mb utils */
  .mb8 { margin-bottom: 8px; }
  .mb16 { margin-bottom: 16px; }
  .mb20 { margin-bottom: 20px; }
  .mt12 { margin-top: 12px; }
  .mt16 { margin-top: 16px; }
  .mt20 { margin-top: 20px; }
  .row { display: flex; align-items: center; gap: 8px; }
  .gap-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
  .muted { color: #4a5070; font-size: 12px; line-height: 1.5; }
  .mono { font-family: 'DM Mono', monospace; }
`;

const NAV_SECTIONS = [
  { section: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: '◈' }] },
  { section: 'Monitoring', items: [
    { id: 'feed', label: 'Live Feed', icon: '⚡' },
    { id: 'questions', label: 'Questions', icon: '?' },
  ]},
  { section: 'Storage', items: [{ id: 'database', label: 'Database', icon: '▤' }] },
  { section: 'Content', items: [{ id: 'knowledge', label: 'Knowledge Base', icon: '◎' }] },
  { section: 'Admin', items: [{ id: 'settings', label: 'Settings', icon: '⚙' }] },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  feed: 'Live Feed',
  questions: 'Questions',
  database: 'Database',
  knowledge: 'Knowledge Base',
  settings: 'Settings',
};

const API_BASE = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : 'http://localhost:3000';

try { sessionStorage.removeItem('orbmitra_admin_token'); } catch {}

function fetchJson(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, headers })
    .then(async res => {
      if (!res.ok) {
        const e = new Error(`${res.status}`);
        e.status = res.status;
        try {
          Object.assign(e, await res.json());
        } catch {}
        throw e;
      }
      return res.json();
    });
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtNum(n) { return Number(n || 0).toLocaleString(); }
function adminStreamUrl() {
  return `${API_BASE}/api/admin/stream`;
}
function normalizeAdminPath(p) {
  const c = String(p || '/admin').replace(/\/+$/, '') || '/admin';
  return c === '/admin/login' ? '/admin/login' : '/admin';
}

function App() {
  const [authStatus, setAuthStatus] = useState('loading');
  const [admin, setAdmin] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [routePath, setRoutePath] = useState(() => normalizeAdminPath(window.location.pathname));
  const [page, setPage] = useState('dashboard');
  const [stats, setStats] = useState({ total: 0, topics: {}, analytics: { totalEvents: 0 } });
  const [events, setEvents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState('');
  const [qFilter, setQFilter] = useState('all');
  const [selectedQId, setSelectedQId] = useState(null);
  const [qForm, setQForm] = useState({ correctedAnswer: '', topic: 'general', status: 'pending' });
  const [qBusy, setQBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('all');
  const [database, setDatabase] = useState({ connected: false, mode: 'loading', updatedAt: null, tables: {} });
  const [dbError, setDbError] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  const inactivityTimer = useRef(null);

  const navigate = (p, replace = false) => {
    const next = normalizeAdminPath(p);
    if (normalizeAdminPath(window.location.pathname) !== next) {
      replace ? window.history.replaceState({}, '', next) : window.history.pushState({}, '', next);
    }
    setRoutePath(next);
  };

  useEffect(() => {
    fetchJson('/api/admin/session')
      .then(d => { setAdmin(d.admin || null); setAuthStatus('authenticated'); })
      .catch(() => { setAdmin(null); setAuthStatus('anonymous'); });
    const onPop = () => setRoutePath(normalizeAdminPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const resetState = () => {
    setStats({ total: 0, topics: {}, analytics: { totalEvents: 0 } });
    setEvents([]); setConnected(false); setFilter('all');
    setDatabase({ connected: false, mode: 'loading', updatedAt: null, tables: {} });
    setDbError(''); setDbLoading(false);
  };

  const onAuthFail = () => {
    setAdmin(null); setAuthStatus('anonymous');
    resetState(); navigate('/admin/login', true);
  };

  const loadDatabase = () => {
    if (authStatus !== 'authenticated') return;
    setDbLoading(true);
    fetchJson('/api/admin/database')
      .then(d => { setDatabase(d); setDbError(''); })
      .catch(e => {
        if (e.status === 401) { onAuthFail(); return; }
        setDbError(e.status === 404
          ? 'Backend not serving the database view yet. Restart after starting Postgres.'
          : 'Database snapshot temporarily unavailable.');
      })
      .finally(() => setDbLoading(false));
  };

  const loadQuestions = () => {
    if (authStatus !== 'authenticated') return;
    setQLoading(true);
    fetchJson('/api/admin/questions?limit=200&status=all')
      .then(d => {
        const list = Array.isArray(d.questions) ? d.questions : [];
        setQuestions(list); setQError('');
        setSelectedQId(prev => {
          if (prev && list.some(q => Number(q.id) === Number(prev))) return prev;
          const first = list[0];
          if (first) {
            setQForm({ correctedAnswer: first.correctedAnswer || first.corrected_answer || '', topic: first.topic || 'general', status: first.status || 'pending' });
            return first.id;
          }
          setQForm({ correctedAnswer: '', topic: 'general', status: 'pending' });
          return null;
        });
      })
      .catch(e => { if (e.status === 401) { onAuthFail(); return; } setQError('Unable to load questions.'); })
      .finally(() => setQLoading(false));
  };

  const handleQuestionSelect = q => {
    setSelectedQId(q.id);
    setQForm({ correctedAnswer: q.correctedAnswer || '', topic: q.topic || 'general', status: q.status || 'pending' });
  };

  const handleQuestionSave = async () => {
    const sel = questions.find(q => Number(q.id) === Number(selectedQId));
    if (!sel) return;
    setQBusy(true); setQError('');
    try {
      const res = await fetchJson(`/api/admin/questions/${sel.id}`, {
        method: 'PUT',
        body: JSON.stringify({ topic: qForm.topic, correctedAnswer: qForm.correctedAnswer, status: qForm.status })
      });
      const updated = res.question || sel;
      setQuestions(prev => prev.map(q => Number(q.id) === Number(updated.id) ? { ...q, ...updated } : q));
      setSelectedQId(updated.id);
      setQForm({ correctedAnswer: updated.correctedAnswer || qForm.correctedAnswer || '', topic: updated.topic || qForm.topic || 'general', status: updated.status || qForm.status || 'pending' });
      loadDatabase();
    } catch (e) {
      if (e.status === 401) { onAuthFail(); return; }
      setQError('Unable to save correction.');
    } finally { setQBusy(false); }
  };

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let mounted = true;
    fetchJson('/api/stats').then(d => { if (mounted) setStats(d); }).catch(e => { if (e.status === 401) onAuthFail(); });
    fetchJson('/api/admin/events').then(d => { if (mounted) setEvents((d.events || []).slice().reverse()); }).catch(e => { if (e.status === 401) onAuthFail(); });
    loadDatabase(); loadQuestions();
    const src = new EventSource(adminStreamUrl(), { withCredentials: true });
    src.onopen = () => setConnected(true);
    src.onerror = () => setConnected(false);
    src.addEventListener('update', e => {
      if (!mounted) return;
      const p = JSON.parse(e.data);
      setEvents(prev => [p, ...prev].slice(0, 100));
      if (p.type === 'question') setQuestions(prev => [p, ...prev].slice(0, 200));
      setStats(prev => ({ ...prev, analytics: { totalEvents: (prev.analytics?.totalEvents || 0) + 1 } }));
    });
    src.addEventListener('ping', () => setConnected(true));
    return () => { mounted = false; src.close(); };
  }, [authStatus]);

  useEffect(() => { if (authStatus === 'authenticated' && page === 'database') loadDatabase(); }, [page, authStatus]);
  useEffect(() => { if (authStatus === 'authenticated' && page === 'questions') loadQuestions(); }, [page, authStatus]);

  const handleLogin = async e => {
    e.preventDefault();
    setLoginBusy(true); setLoginError('');
    try {
      const res = await fetchJson('/api/admin/login', { method: 'POST', body: JSON.stringify(loginForm) });
      setAdmin(res.admin || null); setAuthStatus('authenticated');
      resetState(); setPage('dashboard'); navigate('/admin', true);
    } catch (e) {
      setLoginError(
        e.status === 429
          ? `Too many sign-in attempts. Please wait${e.retryAfterSeconds ? ` ${e.retryAfterSeconds} seconds` : ''} and try again.`
          : e.status === 401
            ? 'Invalid username or password.'
            : 'Unable to sign in. Check backend and retry.'
      );
    } finally { setLoginBusy(false); }
  };

  const handleLogout = async () => {
    try { await fetchJson('/api/admin/logout', { method: 'POST' }); } catch {}
    setLoginForm({ username: '', password: '' }); onAuthFail();
  };

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'authenticated' && routePath === '/admin/login') { navigate('/admin', true); return; }
    if (authStatus !== 'authenticated' && routePath !== '/admin/login') navigate('/admin/login', true);
  }, [authStatus, routePath]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || routePath === '/admin/login') {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }
    const idle = 2 * 60 * 1000;
    const bump = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(handleLogout, idle);
    };
    const evts = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    evts.forEach(ev => window.addEventListener(ev, bump, { passive: true }));
    bump();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); evts.forEach(ev => window.removeEventListener(ev, bump)); };
  }, [authStatus, routePath]);

  const summary = useMemo(() => {
    const chats = events.filter(e => e.type === 'chat');
    const fb = events.filter(e => e.type === 'feedback');
    return { chats: chats.length, feedback: fb.length, unanswered: chats.filter(e => e.source === 'fallback').length };
  }, [events]);

  if (authStatus !== 'authenticated' || routePath === '/admin/login') {
    return (
      <>
        <style>{CSS}</style>
        <LoginScreen loading={authStatus === 'loading'} busy={loginBusy} error={loginError} form={loginForm}
          onChange={(f, v) => setLoginForm(p => ({ ...p, [f]: v }))} onSubmit={handleLogin} />
      </>
    );
  }

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);
  const filteredQs = qFilter === 'all' ? questions : questions.filter(q => String(q.status || 'pending').toLowerCase() === qFilter);
  const selectedQ = questions.find(q => Number(q.id) === Number(selectedQId)) || filteredQs[0] || null;
  const tableEntries = Object.entries(database.tables || {});
  const totalDbRows = tableEntries.reduce((s, [, t]) => s + Number(t?.count || 0), 0);
  const adminName = admin?.name || admin?.username || 'Admin';
  const initials = adminName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <img className="brand-logo" src="/assets/logo-transparent.png" alt="OrbMitra" />
            <div>
              <div className="brand-name">OrbMitra</div>
              <div className="brand-sub">Admin Console</div>
            </div>
          </div>

          <nav className="nav">
            {NAV_SECTIONS.map(({ section, items }) => (
              <div key={section}>
                <div className="nav-section">{section}</div>
                {items.map(item => (
                  <div key={item.id} className={`nav-item${page === item.id ? ' active' : ''}`} onClick={() => setPage(item.id)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="conn-card">
              <div className="conn-label">Stream</div>
              <div className="conn-status">
                <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} />
                <span style={{ color: connected ? '#4ade80' : '#f87171' }}>{connected ? 'Connected' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="topbar-left">
              <span className="page-title">{PAGE_TITLES[page] || page}</span>
            </div>
            <div className="topbar-right">
              <div className="user-chip">
                <div className="user-avatar">{initials}</div>
                <span>{adminName}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { fetchJson('/api/stats').then(setStats).catch(e => { if (e.status === 401) onAuthFail(); }); loadDatabase(); }}>
                ↺ Refresh
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.open('http://localhost:3000/swagger-ui.html', '_blank')}>API Docs</button>
              <button className="btn btn-danger btn-sm" onClick={handleLogout}>Sign out</button>
            </div>
          </div>

          <div className="content">
            {page === 'dashboard' && <DashboardPage stats={stats} summary={summary} connected={connected} database={database} totalDbRows={totalDbRows} onGoQuestions={() => setPage('questions')} />}
            {page === 'feed' && <FeedPage events={filteredEvents} filter={filter} onFilter={setFilter} />}
            {page === 'questions' && (
              <QuestionsPage
                questions={filteredQs} qLoading={qLoading} qError={qError}
                qFilter={qFilter} onQFilter={setQFilter}
                selectedQ={selectedQ} selectedQId={selectedQId}
                qForm={qForm} qBusy={qBusy}
                onSelectQ={handleQuestionSelect}
                onChangeForm={(f, v) => setQForm(p => ({ ...p, [f]: v }))}
                onSave={handleQuestionSave}
                onRefresh={loadQuestions}
              />
            )}
            {page === 'database' && <DatabasePage database={database} dbError={dbError} dbLoading={dbLoading} onRefresh={loadDatabase} tableEntries={tableEntries} totalRows={totalDbRows} />}
            {page === 'knowledge' && <KnowledgePage stats={stats} />}
            {page === 'settings' && <SettingsPage apiBase={API_BASE} />}
          </div>
        </div>
      </div>
    </>
  );
}

function LoginScreen({ loading, busy, error, form, onChange, onSubmit }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo-wrap">
          <img className="auth-logo" src="/assets/logo-transparent.png" alt="OrbMitra" />
          <div>
            <div className="auth-brand-name">OrbMitra</div>
            <div className="auth-brand-sub">Admin Console</div>
          </div>
        </div>
        <div className="auth-heading">Sign in</div>
        <div className="auth-copy">Enter your admin credentials to access the dashboard.</div>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="field-label">Username</label>
            <input className="input" type="text" value={form.username} onChange={e => onChange('username', e.target.value)} placeholder="your-admin-username" autoComplete="username" required />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="input" type="password" value={form.password} onChange={e => onChange('password', e.target.value)} placeholder="your-admin-password" autoComplete="current-password" required />
          </div>
          {error && <div className="error-box mb16">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {loading ? 'Checking session…' : busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted">JWT-secured admin area</span>
          <span className="pill mono">{API_BASE}</span>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ stats, summary, connected, database, totalDbRows, onGoQuestions }) {
  return (
    <>
      <div className="grid g4 mb16">
        <Metric label="Knowledge Base" value={fmtNum(stats.total)} note="QA entries" accent="#2d4aff" />
        <Metric label="Chat Events" value={fmtNum(summary.chats)} note="Live messages" accent="#7b9cff" />
        <Metric label="Feedback" value={fmtNum(summary.feedback)} note="User ratings" accent="#4ade80" />
        <Metric label="DB Rows" value={fmtNum(totalDbRows)} note={database.connected ? 'Postgres' : 'In-memory'} accent="#fbbf24" />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Topic Distribution</div>
              <div className="card-sub">Knowledge base breakdown</div>
            </div>
          </div>
          <div className="card-pad">
            {Object.keys(stats.topics || {}).filter(t => t !== 'all').length === 0 && <div className="empty">No topics loaded yet.</div>}
            {Object.entries(stats.topics || {}).filter(([t]) => t !== 'all').map(([topic, count]) => (
              <TopicBar key={topic} topic={topic} count={count} total={stats.total || 1} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">System Health</div>
              <div className="card-sub">Real-time status</div>
            </div>
          </div>
          <div className="card-pad">
            <HealthRow label="Event stream" ok={connected} okText="Live" failText="Offline" />
            <HealthRow label="Vector DB" ok={database.connected} okText="Postgres + pgvector" failText="In-memory" />
            <HealthRow label="Fallback answers" value={fmtNum(summary.unanswered)} />
            <div className="mt16">
              <button className="btn btn-primary" onClick={onGoQuestions}>Review Questions →</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HealthRow({ label, ok, okText, failText, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1a1d28' }}>
      <span style={{ fontSize: 13, color: '#6070a0' }}>{label}</span>
      {value !== undefined
        ? <span className="pill mono">{value}</span>
        : <span className={`badge ${ok ? 'badge-green' : 'badge-yellow'}`}>{ok ? okText : failText}</span>}
    </div>
  );
}

function FeedPage({ events, filter, onFilter }) {
  return (
    <div className="grid split">
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Event Stream</div>
            <div className="card-sub">Real-time user activity</div>
          </div>
          <select className="select" style={{ width: 'auto' }} value={filter} onChange={e => onFilter(e.target.value)}>
            <option value="all">All events</option>
            <option value="chat">Chat only</option>
            <option value="feedback">Feedback only</option>
          </select>
        </div>
        <div style={{ padding: '0 16px' }}>
          <div className="event-list">
            {events.length === 0 && <div className="empty">No events yet. Start chatting in the main UI.</div>}
            {events.map(ev => <EventCard key={ev.id || `${ev.createdAt}-${ev.type}`} event={ev} />)}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-title mb8">What this shows</div>
        <div className="muted" style={{ lineHeight: 1.7 }}>
          Real-time events streamed from the backend API via SSE. Each card shows the matched topic, confidence score, and answer source. Fallback answers trigger when no strong semantic match is found.
        </div>
        <div className="mt16" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row"><span className="badge badge-blue">chat</span><span className="muted">User messages and matched answers</span></div>
          <div className="row"><span className="badge badge-green">feedback</span><span className="muted">Helpfulness ratings and comments</span></div>
          <div className="row"><span className="badge badge-yellow">fallback</span><span className="muted">No confident match found</span></div>
        </div>
      </div>
    </div>
  );
}

function QuestionsPage({ questions, qLoading, qError, qFilter, onQFilter, selectedQ, selectedQId, qForm, qBusy, onSelectQ, onChangeForm, onSave, onRefresh }) {
  return (
    <div className="grid split">
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Question Queue</div>
            <div className="card-sub">{questions.length} question{questions.length !== 1 ? 's' : ''}</div>
          </div>
          <select className="select" style={{ width: 'auto' }} value={qFilter} onChange={e => onQFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="answered">Answered</option>
            <option value="corrected">Corrected</option>
          </select>
        </div>
        {qError && <div style={{ padding: '0 16px 12px' }}><div className="error-box">{qError}</div></div>}
        <div style={{ padding: '0 16px' }}>
          <div className="event-list">
            {qLoading && questions.length === 0 && <div className="empty">Loading questions…</div>}
            {!qLoading && questions.length === 0 && <div className="empty">No questions yet. Start chatting.</div>}
            {questions.map(q => (
              <div key={q.id} className={`event-item${Number(selectedQId) === Number(q.id) ? ' selected' : ''}`} onClick={() => onSelectQ(q)}>
                <div className="event-head">
                  <div className="event-title">{q.message}</div>
                  <span className={`badge ${q.status === 'corrected' ? 'badge-green' : q.status === 'pending' ? 'badge-yellow' : 'badge-blue'}`}>{q.status || 'pending'}</span>
                </div>
                <div className="event-body" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.reply}</div>
                <div className="event-meta">
                  <span className="pill">{q.topic || 'general'}</span>
                  <span className="pill">{Math.round((Number(q.confidence) || 0) * 100)}% confidence</span>
                  <span className="pill">{fmtTime(q.createdAt || q.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Edit Answer</div>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Refresh</button>
        </div>
        <div className="card-pad">
          {!selectedQ ? (
            <div className="empty" style={{ textAlign: 'left' }}>Select a question from the queue to edit its answer.</div>
          ) : (
            <>
              <div style={{ padding: '12px 14px', background: '#0d0f16', border: '1px solid #1e2130', borderRadius: 7, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#4a5070', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 5 }}>Question</div>
                <div style={{ fontSize: 13, color: '#c0c8e8' }}>{selectedQ.message}</div>
              </div>
              <div style={{ padding: '12px 14px', background: '#0d0f16', border: '1px solid #1e2130', borderRadius: 7, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#4a5070', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 5 }}>Current answer</div>
                <div style={{ fontSize: 12.5, color: '#606880', lineHeight: 1.6 }}>{selectedQ.reply}</div>
              </div>

              <div className="field">
                <label className="field-label">Topic</label>
                <input className="input" type="text" value={qForm.topic} onChange={e => onChangeForm('topic', e.target.value)} placeholder="general" />
              </div>
              <div className="field">
                <label className="field-label">Corrected answer</label>
                <textarea className="textarea" value={qForm.correctedAnswer} onChange={e => onChangeForm('correctedAnswer', e.target.value)} placeholder="Write the improved answer here…" />
              </div>

              {qError && <div className="error-box mb16">{qError}</div>}

              <div className="gap-wrap">
                <button className="btn btn-primary" onClick={onSave} disabled={qBusy}>
                  {qBusy ? 'Saving…' : '✓ Save correction'}
                </button>
              </div>
              <div className="muted mt12">
                Status: <span className="pill">{selectedQ.status || 'pending'}</span>&nbsp;
                {selectedQ.reviewedAt && <>Reviewed: <span className="pill">{fmtTime(selectedQ.reviewedAt)}</span></>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DatabasePage({ database, dbError, dbLoading, onRefresh, tableEntries, totalRows }) {
  return (
    <>
      <div className="grid g4 mb16">
        <Metric label="Connection" value={database.connected ? 'Online' : 'Offline'} note={database.connected ? 'Postgres active' : 'Memory mode'} accent={database.connected ? '#4ade80' : '#fbbf24'} />
        <Metric label="Mode" value={database.mode || '—'} note="Storage backend" accent="#7b9cff" />
        <Metric label="Tables" value={fmtNum(tableEntries.length)} note="Visible tables" accent="#a78bfa" />
        <Metric label="Total rows" value={fmtNum(totalRows)} note="Across all tables" accent="#fbbf24" />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Snapshot</div>
              <div className="card-sub">Updated {database.updatedAt ? fmtTime(database.updatedAt) : '—'}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={onRefresh} disabled={dbLoading}>
              {dbLoading ? 'Loading…' : '↺ Refresh'}
            </button>
          </div>
          <div className="card-pad">
            {dbError && <div className="error-box mb16">{dbError}</div>}
            {!dbError && dbLoading && tableEntries.length === 0 && <div className="empty">Loading…</div>}
            {!dbError && !dbLoading && tableEntries.length === 0 && <div className="empty">No data yet. Start backend with Postgres, then refresh.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tableEntries.map(([key, table]) => (
                <div key={key} style={{ border: '1px solid #1e2130', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#0d0f16', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e2130' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#c0c8e8', fontFamily: 'DM Mono, monospace' }}>{table.name || key}</span>
                    <span className="pill">{fmtNum(table.count)} rows</span>
                  </div>
                  <div style={{ padding: '0 14px' }}>
                    <table>
                      <thead><tr><th>Entry</th><th>Details</th></tr></thead>
                      <tbody>
                        {(table.recent || []).map((row, i) => (
                          <tr key={i}>
                            <td><div className="db-row-title">{rowTitle(key, row)}</div></td>
                            <td><div className="db-row-body">{rowBody(key, row)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title mb8">Table Guide</div>
          {[
            { name: 'knowledge_embeddings', desc: 'QA entries and semantic vectors for search.' },
            { name: 'chat_feedback', desc: 'User helpfulness ratings and comments.' },
            { name: 'chat_events', desc: 'Full live activity stream with confidence scores.' },
          ].map(({ name, desc }) => (
            <div key={name} style={{ padding: '10px 0', borderBottom: '1px solid #141720' }}>
              <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#7b9cff', marginBottom: 3 }}>{name}</div>
              <div className="muted">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function KnowledgePage({ stats }) {
  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-head"><div className="card-title">Knowledge Overview</div></div>
        <div className="card-pad">
          <div style={{ fontSize: 42, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: '#7b9cff', marginBottom: 6 }}>{fmtNum(stats.total)}</div>
          <div className="muted">QA entries available for semantic search and quiz mode.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Topics</div></div>
        <div className="card-pad">
          {Object.entries(stats.topics || {}).filter(([t]) => t !== 'all').map(([topic, count]) => (
            <TopicBar key={topic} topic={topic} count={count} total={stats.total || 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ apiBase }) {
  const endpoints = ['/api/stats', '/api/admin/events', '/api/admin/stream', '/api/admin/database', '/api/feedback'];
  return (
    <div className="grid g2">
      <div className="card card-pad">
        <div className="card-title mb16">API Endpoints</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {endpoints.map(ep => (
            <div key={ep} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #141720' }}>
              <span className="pill mono">{ep}</span>
              <span className="badge badge-green">Active</span>
            </div>
          ))}
        </div>
        <div className="mt20">
          <button className="btn btn-primary" onClick={() => window.open('http://localhost:3000/swagger-ui.html', '_blank')}>Open Swagger Docs →</button>
        </div>
      </div>
      <div className="card card-pad">
        <div className="card-title mb8">Backend Info</div>
        <div className="muted" style={{ lineHeight: 1.7 }}>
          All knowledge, NLP, vector search, analytics, and database access live in the backend. The admin UI only reads API data.
        </div>
        <div className="mt16">
          <div className="field-label" style={{ marginBottom: 6 }}>API Base URL</div>
          <span className="pill mono">{apiBase}</span>
        </div>
        <div className="mt16">
          <div className="field-label" style={{ marginBottom: 6 }}>Session</div>
          <div className="muted">Admin sessions live in HttpOnly cookies. Auto-logout still triggers after 2 minutes of inactivity.</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, note, accent }) {
  return (
    <div className="metric" style={{ '--accent': accent }}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function TopicBar({ topic, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="topic-row">
      <div className="topic-info">
        <span className="topic-name">{topic}</span>
        <span className="topic-count">{count}</span>
      </div>
      <div className="topic-bar">
        <div className="topic-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const isChat = event.type === 'chat';
  const isFeedback = event.type === 'feedback';
  const isFallback = event.source === 'fallback';
  return (
    <div className="event-item">
      <div className="event-head">
        <div className="event-title">
          {isFeedback ? 'Feedback' : isFallback ? 'Fallback' : 'Answered'}
        </div>
        <span className={`badge ${isFeedback ? 'badge-green' : isFallback ? 'badge-yellow' : 'badge-blue'}`}>
          {event.topic || 'general'}
        </span>
      </div>
      <div className="event-body">
        {isFeedback ? (event.comment || `Helpful: ${event.helpful}`) : (event.message || '—')}
      </div>
      <div className="event-meta">
        <span className="pill">{event.source || 'n/a'}</span>
        <span className="pill">{Math.round((Number(event.confidence) || 0) * 100)}%</span>
        <span className="pill">{fmtTime(event.createdAt)}</span>
      </div>
    </div>
  );
}

function rowTitle(key, row) {
  if (key === 'knowledge_embeddings') return row.question || `QA #${row.id}`;
  if (key === 'chat_feedback') return row.message || `Feedback #${row.id}`;
  if (key === 'chat_events') return row.event_type || `Event #${row.id}`;
  return row.id ? `Row #${row.id}` : 'Row';
}
function rowBody(key, row) {
  if (key === 'knowledge_embeddings') return [row.topic && `Topic: ${row.topic}`, row.answer].filter(Boolean).join(' · ');
  if (key === 'chat_feedback') return [row.topic && `Topic: ${row.topic}`, row.rating != null && `Rating: ${row.rating}`, row.comment && `"${row.comment}"`].filter(Boolean).join(' · ');
  if (key === 'chat_events') return [row.topic && `Topic: ${row.topic}`, row.source && `Source: ${row.source}`, row.confidence != null && `${Math.round(row.confidence * 100)}%`].filter(Boolean).join(' · ');
  return JSON.stringify(row);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
