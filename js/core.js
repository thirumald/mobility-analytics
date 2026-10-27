/* Core: state, i18n, data access, in-browser SQL (sql.js), RBAC, helpers */
(function () {
  const A = (window.A = { lang: 'az', hour: 8, sel: null, K: 10, listeners: {} });

  /* ------------------------------------------------------------ i18n */
  const I = {
    az: {
      brand_sub: 'Nəqliyyat Analitikası', nav_map: 'Xəritə & Diaqnostika', nav_agent: 'AI Agent', nav_live: 'Canlı məlumat',
      nav_eda: 'Mərhələ 0 · EDA', nav_audit: 'Audit & Təhlükəsizlik', nav_req: 'Tələblər', hour: 'Saat',
      live_sim: 'Canlı simulyasiya', fit_az: 'Azərbaycan', fit_baku: 'Bakı', online_tiles: 'Onlayn xəritə', show_stops: 'Dayanacaqlar',
      live_clock: 'Simulyasiya saatı', k_veh: 'hərəkətdə nəqliyyat', k_val: 'validasiya (sessiya)', k_spd: 'orta sürət km/s',
      agent_title: 'Şəbəkə üzrə AI agent', agent_sub: 'Sual → SQL (Text-to-SQL) → yalnız aqreqasiya olunmuş nəticələr',
      chat_ph: 'Sualınızı yazın…', send: 'Göndər', guard_title: 'Qoruyucu qaydalar', schema_title: 'Analitik sxem',
      g1: 'Modelə yalnız aqreqasiya olunmuş nəticə sətirləri (maks. 50) ötürülür.', g2: 'Rola uyğun cədvəl icazələri tətbiq olunur.',
      g3: 'Hər sual və cavab audit jurnalına yazılır.', g4: 'Kiçik hüceyrələr (< k) maskalanır; kart identifikatorları heç vaxt göstərilmir.',
      live_title: 'Real videolar üzərində canlı məlumat nöqtələri',
      live_note: 'Videolar real görüntülərdir (açıq nümunə footage, Azərbaycandan deyil). Hərəkət izləmə (OpenCV) oflayn aparılıb, nöqtələr videonun cari saniyəsinə sinxron çəkilir. Real layihədə bu axın AYNA kameraları / APC sensorlarından gələcək.',
      dt1: 'DT-01 Səyahət vaxtı', dt2: 'DT-02 Tutum', dt3: 'DT-03 Tələb klasterləri', dt4: 'DT-04 Marşrut & köçürmə', dt5: 'DT-05 Mənşə–təyinat',
      overview: 'İcmal', ask_agent: 'Agentdən soruş', selected: 'Seçilmiş', clear: 'Təmizlə', stop: 'Dayanacaq', route: 'Marşrut', segment: 'Seqment',
      you: 'Siz', agent: 'Agent', rows_to_model: 'Modelə ötürülən sətir', sql_label: 'SQL', denied: 'İcazə yoxdur', no_data: 'Nəticə yoxdur',
      try: 'Nümunələr', play: 'Oynat', pause: 'Dayandır', download: 'Videonu yüklə', dl_tracks: 'Nöqtələri CSV yüklə',
    },
    en: {
      brand_sub: 'Transit Analytics', nav_map: 'Map & Diagnostics', nav_agent: 'AI Agent', nav_live: 'Live data',
      nav_eda: 'Stage 0 · EDA', nav_audit: 'Audit & Security', nav_req: 'Requirements', hour: 'Hour',
      live_sim: 'Live simulation', fit_az: 'Azerbaijan', fit_baku: 'Baku', online_tiles: 'Online map', show_stops: 'Stops',
      live_clock: 'Simulation clock', k_veh: 'vehicles moving', k_val: 'validations (session)', k_spd: 'avg speed km/h',
      agent_title: 'Network AI agent', agent_sub: 'Question → SQL (Text-to-SQL) → aggregated results only',
      chat_ph: 'Type your question…', send: 'Send', guard_title: 'Guardrails', schema_title: 'Analytical schema',
      g1: 'Only aggregated result rows (max 50) are passed to the model.', g2: 'Role-based table permissions are enforced.',
      g3: 'Every question and answer is written to the audit log.', g4: 'Small cells (< k) are masked; card identifiers are never shown.',
      live_title: 'Live data points over real video',
      live_note: 'The videos are real footage (open sample clips, not from Azerbaijan). Motion tracking (OpenCV) was run offline and the points are drawn in sync with the current video time. In production this feed comes from AYNA cameras / APC sensors.',
      dt1: 'DT-01 Travel time', dt2: 'DT-02 Utilization', dt3: 'DT-03 Demand clusters', dt4: 'DT-04 Route & transfers', dt5: 'DT-05 Origin–Destination',
      overview: 'Overview', ask_agent: 'Ask the agent', selected: 'Selected', clear: 'Clear', stop: 'Stop', route: 'Route', segment: 'Segment',
      you: 'You', agent: 'Agent', rows_to_model: 'Rows passed to model', sql_label: 'SQL', denied: 'Not permitted', no_data: 'No results',
      try: 'Try', play: 'Play', pause: 'Pause', download: 'Download video', dl_tracks: 'Download points CSV',
    },
  };
  A.t = (k) => (I[A.lang] && I[A.lang][k]) || I.en[k] || k;
  A.applyI18n = () => {
    document.documentElement.lang = A.lang;
    document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = A.t(e.dataset.i18n)));
    document.querySelectorAll('[data-i18n-ph]').forEach((e) => (e.placeholder = A.t(e.dataset.i18nPh)));
    document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === A.lang));
  };

  /* ------------------------------------------------------- events */
  A.on = (ev, fn) => ((A.listeners[ev] = A.listeners[ev] || []).push(fn));
  A.emit = (ev, p) => (A.listeners[ev] || []).forEach((f) => f(p));

  /* --------------------------------------------------- data access */
  const D = window.AYNA_DATA;
  A.D = D;
  A.rows = (name) => D.tables[name].rows.map((r) => Object.fromEntries(D.tables[name].cols.map((c, i) => [c, r[i]])));
  A.stops = Object.fromEntries(A.rows('stops').map((s) => [s.stop_id, s]));
  A.routes = Object.fromEntries(A.rows('routes').map((r) => [r.route_id, r]));
  A.routeStops = {};
  A.rows('route_stops').forEach((r) => (A.routeStops[r.route_id] = A.routeStops[r.route_id] || []).push(r.stop_id));
  A.segments = A.rows('segments');
  A.segById = Object.fromEntries(A.segments.map((s) => [s.seg_id, s]));
  A.segHour = {}; // seg_id -> [{speed,travel,delay}] by hour
  D.tables.segment_hour.rows.forEach((r) => ((A.segHour[r[0]] = A.segHour[r[0]] || [])[r[1]] = { speed: r[2], travel: r[3], delay: r[4] }));
  A.stopHour = {};
  D.tables.stop_hour.rows.forEach((r) => ((A.stopHour[r[0]] = A.stopHour[r[0]] || [])[r[1]] = r[2]));
  A.routeHour = { weekday: {}, weekend: {} };
  D.tables.route_hour.rows.forEach((r) => ((A.routeHour[r[1]][r[0]] = A.routeHour[r[1]][r[0]] || [])[r[2]] = { trips: r[3], val: r[4], cap: r[5], lr: r[6] }));
  A.stopsHub = Object.values(A.stops).filter((s) => s.is_hub);

  /* ------------------------------------------------------ helpers */
  A.fmt = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
  A.pad = (n) => String(n).padStart(2, '0');
  A.hh = (h) => A.pad(h) + ':00';
  A.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.norm = (s) =>
    String(s).toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');
  A.hav = (a, b) => {
    const p = Math.PI / 180, dl = (b[0] - a[0]) * p, dn = (b[1] - a[1]) * p;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin(dn / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  A.ll = (stopId) => [A.stops[stopId].lat, A.stops[stopId].lon];
  A.rampSpeed = (ratio) => { // 1 = free flow, 0 = stopped
    const c = ratio > 0.8 ? '#2e8b57' : ratio > 0.6 ? '#9bbd45' : ratio > 0.45 ? '#e9a23b' : '#c8394a';
    return c;
  };
  A.rampLoad = (lr) => (lr == null ? '#9aa9ae' : lr >= 1 ? '#c8394a' : lr >= 0.8 ? '#e9763b' : lr >= 0.6 ? '#e9a23b' : '#2e8b57');
  A.csv = (cols, rows) => [cols.join(','), ...rows.map((r) => r.map((v) => (typeof v === 'string' && /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(','))].join('\n');
  A.download = (name, text, type = 'text/csv') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };
  A.bar = (vals, o = {}) => { // small SVG bar chart
    const w = o.w || 360, h = o.h || 90, m = 14, n = vals.length, mx = Math.max(o.max || 0, ...vals.filter((v) => v != null), 1e-9);
    const bw = (w - m) / n;
    let s = `<svg class="bars" viewBox="0 0 ${w} ${h + 16}" role="img" aria-label="${A.esc(o.label || 'chart')}">`;
    vals.forEach((v, i) => {
      if (v == null) return;
      const bh = (v / mx) * h, col = typeof o.color === 'function' ? o.color(v, i) : o.color || '#0b7a75';
      s += `<rect x="${m + i * bw + 1}" y="${h - bh}" width="${Math.max(1, bw - 2)}" height="${bh}" fill="${col}" rx="2"><title>${o.labels ? o.labels[i] : i}: ${A.fmt(v, 2)}</title></rect>`;
    });
    if (o.ref != null) { const y = h - (o.ref / mx) * h; s += `<line x1="${m}" x2="${w}" y1="${y}" y2="${y}" stroke="#c8394a" stroke-dasharray="4 3"/><text x="${w - 2}" y="${y - 3}" font-size="9" fill="#c8394a" text-anchor="end">${o.refLabel || ''}</text>`; }
    for (let i = 0; i < n; i += Math.ceil(n / 8)) s += `<text x="${m + i * bw + bw / 2}" y="${h + 12}" font-size="9" fill="#5d6f76" text-anchor="middle">${o.labels ? o.labels[i] : i}</text>`;
    s += `<text x="0" y="9" font-size="9" fill="#5d6f76">${A.fmt(mx, mx < 10 ? 1 : 0)}</text></svg>`;
    return s;
  };

  /* ----------------------------------------------------- identity (SC-01 simulated) */
  A.users = [
    { id: 'ayna\\a.mammadova', name: 'Aysel Məmmədova', role: 'analyst' },
    { id: 'ayna\\r.aliyev', name: 'Rauf Əliyev', role: 'viewer' },
    { id: 'ayna\\admin', name: 'Admin (AYNA IT)', role: 'admin' },
  ];
  A.user = A.users[0];
  /* RBAC (SC-02): role list is a placeholder – the source requirement is incomplete */
  A.ROLE_TABLES = {
    viewer: ['stops', 'routes', 'route_stops', 'route_hour', 'stop_hour', 'route_overlap', 'route_diag'],
    analyst: ['stops', 'routes', 'route_stops', 'route_hour', 'stop_hour', 'route_overlap', 'route_diag', 'segments', 'segment_hour', 'transfers', 'od_zone'],
    admin: ['stops', 'routes', 'route_stops', 'route_hour', 'stop_hour', 'route_overlap', 'route_diag', 'segments', 'segment_hour', 'transfers', 'od_zone'],
  };
  A.kFor = (role) => (role === 'admin' ? 1 : A.K); // which roles see disaggregated data is an open item (SC-04)

  /* --------------------------------------------------------- SQL */
  A.sqlReady = (async () => {
    const bin = Uint8Array.from(atob(window.SQL_WASM_B64), (c) => c.charCodeAt(0));
    const SQL = await initSqlJs({ wasmBinary: bin });
    const db = new SQL.Database();
    const TXT = new Set(['stop_id', 'name', 'city', 'zone', 'route_id', 'kind', 'color', 'seg_id', 'from_stop', 'to_stop', 'day_type', 'origin_zone', 'dest_zone', 'route_a', 'route_b']);
    db.run('BEGIN');
    A.schema = {};
    for (const [name, t] of Object.entries(D.tables)) {
      db.run(`CREATE TABLE ${name} (${t.cols.map((c) => c + (TXT.has(c) ? ' TEXT' : ' REAL')).join(',')})`);
      const st = db.prepare(`INSERT INTO ${name} VALUES (${t.cols.map(() => '?').join(',')})`);
      t.rows.forEach((r) => st.run(r));
      st.free();
      A.schema[name] = t.cols;
    }
    db.run('COMMIT');
    A.db = db;
    return db;
  })();

  /** Guarded SELECT only. Returns {cols, rows, tables}. Throws {code:'DENIED'|'BAD_SQL'} */
  A.runSQL = async (sql, role) => {
    await A.sqlReady;
    const clean = sql.trim().replace(/;+\s*$/, '');
    if (!/^(select|with)\b/i.test(clean) || /;/.test(clean) || /\b(insert|update|delete|drop|alter|attach|pragma|create|replace)\b/i.test(clean))
      throw { code: 'BAD_SQL', msg: 'Only a single read-only SELECT is allowed.' };
    const tables = [...clean.matchAll(/\b(?:from|join)\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase());
    const bad = tables.filter((t) => !A.ROLE_TABLES[role].includes(t));
    if (bad.length) throw { code: 'DENIED', msg: `Role "${role}" may not read: ${[...new Set(bad)].join(', ')}`, tables };
    const res = A.db.exec(clean);
    if (!res.length) return { cols: [], rows: [], tables };
    return { cols: res[0].columns, rows: res[0].values, tables };
  };
  /** SC-04: suppress small counts for roles under the aggregation threshold. */
  A.mask = (cols, rows, role) => {
    const k = A.kFor(role);
    const idx = cols.map((c, i) => (/(^|_)(validations|trips_est|transfers_est|boardings)$/.test(c) ? i : -1)).filter((i) => i >= 0);
    let masked = 0;
    const out = rows.map((r) => r.map((v, i) => (idx.includes(i) && typeof v === 'number' && v < k ? (masked++, '<' + k) : v)));
    return { rows: out, masked };
  };
  A.tableHTML = (cols, rows) =>
    `<table class="t"><thead><tr>${cols.map((c) => `<th>${A.esc(c)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((v) => `<td class="${typeof v === 'number' ? 'num' : ''}">${typeof v === 'number' ? A.fmt(v, Number.isInteger(v) ? 0 : 2) : A.esc(v ?? '–')}</td>`).join('')}</tr>`).join('') +
    '</tbody></table>';

  /* ------------------------------------------------------ selection (AG-03) */
  A.select = (o) => { A.sel = o; A.emit('select', o); };
  A.selLabel = (o) => {
    if (!o) return '';
    if (o.type === 'stop') return `${A.t('stop')}: ${A.stops[o.id].name} (${o.id})`;
    if (o.type === 'route') return `${A.t('route')}: ${o.id} · ${A.routes[o.id].name}`;
    if (o.type === 'segment') { const s = A.segById[o.id]; return `${A.t('segment')}: ${o.id} · ${A.stops[s.from_stop].name} → ${A.stops[s.to_stop].name}`; }
    return o.id;
  };
})();
