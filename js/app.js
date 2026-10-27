/* App bootstrap: navigation, language, user/role switching */
(function () {
  const $ = (id) => document.getElementById(id);
  A.view = 'map';
  A.goto = (v) => {
    A.view = v;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
    if (v === 'map' && A.map) setTimeout(() => A.map.invalidateSize(), 30);
    if (['eda', 'audit', 'req'].includes(v)) A.renderDoc(v);
    A.emit('view', v);
  };

  function boot() {
    $('userSel').innerHTML = A.users.map((u, i) => `<option value="${i}">${u.name} · ${u.role}</option>`).join('');
    $('userSel').onchange = (e) => { A.user = A.users[+e.target.value]; A.emit('role', A.user); if (['audit', 'eda'].includes(A.view)) A.renderDoc(A.view); };
    document.querySelectorAll('#nav button').forEach((b) => (b.onclick = () => A.goto(b.dataset.view)));
    document.querySelectorAll('.seg [data-lang]').forEach((b) => (b.onclick = () => { A.lang = b.dataset.lang; A.applyI18n(); A.emit('lang', A.lang); if (['eda', 'audit', 'req'].includes(A.view)) A.renderDoc(A.view); }));
    A.applyI18n();
    A.initMap(); A.initLive();
    A.audit.append('session', 'login', '', `user ${A.user.id} (${A.user.role})`, 'OK');
    A.sqlReady.then(() => A.initAgent()).catch((e) => { console.error(e); $('msgs').textContent = 'SQL engine failed to load: ' + e; });
    A.on('audit', () => { if (A.view === 'audit') A.renderDoc('audit'); });
    const q = new URLSearchParams(location.search).get('view'); if (q) A.goto(q);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
