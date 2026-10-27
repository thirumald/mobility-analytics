/* Document-style views: Data & Sizing (Stage 0 EDA), Governance (identity, RBAC, PII, audit), Requirements traceability */
(function () {
  const $ = (id) => document.getElementById(id);

  /* =============================================================== DATA & SIZING */
  function data() {
    const E = A.D.eda, Q = E.quality, C = E.chaining, S = E.stats;
    const netHour = Array.from({ length: 24 }, (_, h) => Object.values(A.routeHour.weekday).reduce((a, r) => a + r[h].val, 0));
    const stopTot = Object.values(A.stopHour).map((v) => v.reduce((a, b) => a + b, 0)), bins = [0, 100, 300, 1000, 3000, 10000, 1e9];
    const hist = bins.slice(1).map((hi, i) => stopTot.filter((v) => v >= bins[i] && v < hi).length);
    const spd = A.segments.map((s) => A.segHour[s.seg_id][8].speed), sb = [0, 10, 15, 20, 25, 30, 40, 60, 120], sh = sb.slice(1).map((hi, i) => spd.filter((v) => v >= sb[i] && v < hi).length);
    const byCity = {}; A.rows('stops').forEach((s) => (byCity[s.city] = (byCity[s.city] || 0) + 1));
    const dq = [['Duplicate validations', Q.duplicates, Q.dup_pct + '%', 'warn', 'same card + stop within <1 s'], ['Validations without stop_id', Q.missing_stop, Q.missing_pct + '%', 'warn', 'excluded from O/D chaining'],
      ['Validations without matching trip', '–', Q.validations_without_trip_pct + '%', 'warn', 'AFC↔operational link'], ['AVL gaps (>90 s)', '–', Q.avl_gap_pct + '%', 'warn', 'tunnels / connectivity loss'],
      ['AVL (0,0) coordinates', '–', Q.avl_zero_coord_pct + '%', 'bad', 'GPS cold start'], ['Vehicles with clock drift >60 s', Q.clock_drift_vehicles, '4%', 'bad', 'AFC vs AVL time mismatch']];
    const suit = [['DT-01 Travel time', 'AVL + registry', 'ok', '30 s GPS gives segment speeds. Limit: tunnels, gaps.'], ['DT-02 Utilization', 'AFC + operational + capacity', 'warn', 'Validation = boarding only; load is estimated (improves with DT-05). Capacity is nominal.'],
      ['DT-03 Clusters', 'AFC + registry', 'ok', 'Validations map to stops. Limit: non-validating riders.'], ['DT-04 Routes & transfers', 'registry + AFC chaining', 'warn', 'Overlap from geometry; transfers from card chaining.'],
      ['DT-05 O/D', 'AFC (≥2 validations/card)', 'warn', `Chaining: ${C.alight_exact_pct}% exact stop / ${C.alight_zone_pct}% zone on synthetic ground truth. Single-trip cards dropped.`],
      ['Fleet & EV', 'telematics + charger telemetry', 'ok', 'SOC, health, charger kW at 1 min; needs depot network access.'], ['Events', 'AFC history + event calendar', 'warn', 'Mode share and ingress/egress curves need past-event calibration.'],
      ['Safety', 'camera events + telematics', 'warn', 'Requires camera coverage and privacy review (no plates / faces stored).'], ['Heat & equity', 'AFC + weather + census', 'warn', 'Needs shelter inventory and a population grid.']];
    const bd = { ok: 'Suitable', warn: 'Suitable with limits', bad: 'Needs data' };
    $('edaBody').innerHTML = `
      <h2>Data discovery (Stage 0) & infrastructure sizing</h2>
      <div class="note"><b>Synthetic data.</b> This report is generated from synthetic data and demonstrates the seven-section discovery template. With real operator data the same sections are filled with measured figures.</div>
      <section class="card"><h3>1 · Data sources, key fields and structures</h3>${A.tableHTML(['source', 'key fields', 'granularity', 'update'], E.sources.map((s) => [s.name, s.key, s.granularity, s.freq]))}</section>
      <section class="card"><h3>2 · Volumes, coverage, granularity, update frequency</h3>${A.tableHTML(['source', 'records / day', 'coverage'], E.sources.map((s) => [s.name, s.records_day, s.coverage]))}
        <div class="grid2"><div><h3>Validations by hour (weekday)</h3>${A.bar(netHour, { labels: netHour.map((_, i) => A.pad(i)), label: 'validations by hour' })}</div><div><h3>Stops by area</h3>${A.tableHTML(['area', 'stops'], Object.entries(byCity).sort((a, b) => b[1] - a[1]))}</div></div></section>
      <section class="card"><h3>3 · Key statistics and distributions</h3>
        <div class="cards"><div class="c"><b>${A.fmt(S.total_validations_weekday)}</b><small>validations / weekday</small></div><div class="c"><b>${S.peak_hour}:00</b><small>network peak</small></div><div class="c"><b>${S.segments}</b><small>segments</small></div><div class="c"><b>${S.vehicles}</b><small>vehicles</small></div></div>
        <div class="grid2"><div><h3>Daily validations per stop</h3>${A.bar(hist, { labels: ['<100', '<300', '<1k', '<3k', '<10k', '10k+'], label: 'stop histogram' })}</div><div><h3>Segment speed at 08:00 (km/h)</h3>${A.bar(sh, { labels: ['<10', '<15', '<20', '<25', '<30', '<40', '<60', '60+'], color: A.C.warn, label: 'speed histogram' })}</div></div></section>
      <section class="card"><h3>4 · Missing, duplicate, inconsistent and anomalous records</h3>
        <table class="t"><thead><tr><th>issue</th><th class="num">count</th><th class="num">share</th><th>severity</th><th>comment</th></tr></thead><tbody>${dq.map((r) => `<tr><td>${r[0]}</td><td class="num">${typeof r[1] === 'number' ? A.fmt(r[1]) : r[1]}</td><td class="num">${r[2]}</td><td><span class="badge ${r[3]}">${r[3] === 'bad' ? 'high' : 'medium'}</span></td><td>${r[4]}</td></tr>`).join('')}</tbody></table><small>Defects are injected on purpose so the template has something to show.</small></section>
      <section class="card"><h3>5 · Options for linking the sources</h3>${A.tableHTML(['link', 'join key', 'approach', 'risk'], [['AFC ↔ Registry', 'stop_id, route_id', 'Exact key', 'Stale stop IDs'], ['AFC ↔ AVL', 'vehicle_id + time ±60 s', 'Time window + nearest GPS fix', 'Clock drift; terminal→vehicle map'],
        ['AFC ↔ Operational', 'trip_id (via vehicle + time)', 'Interval join to trip schedule', `Trip-less validations ${Q.validations_without_trip_pct}%`], ['AFC ↔ AFC (same card)', 'card_hash + day', 'Chaining (DT-04/05)', 'Single-validation cards'], ['Telematics ↔ Charger', 'vehicle_id + depot gate time', 'Session join', 'Unmanaged charging off-depot']])}</section>
      <section class="card"><h3>6 · Suitability for the solution modules</h3><table class="t"><thead><tr><th>module</th><th>needs</th><th>verdict</th><th>limitations</th></tr></thead><tbody>${suit.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td><span class="badge ${r[2]}">${bd[r[2]]}</span></td><td>${r[3]}</td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h3>7 · Methodology recommendations for data preparation</h3><ul>
        <li>Deduplicate validations (card + stop within 60 s); keep cards only as keyed hashes (privacy by design).</li><li>Estimate a per-vehicle clock offset to align AVL and AFC.</li>
        <li>Aggregate segment speeds hourly with median/IQR; do not interpolate GPS gaps.</li><li>Expose only aggregate tables (the schema in Copilot) to the model; raw streams never reach it.</li>
        <li>Accept O/D on methodology; validate against a calibration sample (survey or APC).</li><li>Calibrate event surge curves and mode share from past-event validations before operational use.</li></ul></section>
      <h2>Infrastructure sizing & technical justification</h2>
      <section class="card"><div class="form">
        ${[['val', 'Validations / day', 1500000], ['veh', 'Vehicles with telematics', 2600], ['ping', 'Ping interval (s)', 30], ['yrs', 'History kept (years)', 3], ['usr', 'Concurrent users', 40], ['qry', 'Copilot queries / day', 1500], ['cam', 'Camera streams (AI)', 24]].map(([k, l, v]) => `<label class="f">${l}<input type="number" id="sz_${k}" value="${v}" min="1"></label>`).join('')}
        <label class="f">LLM size<select id="sz_llm"><option value="8">8B</option><option value="32" selected>32B</option><option value="70">70B</option></select></label></div>
        <div id="szOut"></div><div class="row2"><button id="szMd" class="pri">⬇ Technical justification (.md)</button></div>
        <small>Formulas are deliberately simple and must be replaced with measured values in Stage 0. Defaults are illustrative.</small></section>`;
    const calc = () => {
      const g = (k) => +$('sz_' + k).value || 0, llm = +$('sz_llm').value, valRow = 120, avlRow = 80, comp = 3, idx = 1.5, rep = 2, bk = 2;
      const afcGB = (g('val') * 365 * g('yrs') * valRow) / 1e9, avlGB = (g('veh') * ((17 * 3600) / g('ping')) * 365 * g('yrs') * avlRow) / 1e9, rawGB = ((afcGB + avlGB) / comp) * idx, totTB = (rawGB * rep * bk) / 1000;
      const ingest = (g('val') / 86400) * 6 + g('veh') / g('ping'), cores = Math.ceil(ingest / 5000) + Math.ceil(g('usr') * 0.6) + 16 + g('cam') * 2;
      const ram = Math.ceil(rawGB * 0.05 + 64 + g('usr') * 1.5), vram = llm * 1.25 + 8 + Math.ceil(g('qry') / 5000) * 8 + g('cam') * 1.5, gpus = Math.ceil(vram / 80);
      $('szOut').innerHTML = `<div class="cards"><div class="c"><b>${totTB.toFixed(1)} TB</b><small>storage (replicated + backup)</small></div><div class="c"><b>${cores}</b><small>vCPU</small></div><div class="c"><b>${ram} GB</b><small>RAM</small></div><div class="c"><b>${gpus}× 80 GB</b><small>GPU (${Math.round(vram)} GB VRAM)</small></div></div>
        <small>AFC ${afcGB.toFixed(0)} GB + telemetry ${avlGB.toFixed(0)} GB raw → ÷${comp} compression ×${idx} index; ×${rep} replication ×${bk} backups. Ingest ≈ ${ingest.toFixed(0)} events/s peak.</small>`;
      return { totTB, cores, ram, vram, gpus };
    };
    document.querySelectorAll('#edaBody input,#edaBody select').forEach((e) => (e.oninput = calc)); calc();
    $('szMd').onclick = () => { const o = calc(), g = (k) => $('sz_' + k).value;
      A.download('infrastructure_justification.md', `# Infrastructure justification (DRAFT – synthetic inputs)\n\n## Inputs\n- Validations/day: ${g('val')}\n- Vehicles: ${g('veh')}\n- Ping interval: ${g('ping')} s\n- History: ${g('yrs')} years\n- Concurrent users: ${g('usr')}\n- Copilot queries/day: ${g('qry')}\n- Camera streams: ${g('cam')}\n- LLM: ${$('sz_llm').value}B parameters (8-bit)\n\n## Result\n| Resource | Value |\n|---|---|\n| Storage | ${o.totTB.toFixed(1)} TB |\n| vCPU | ${o.cores} |\n| RAM | ${o.ram} GB |\n| GPU | ${o.gpus} × 80 GB (${Math.round(o.vram)} GB VRAM) |\n\n## Method\nValidation row 120 B, telemetry row 80 B, 3× compression, 1.5× index overhead, 2× replication, 2× backup. CPU = ingest/5000 + 0.6/user + 16 base + 2/camera. VRAM = params × 1.25 + 8 GB per 5000 queries/day + 1.5 GB/camera.\n\n_To be replaced with measured values from the Stage 0 data discovery._\n`, 'text/markdown'); };
  }

  /* ============================================================ GOVERNANCE */
  function gov() {
    const log = A.audit.all().slice().reverse(), v = A.audit.verify(), roles = Object.keys(A.ROLE_TABLES), tbl = A.ROLE_TABLES.analyst;
    $('auditBody').innerHTML = `<h2>Governance, security & audit</h2>
      <div class="grid2">
      <section class="card"><h3>Identity (simulated SSO)</h3><p>Signed-in user: <b>${A.esc(A.user.name)}</b><br><code>${A.esc(A.user.id)}</code> · role <span class="badge cy">${A.user.role}</span></p>
        <small>In production, login and authorization integrate with the client's identity provider (OIDC/SAML). The header selector is a demo stand-in.</small></section>
      <section class="card"><h3>PII masking & aggregation</h3><ul><li>Card IDs never enter this app — only aggregate tables are loaded.</li><li>Cells below k are masked: k = <b class="mono">${A.kFor(A.user.role)}</b> for role ${A.user.role}.</li><li>The live ticker shows cards as “••••”; camera tracks carry no plates or faces.</li></ul>
        <small>The threshold k and who may see disaggregated data are open policy decisions.</small></section></div>
      <section class="card"><h3>Role-based access (role → table permissions)</h3><div style="overflow:auto"><table class="t"><thead><tr><th>table</th>${roles.map((r) => `<th>${r}</th>`).join('')}</tr></thead><tbody>${tbl.map((t) => `<tr><td><code>${t}</code></td>${roles.map((r) => `<td>${A.ROLE_TABLES[r].includes(t) ? '<span style="color:#34d399">✔</span>' : '<span style="color:#fb7185">✖</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><small>Role list is a placeholder pending the client's access model.</small></section>
      <section class="card"><h3>Immutable audit log <span class="badge ${v.ok ? 'ok' : 'bad'}">${v.ok ? 'chain intact' : 'TAMPERING detected at #' + v.at}</span> <small>${v.total} entries</small></h3>
        <div class="row2"><button id="auVerify">Verify chain</button><button id="auTamper">Simulate tampering</button><button id="auExport">⬇ JSON</button><button id="auClear">Clear (demo)</button></div>
        <div style="max-height:380px;overflow:auto">${log.length ? `<table class="t"><thead><tr><th>#</th><th>timestamp (UTC)</th><th>user</th><th>status</th><th>question / action</th><th>hash</th></tr></thead><tbody>${log.map((e) => `<tr><td>${e.seq}</td><td class="mono">${e.ts}</td><td>${A.esc(e.user_id)}</td><td><span class="badge ${e.status === 'OK' ? 'ok' : 'bad'}">${e.status}</span></td><td title="${A.esc(e.sql)}\n→ ${A.esc(e.response)}">${A.esc(e.question)}</td><td><code>${e.hash.slice(0, 10)}…</code></td></tr>`).join('')}</tbody></table>` : '<p><small>No entries yet — ask the Copilot something.</small></p>'}</div>
        <div class="note">Each entry carries the previous entry's SHA-256, so edits are detectable. A static page only stores in the browser; production needs server-side WORM storage and a retention policy.</div></section>`;
    $('auVerify').onclick = gov; $('auTamper').onclick = () => { A.audit.tamper(); gov(); }; $('auClear').onclick = () => { A.audit.clear(); gov(); };
    $('auExport').onclick = () => A.download('audit_log.json', JSON.stringify(A.audit.all(), null, 2), 'application/json');
  }

  /* ========================================================= REQUIREMENTS */
  const REQ = [
    ['DD-01', 'Exploratory analysis of AFC/AVL/registry/operational data', 'sim', 'Data & Sizing (synthetic)'], ['DD-02', 'Discovery report, seven sections', 'sim', 'Data & Sizing'], ['DD-03', 'Infrastructure sizing from measured data', 'sim', 'Sizing calculator'], ['DD-04', 'Technical justification document', 'sim', 'Markdown export'],
    ['UI-01', 'UI design & brand book', 'open', 'Draft dark design system; brand book not supplied'], ['UI-02', 'Final UX', 'open', 'Needs customer review'], ['UI-03', 'User interface', 'mvp', 'This app'],
    ['AG-01', 'Natural-language questions (Arabic + English)', 'mvp', 'Copilot (rule-based parser)'], ['AG-02', 'Text-to-SQL on aggregated results only', 'mvp', 'Real SQL on in-browser SQLite; ≤50 aggregated rows'], ['AG-03', 'Map object → chat parameter', 'mvp', 'Click stop/route/segment/vehicle → Ask Copilot'],
    ['DT-01', 'Travel time & slow zones', 'mvp', 'Network · Travel time'], ['DT-02', 'Utilization / occupancy', 'mvp', 'Network · Utilization'], ['DT-03', 'Demand concentration', 'mvp', 'Network · Demand clusters'], ['DT-04', 'Route diagnostics & transfers', 'mvp', 'Network · Route & transfers'], ['DT-05', 'O/D reconstruction', 'mvp', 'Network · Origin–Destination'],
    ['SC-01', 'Identity integration', 'sim', 'User selector stands in for SSO'], ['SC-02', 'Role-based access', 'sim', 'Role → table permissions'], ['SC-03', 'Immutable audit log', 'sim', 'Hash-chained log'], ['SC-04', 'PII masking / aggregation', 'mvp', 'No card IDs shipped; small-cell masking'],
    ['EX-01', 'Fleet & EV charging analytics', 'mvp', 'Network · Fleet & EV'], ['EX-02', 'Emissions & electrification what-if', 'mvp', 'Network · Emissions'], ['EX-03', 'Event surge planner', 'mvp', 'Network · Event surge'], ['EX-04', 'Safety & incidents; vision feeds', 'mvp', 'Network · Safety, Vision tab'],
    ['EX-05', 'What-if service planner', 'mvp', 'Network · What-if'], ['EX-06', 'Heat & dust resilience', 'mvp', 'Network · Heat & dust'], ['EX-07', 'Accessibility & equity', 'mvp', 'Network · Access & equity'],
  ];
  const ST = { mvp: ['ok', 'Working in MVP'], sim: ['warn', 'Simulated / demo'], open: ['bad', 'Open / needs input'] };
  function req() {
    $('reqBody').innerHTML = `<h2>Requirements traceability</h2>
      <section class="card"><table class="t"><thead><tr><th>ID</th><th>requirement</th><th>MVP status</th><th>where</th></tr></thead><tbody>${REQ.map((r) => `<tr><td><b class="mono">${r[0]}</b></td><td>${r[1]}</td><td><span class="badge ${ST[r[2]][0]}">${ST[r[2]][1]}</span></td><td>${r[3]}</td></tr>`).join('')}</tbody></table>
      <small>DD/UI/AG/DT/SC come from the original specification; EX-xx are additional modules discovered on the same data platform.</small></section>
      <section class="card"><h3>Open items to clarify with the client</h3><ul><li>UI-01: brand book</li><li>AG-03: map parameter details</li><li>SC-02: RBAC text and role list</li><li>AG-01/02: acceptance criteria and Arabic/English Text-to-SQL test set</li><li>SC-03: audit retention and tamper-proofing</li><li>SC-04: aggregation threshold (MVP uses k=${A.K}) and roles allowed to see disaggregated data</li></ul></section>
      <section class="card"><h3>Design tokens (draft)</h3><div class="row2">${[['#070b14', 'Space'], ['#0e1627', 'Surface'], ['#22d3ee', 'Cyan'], ['#8b5cf6', 'Violet'], ['#34d399', 'OK'], ['#fbbf24', 'Warn'], ['#fb7185', 'Alert']].map(([c, n]) => `<div style="text-align:center"><div style="background:${c};width:72px;height:44px;border-radius:10px;border:1px solid var(--line)"></div><small>${n}<br><span class="mono">${c}</span></small></div>`).join('')}</div>
        <small>Dark mission-control style (inspired by aerospace operations consoles). Replace with the client's brand book when supplied.</small></section>
      <section class="card"><h3>Data sources & licences</h3><ul>
        <li>UAE emirate outlines: Natural Earth (public domain). Leaflet 1.9.4 (BSD-2) and sql.js 1.10.3 (MIT) are vendored. Optional live basemap: © OpenStreetMap contributors © CARTO.</li>
        <li>Four camera scenes are <b>simulated</b> (<code>tools/make_scenes.py</code>). Three clips are generic real footage (OpenCV "vtest" pedestrian clip; a public highway-traffic clip) used for demonstration only — not from the UAE. Check licence terms before public release and replace with owned footage.</li>
        <li>All network, fleet, event, weather and incident data is synthetic; place coordinates are approximate.</li></ul></section>`;
  }
  A.renderDoc = (v) => ({ data, gov, req })[v]?.();
})();
