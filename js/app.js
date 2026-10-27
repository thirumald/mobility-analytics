/* App shell: sidebar navigation (AeroFusion style), hash router, theme, language, simulated user switch */
(function () {
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['agent', 'vision', 'usecases', 'data', 'gov', 'req'];
  const DOCS = { usecases: () => A.renderDoc2(), data: () => A.renderDoc('data'), gov: () => A.renderDoc('gov'), req: () => A.renderDoc('req') };
  const ICON = { overview: '◎', travel: '⏱', util: '▦', cluster: '⬢', route: '⑂', od: '⇄', fleet: '⚡', emis: '♻', events: '★', safety: '⚠', scen: '⚙', heat: '☀', equity: '⚖', agent: '✦', vision: '◉', usecases: '▤', data: '☰', gov: '⛨', req: '✓' };
  const NAV = [
    ['g_sit', ['overview']], ['g_transit', ['travel', 'util', 'cluster', 'route', 'od']], ['g_energy', ['fleet', 'emis']], ['g_ops', ['events', 'safety', 'scen']], ['g_resil', ['heat', 'equity']],
    ['g_intel', ['agent', 'vision', 'usecases']], ['g_plat', ['data', 'gov', 'req']],
  ];
  const LABEL = { agent: 'nav_agent', vision: 'nav_vision', usecases: 'nav_usecases', data: 'nav_data', gov: 'nav_gov', req: 'nav_req' };
  const label = (k) => A.t(LABEL[k] || 't_' + k);
  A.view = 'map';

  function buildNav() {
    $('nav').innerHTML = NAV.map(([g, items]) => `<span class="ng">${A.t(g)}</span>` + items.map((k) => `<a href="#/${k}" data-r="${k}"><i>${ICON[k]}</i> ${label(k)}${k === 'safety' ? ' <em id="nb-inc" class="nb" hidden></em>' : ''}</a>`).join('')).join('');
    const open = A.incidents.filter((i) => i.status === 'open').length;
    ['nb-inc', 'nb-bell'].forEach((id) => { const e = $(id); if (e) { e.textContent = open; e.hidden = !open; } });
  }
  function route() {
    const key = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
    const isTool = A.tools().some((t) => t.key === key), isView = VIEWS.includes(key);
    const k = isTool || isView ? key : 'overview', v = isTool ? 'map' : k;
    A.view = v; A.route = k;
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === k));
    $('title').textContent = label(k); document.title = `${label(k)} · SAFAR · Abu Dhabi`;
    if (isTool) { A.openTool(k); if (A.map) setTimeout(() => A.map.invalidateSize(), 30); }
    if (DOCS[v]) DOCS[v]();
    $('side').classList.remove('open'); A.emit('view', v);
  }
  A.goto = (v) => { location.hash = '#/' + (v === 'map' ? 'overview' : v); };

  function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('af.theme', t); } catch (e) {} $('theme').textContent = t === 'dark' ? '☀' : '☾'; $('theme').title = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'; A.emit('theme', t); if (DOCS[A.view]) DOCS[A.view](); }
  function setLang(l) { A.lang = l; A.applyI18n(); buildNav(); renderUser(); A.emit('lang', l); route(); }
  function renderUser() {
    const u = A.user; $('uName').textContent = u.name; $('uRole').textContent = u.title; $('avatar').textContent = u.name.split(' ').map((x) => x[0]).slice(0, 2).join('');
    $('user-menu').innerHTML = `<div class="ug">Account (simulated SSO)</div>` + A.users.map((x, i) => `<button data-u="${i}">${x.id === u.id ? '● ' : '○ '}${x.name} <small>${x.role}</small></button>`).join('') +
      `<div class="ug">Preferences</div><button id="um-theme">${A.theme() === 'dark' ? '☀ Light theme' : '☾ Dark theme'}</button><button id="um-lang">${A.lang === 'en' ? 'ع  العربية' : 'EN  English'}</button>`;
    $('user-menu').querySelectorAll('[data-u]').forEach((b) => (b.onclick = () => { A.user = A.users[+b.dataset.u]; renderUser(); $('user-menu').hidden = true; A.emit('role', A.user); if (DOCS[A.view]) DOCS[A.view](); }));
    $('um-theme').onclick = () => setTheme(A.theme() === 'dark' ? 'light' : 'dark'); $('um-lang').onclick = () => setLang(A.lang === 'en' ? 'ar' : 'en');
  }
  function boot() {
    buildNav(); renderUser(); A.applyI18n(); setTheme(A.theme());
    $('theme').onclick = () => { setTheme(A.theme() === 'dark' ? 'light' : 'dark'); renderUser(); };
    $('user-btn').onclick = (e) => { e.stopPropagation(); const m = $('user-menu'); m.hidden = !m.hidden; $('user-btn').setAttribute('aria-expanded', String(!m.hidden)); };
    document.addEventListener('click', (e) => { if (!e.target.closest('#user')) $('user-menu').hidden = true; });
    $('nav-toggle').onclick = () => $('side').classList.toggle('open');
    A.initMap(); A.initSim(); A.initVision();
    A.audit.append('session', 'login', '', `user ${A.user.id} (${A.user.role})`, 'OK');
    A.sqlReady.then(() => A.initAgent()).catch((e) => { console.error(e); $('msgs').textContent = 'SQL engine failed to load: ' + e; });
    A.on('audit', () => { if (A.view === 'gov') A.renderDoc('gov'); });
    A.on('hour', () => { /* clock follows slider when the simulation is off */ });
    window.addEventListener('hashchange', route); route();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
