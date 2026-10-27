/* Core: state, i18n (EN/AR), data access, in-browser SQL (sql.js), RBAC, helpers */
(function () {
  const A = (window.A = { lang: 'en', hour: 8, sel: null, K: 10, listeners: {} });

  /* ------------------------------------------------------------ i18n (chrome only; analytics text is English) */
  const I = {
    en: {
      brand_sub: 'Mobility Intelligence', tagline: 'Abu Dhabi · UAE',
      nav_map: 'Network', nav_agent: 'Copilot', nav_vision: 'Vision', nav_usecases: 'Use cases', nav_data: 'Data & Sizing', nav_gov: 'Governance', nav_req: 'Requirements',
      hour: 'Hour', live_sim: 'Live simulation', pause: 'Pause', play: 'Play', fit_uae: 'UAE', fit_ad: 'Abu Dhabi', fit_city: 'City', online_tiles: 'Live basemap', show_stops: 'Stops',
      live_clock: 'Sim clock', k_veh: 'vehicles moving', k_val: 'validations', k_spd: 'avg km/h', ask_agent: 'Ask Copilot', selected: 'Selected', clear: 'Clear',
      stop: 'Stop', route: 'Route', segment: 'Segment', vehicle: 'Vehicle', zone: 'Zone',
      agent_title: 'SAFAR Copilot', agent_sub: 'Question → SQL → aggregated answer', chat_ph: 'Ask about the network, fleet, events, heat, equity, emissions…', send: 'Send',
      guard_title: 'Guardrails', schema_title: 'Analytical schema', try: 'Try asking',
      g1: 'Only aggregated rows (max 50) reach the model.', g2: 'Role-based table permissions.', g3: 'Every question and answer is audited.', g4: 'Cells below k are masked; card IDs are never shown.',
      vision_title: 'Vision & live feeds', vision_sub: 'Camera scenes with tracked objects and an event feed. Four are simulated scenes (exact tracks); three are real footage with OpenCV motion tracks.',
      download: 'Video', dl_tracks: 'Points CSV', sql_label: 'SQL', rows_to_model: 'Rows passed to model', denied: 'Not permitted', no_data: 'No results',
      uc_title: 'Use-case hub', uc_sub: 'Relevant use cases discovered around the same data platform — ranked by value and feasibility.',
      t_overview: 'Overview', t_travel: 'Travel time', t_util: 'Utilization', t_cluster: 'Demand clusters', t_route: 'Route & transfers', t_od: 'Origin–Destination',
      t_fleet: 'Fleet & EV', t_emis: 'Emissions', t_events: 'Event surge', t_safety: 'Safety', t_scen: 'What-if', t_heat: 'Heat & dust', t_equity: 'Access & equity',
      g_sit: 'Situational', g_intel: 'Intelligence', g_plat: 'Platform', g_transit: 'Transit diagnostics', g_energy: 'Fleet & energy', g_ops: 'Operations', g_resil: 'Resilience & equity',
    },
    ar: {
      brand_sub: 'ذكاء التنقل', tagline: 'أبوظبي · الإمارات',
      nav_map: 'الشبكة', nav_agent: 'المساعد', nav_vision: 'الرؤية', nav_usecases: 'حالات الاستخدام', nav_data: 'البيانات والسعة', nav_gov: 'الحوكمة', nav_req: 'المتطلبات',
      hour: 'الساعة', live_sim: 'محاكاة مباشرة', pause: 'إيقاف', play: 'تشغيل', fit_uae: 'الإمارات', fit_ad: 'أبوظبي', fit_city: 'المدينة', online_tiles: 'خريطة مباشرة', show_stops: 'المحطات',
      live_clock: 'ساعة المحاكاة', k_veh: 'مركبات متحركة', k_val: 'عمليات تحقق', k_spd: 'متوسط كم/س', ask_agent: 'اسأل المساعد', selected: 'المحدد', clear: 'مسح',
      stop: 'محطة', route: 'خط', segment: 'مقطع', vehicle: 'مركبة', zone: 'منطقة',
      agent_title: 'مساعد سفر', agent_sub: 'سؤال ← SQL ← إجابة مجمّعة', chat_ph: 'اسأل عن الشبكة أو الأسطول أو الفعاليات أو الحرارة أو الانبعاثات…', send: 'إرسال',
      guard_title: 'ضوابط الحماية', schema_title: 'المخطط التحليلي', try: 'جرّب أن تسأل',
      g1: 'يصل إلى النموذج صفوف مجمّعة فقط (حتى 50).', g2: 'صلاحيات الجداول حسب الدور.', g3: 'يُدقَّق كل سؤال وجواب.', g4: 'تُخفى الخلايا الأقل من k ولا تظهر أرقام البطاقات أبدًا.',
      vision_title: 'الرؤية والبث المباشر', vision_sub: 'مشاهد كاميرات مع تتبع الأجسام وسجل أحداث. أربعة مشاهد محاكاة وثلاثة تسجيلات حقيقية.',
      download: 'الفيديو', dl_tracks: 'النقاط CSV', sql_label: 'SQL', rows_to_model: 'الصفوف المرسلة للنموذج', denied: 'غير مسموح', no_data: 'لا نتائج',
      uc_title: 'مركز حالات الاستخدام', uc_sub: 'حالات استخدام ذات صلة على منصة البيانات نفسها — مرتبة حسب القيمة وسهولة التنفيذ.',
      t_overview: 'نظرة عامة', t_travel: 'زمن الرحلة', t_util: 'الإشغال', t_cluster: 'تجمعات الطلب', t_route: 'الخطوط والتبديل', t_od: 'المنشأ–الوجهة',
      t_fleet: 'الأسطول والكهرباء', t_emis: 'الانبعاثات', t_events: 'ذروة الفعاليات', t_safety: 'السلامة', t_scen: 'ماذا لو', t_heat: 'الحرارة والغبار', t_equity: 'الوصول والعدالة',
      g_sit: 'الوضع العام', g_intel: 'الذكاء', g_plat: 'المنصة', g_transit: 'تشخيص النقل', g_energy: 'الأسطول والطاقة', g_ops: 'العمليات', g_resil: 'المرونة والعدالة',
    },
  };
  A.t = (k) => (I[A.lang] && I[A.lang][k]) || I.en[k] || k;
  A.applyI18n = () => {
    document.documentElement.lang = A.lang; document.documentElement.dir = A.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = A.t(e.dataset.i18n)));
    document.querySelectorAll('[data-i18n-ph]').forEach((e) => (e.placeholder = A.t(e.dataset.i18nPh)));
    document.querySelectorAll('[data-i18n-title]').forEach((e) => (e.title = A.t(e.dataset.i18nTitle)));
    document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === A.lang));
  };

  A.on = (ev, fn) => ((A.listeners[ev] = A.listeners[ev] || []).push(fn));
  A.emit = (ev, p) => (A.listeners[ev] || []).forEach((f) => f(p));

  /* --------------------------------------------------- data access */
  const D = window.SAFAR_DATA; A.D = D;
  A.rows = (name) => D.tables[name].rows.map((r) => Object.fromEntries(D.tables[name].cols.map((c, i) => [c, r[i]])));
  A.stops = Object.fromEntries(A.rows('stops').map((s) => [s.stop_id, s]));
  A.routes = Object.fromEntries(A.rows('routes').map((r) => [r.route_id, r]));
  A.routeStops = {}; A.rows('route_stops').forEach((r) => (A.routeStops[r.route_id] = A.routeStops[r.route_id] || []).push(r.stop_id));
  A.segments = A.rows('segments'); A.segById = Object.fromEntries(A.segments.map((s) => [s.seg_id, s]));
  A.segHour = {}; D.tables.segment_hour.rows.forEach((r) => ((A.segHour[r[0]] = A.segHour[r[0]] || [])[r[1]] = { speed: r[2], travel: r[3], delay: r[4] }));
  A.stopHour = {}; D.tables.stop_hour.rows.forEach((r) => ((A.stopHour[r[0]] = A.stopHour[r[0]] || [])[r[1]] = r[2]));
  A.routeHour = { weekday: {}, weekend: {} };
  D.tables.route_hour.rows.forEach((r) => ((A.routeHour[r[1]][r[0]] = A.routeHour[r[1]][r[0]] || [])[r[2]] = { trips: r[3], val: r[4], cap: r[5], lr: r[6] }));
  A.stopsHub = Object.values(A.stops).filter((s) => s.is_hub);
  A.fleet = A.rows('fleet'); A.chargers = A.rows('chargers'); A.events = A.rows('events'); A.zonePop = A.rows('zone_pop'); A.incidents = A.rows('incidents'); A.emis = A.rows('route_emissions');
  A.chargerHour = {}; D.tables.charger_hour.rows.forEach((r) => ((A.chargerHour[r[0]] = A.chargerHour[r[0]] || [])[r[1]] = { util: r[2], kwh: r[3] }));
  A.eventDemand = {}; D.tables.event_demand.rows.forEach((r) => ((A.eventDemand[r[0]] = A.eventDemand[r[0]] || [])[r[1]] = { extra: r[2], need: r[3], spare: r[4], gap: r[5], routes: r[6] }));
  A.weather = {}; D.tables.weather_hour.rows.forEach((r) => ((A.weather[r[0]] = A.weather[r[0]] || [])[r[1]] = { t: r[2], rh: r[3], hi: r[4], vis: r[5] }));

  /* ------------------------------------------------------ helpers */
  A.fmt = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
  A.pad = (n) => String(n).padStart(2, '0');
  A.hh = (h) => A.pad(h) + ':00';
  A.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.norm = (s) => String(s).toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  A.hav = (a, b) => { const p = Math.PI / 180, dl = (b[0] - a[0]) * p, dn = (b[1] - a[1]) * p; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  A.ll = (id) => [A.stops[id].lat, A.stops[id].lon];
  A.theme = () => document.documentElement.dataset.theme || 'dark';
  A.C = { ok: '#34d399', warn: '#f5b50b', bad: '#ef4444', hot: '#f97316', cyan: '#38bdf8', violet: '#8b5cf6', mute: '#8197ad',
    get ink() { return A.theme() === 'dark' ? '#dbe6f2' : '#0e1b30'; }, get stop() { return A.theme() === 'dark' ? '#dbe6f2' : '#33445c'; }, get halo() { return A.theme() === 'dark' ? '#070d14' : '#ffffff'; } };
  A.rampSpeed = (r) => (r > 0.8 ? '#34d399' : r > 0.6 ? '#a3e635' : r > 0.45 ? '#f5b50b' : '#ef4444');
  A.rampLoad = (lr) => (lr == null ? '#64748b' : lr >= 1 ? '#ef4444' : lr >= 0.8 ? '#f97316' : lr >= 0.6 ? '#f5b50b' : '#34d399');
  A.csv = (cols, rows) => [cols.join(','), ...rows.map((r) => r.map((v) => (typeof v === 'string' && /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(','))].join('\n');
  A.download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  A.bar = (vals, o = {}) => {
    const w = o.w || 360, h = o.h || 90, m = 14, n = vals.length, mx = Math.max(o.max || 0, ...vals.filter((v) => v != null), 1e-9), bw = (w - m) / n;
    let s = `<svg class="bars" viewBox="0 0 ${w} ${h + 16}" role="img" aria-label="${A.esc(o.label || 'chart')}">`;
    vals.forEach((v, i) => { if (v == null) return; const bh = (v / mx) * h, col = typeof o.color === 'function' ? o.color(v, i) : o.color || A.C.cyan;
      s += `<rect x="${m + i * bw + 1}" y="${h - bh}" width="${Math.max(1, bw - 2)}" height="${bh}" style="fill:${col}" rx="2"><title>${o.labels ? o.labels[i] : i}: ${A.fmt(v, 2)}</title></rect>`; });
    if (o.ref != null) { const y = h - (o.ref / mx) * h; s += `<line x1="${m}" x2="${w}" y1="${y}" y2="${y}" stroke="#ef4444" stroke-dasharray="4 3"/><text x="${w - 2}" y="${y - 3}" font-size="9" fill="#ef4444" text-anchor="end">${o.refLabel || ''}</text>`; }
    for (let i = 0; i < n; i += Math.ceil(n / 8)) s += `<text x="${m + i * bw + bw / 2}" y="${h + 12}" font-size="9" style="fill:var(--mut)" text-anchor="middle">${o.labels ? o.labels[i] : i}</text>`;
    return s + `<text x="0" y="9" font-size="9" style="fill:var(--mut)">${A.fmt(mx, mx < 10 ? 1 : 0)}</text></svg>`;
  };
  A.line = (series, o = {}) => { // multi-series line chart, series = [{name,color,vals}]
    const w = o.w || 360, h = o.h || 100, m = 24, n = series[0].vals.length, mx = Math.max(o.max || 0, ...series.flatMap((s) => s.vals), 1e-9), mn = Math.min(o.min ?? 0, ...series.flatMap((s) => s.vals));
    const X = (i) => m + (i / (n - 1)) * (w - m - 4), Y = (v) => h - ((v - mn) / (mx - mn || 1)) * (h - 6) - 2;
    let s = `<svg class="bars" viewBox="0 0 ${w} ${h + 16}" role="img" aria-label="${A.esc(o.label || 'chart')}">`;
    series.forEach((se) => { s += `<polyline fill="none" stroke="${se.color}" stroke-width="2" points="${se.vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`; });
    for (let i = 0; i < n; i += Math.ceil(n / 8)) s += `<text x="${X(i)}" y="${h + 12}" font-size="9" style="fill:var(--mut)" text-anchor="middle">${o.labels ? o.labels[i] : i}</text>`;
    return s + `<text x="0" y="10" font-size="9" style="fill:var(--mut)">${A.fmt(mx, mx < 10 ? 1 : 0)}</text><text x="0" y="${h}" font-size="9" style="fill:var(--mut)">${A.fmt(mn, 0)}</text></svg>`;
  };

  /* ----------------------------------------------------- identity (simulated SSO) */
  A.users = [
    { id: 'corp\t.dharmalingam', name: 'Thirumal Dharmalingam', role: 'analyst', title: 'Mobility analyst' },
    { id: 'corp\l.almansoori', name: 'Layla Al Mansoori', role: 'viewer', title: 'Planner (read-only)' },
    { id: 'corp\ops.admin', name: 'Ops Admin', role: 'admin', title: 'Administrator' },
  ];
  A.user = A.users[0];
  const PUB = ['stops', 'routes', 'route_stops', 'route_hour', 'stop_hour', 'route_overlap', 'route_diag', 'events', 'event_demand', 'weather_hour', 'zone_pop', 'route_emissions'];
  const OPS = [...PUB, 'segments', 'segment_hour', 'transfers', 'od_zone', 'fleet', 'chargers', 'charger_hour', 'incidents'];
  A.ROLE_TABLES = { viewer: PUB, analyst: OPS, admin: OPS };
  A.kFor = (role) => (role === 'admin' ? 1 : A.K);

  /* --------------------------------------------------------- SQL */
  A.sqlReady = (async () => {
    const bin = Uint8Array.from(atob(window.SQL_WASM_B64), (c) => c.charCodeAt(0));
    const SQL = await initSqlJs({ wasmBinary: bin }), db = new SQL.Database();
    const TXT = new Set(['stop_id', 'name', 'city', 'zone', 'route_id', 'kind', 'color', 'seg_id', 'from_stop', 'to_stop', 'day_type', 'origin_zone', 'dest_zone', 'route_a', 'route_b', 'vehicle_id', 'fuel_type', 'status',
      'charger_id', 'depot', 'event_id', 'venue', 'venue_stop', 'event_date', 'routes', 'scenario', 'incident_id', 'type', 'source']);
    db.run('BEGIN'); A.schema = {};
    for (const [name, t] of Object.entries(D.tables)) {
      db.run(`CREATE TABLE ${name} (${t.cols.map((c) => c + (TXT.has(c) ? ' TEXT' : ' REAL')).join(',')})`);
      const st = db.prepare(`INSERT INTO ${name} VALUES (${t.cols.map(() => '?').join(',')})`); t.rows.forEach((r) => st.run(r)); st.free(); A.schema[name] = t.cols;
    }
    db.run('COMMIT'); A.db = db; return db;
  })();
  A.runSQL = async (sql, role) => {
    await A.sqlReady;
    const clean = sql.trim().replace(/;+\s*$/, '');
    if (!/^(select|with)\b/i.test(clean) || /;/.test(clean) || /\b(insert|update|delete|drop|alter|attach|pragma|create|replace)\b/i.test(clean)) throw { code: 'BAD_SQL', msg: 'Only a single read-only SELECT is allowed.' };
    const tables = [...clean.matchAll(/\b(?:from|join)\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase());
    const bad = tables.filter((t) => !A.ROLE_TABLES[role].includes(t));
    if (bad.length) throw { code: 'DENIED', msg: `Role "${role}" may not read: ${[...new Set(bad)].join(', ')}`, tables };
    const res = A.db.exec(clean);
    return res.length ? { cols: res[0].columns, rows: res[0].values, tables } : { cols: [], rows: [], tables };
  };
  A.mask = (cols, rows, role) => {
    const k = A.kFor(role), idx = cols.map((c, i) => (/(^|_)(validations|trips_est|transfers_est|boardings)$/.test(c) ? i : -1)).filter((i) => i >= 0); let masked = 0;
    return { rows: rows.map((r) => r.map((v, i) => (idx.includes(i) && typeof v === 'number' && v < k ? (masked++, '<' + k) : v))), masked };
  };
  A.tableHTML = (cols, rows) => `<table class="t"><thead><tr>${cols.map((c) => `<th>${A.esc(c)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((v) => `<td class="${typeof v === 'number' ? 'num' : ''}">${typeof v === 'number' ? A.fmt(v, Number.isInteger(v) ? 0 : 2) : A.esc(v ?? '–')}</td>`).join('')}</tr>`).join('') + '</tbody></table>';

  /* ------------------------------------------------------ selection */
  A.select = (o) => { A.sel = o; A.emit('select', o); };
  A.selLabel = (o) => {
    if (!o) return '';
    if (o.type === 'stop') return `${A.t('stop')}: ${A.stops[o.id].name} (${o.id})`;
    if (o.type === 'route') return `${A.t('route')}: ${o.id} · ${A.routes[o.id].name}`;
    if (o.type === 'segment') { const s = A.segById[o.id]; return `${A.t('segment')}: ${o.id} · ${A.stops[s.from_stop].name} → ${A.stops[s.to_stop].name}`; }
    if (o.type === 'vehicle') return `${A.t('vehicle')}: ${o.id}`;
    if (o.type === 'zone') return `${A.t('zone')}: ${o.id}`;
    return o.id;
  };
})();
