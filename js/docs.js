/* Document-style views: Stage 0 EDA + sizing (DD-01..04), Audit & security (SC-01..04), Requirements traceability */
(function () {
  const $ = (id) => document.getElementById(id);
  const az = () => A.lang === 'az';
  const T = (a, e) => (az() ? a : e);

  /* =============================================================== EDA */
  function eda() {
    const E = A.D.eda, Q = E.quality, C = E.chaining, S = E.stats;
    const netHour = Array.from({ length: 24 }, (_, h) => Object.values(A.routeHour.weekday).reduce((a, r) => a + r[h].val, 0));
    const stopTot = Object.values(A.stopHour).map((v) => v.reduce((a, b) => a + b, 0));
    const bins = [0, 100, 300, 1000, 3000, 10000, 1e9], hist = bins.slice(1).map((hi, i) => stopTot.filter((v) => v >= bins[i] && v < hi).length);
    const spd = A.segments.map((s) => A.segHour[s.seg_id][8].speed), sb = [0, 10, 15, 20, 25, 30, 40, 60, 100], sh = sb.slice(1).map((hi, i) => spd.filter((v) => v >= sb[i] && v < hi).length);
    const byCity = {}; A.rows('stops').forEach((s) => (byCity[s.city] = (byCity[s.city] || 0) + 1));
    const dq = [
      ['Duplicate validations', Q.duplicates, Q.dup_pct + '%', 'warn', T('Eyni kart, eyni dayanacaq, <1 san.', 'same card + stop within <1 s')],
      ['Validations without stop_id', Q.missing_stop, Q.missing_pct + '%', 'warn', T('O/D hesablamasından çıxarılır', 'excluded from O/D chaining')],
      ['Validations without matching trip', '–', Q.validations_without_trip_pct + '%', 'warn', T('AFC↔Əməliyyat əlaqəsi', 'AFC↔Operational link')],
      ['AVL gaps (>90 s)', '–', Q.avl_gap_pct + '%', 'warn', T('tunel/GPRS itkisi', 'tunnels / connectivity loss')],
      ['AVL (0,0) coordinates', '–', Q.avl_zero_coord_pct + '%', 'bad', T('GPS soyuq start', 'GPS cold start')],
      ['Vehicles with clock drift >60 s', Q.clock_drift_vehicles, '4%', 'bad', T('AFC/AVL vaxt uyğunsuzluğu', 'AFC vs AVL time mismatch')],
    ];
    const suit = [
      ['DT-01', 'AVL + registry', 'ok', T('Yaxşı: 30 san. GPS seqment sürətini verir. Məhdudiyyət: tunel/boşluqlar.', 'Good: 30 s GPS gives segment speeds. Limit: tunnels / gaps.')],
      ['DT-02', 'AFC + operational + capacity', 'warn', T('Validasiya = minmə. Düşmə yoxdur → yük təxmini (DT-05 ilə). Tutum nominaldır.', 'Validation = boarding only. No alighting → load is estimated (with DT-05). Capacity is nominal.')],
      ['DT-03', 'AFC + registry', 'ok', T('Yaxşı: validasiya sayları dayanacağa bağlıdır. Məhdudiyyət: validasiya olmayan sərnişin (pulsuz, nağd).', 'Good: validations map to stops. Limit: non-validating riders (free / cash).')],
      ['DT-04', 'registry + AFC chaining', 'warn', T('Üst-üstə düşmə/geri qayıtma həndəsədən; köçürmə kartın zəncirindən.', 'Overlap/backtracking from geometry; transfers from card chaining.')],
      ['DT-05', 'AFC (≥2 validation/card)', 'warn', T(`Zəncir üsulu: sintetik data üzrə dayanacaq dəqiqliyi ${C.alight_exact_pct}%, zona ${C.alight_zone_pct}%. Tək səfərli kartlar atılır.`, `Chaining: ${C.alight_exact_pct}% exact stop / ${C.alight_zone_pct}% zone accuracy on synthetic ground truth. Single-trip cards are dropped.`)],
    ];
    const bd = { ok: 'Suitable', warn: 'Suitable with limits', bad: 'Needs data' };
    $('edaBody').innerHTML = `
      <h2>${T('Mərhələ 0 · Məlumatların kəşfiyyatı (EDA) və infrastruktur ölçüsü', 'Stage 0 · Data discovery (EDA) and infrastructure sizing')}</h2>
      <div class="note"><b>${T('Diqqət:', 'Note:')}</b> ${T('Bu hesabat <b>sintetik</b> məlumatla avtomatik yaradılıb və DD-02-nin 7 bölməsinin şablonunu göstərir. Real AYNA verilənləri ilə eyni bölmələr ölçülmüş rəqəmlərlə doldurulacaq.', 'This report is generated from <b>synthetic</b> data and demonstrates the 7-section DD-02 template. With real AYNA data the same sections are filled with measured figures.')}</div>
      <section class="card"><h3>1 · ${T('Məlumat mənbələri, əsas sahələr və strukturlar', 'Data sources, key fields and structures')}</h3>
        ${A.tableHTML(['source', 'key fields', 'granularity', 'update'], E.sources.map((s) => [s.name, s.key, s.granularity, s.freq]))}</section>
      <section class="card"><h3>2 · ${T('Həcm, əhatə, dənəvərlik, yenilənmə tezliyi', 'Volumes, time coverage, granularity, update frequency')}</h3>
        ${A.tableHTML(['source', 'records / day', 'coverage'], E.sources.map((s) => [s.name, s.records_day, s.coverage]))}
        <div class="grid2"><div><h3>${T('Validasiyalar saat üzrə (iş günü)', 'Validations by hour (weekday)')}</h3>${A.bar(netHour, { labels: netHour.map((_, i) => A.pad(i)), label: 'validations by hour' })}</div>
        <div><h3>${T('Dayanacaqlar şəhər üzrə', 'Stops by city')}</h3>${A.tableHTML(['city', 'stops'], Object.entries(byCity).sort((a, b) => b[1] - a[1]))}</div></div></section>
      <section class="card"><h3>3 · ${T('Əsas statistika və paylanmalar', 'Key statistics and distributions')}</h3>
        <div class="cards"><div class="c"><b>${A.fmt(S.total_validations_weekday)}</b><small>validations / weekday</small></div><div class="c"><b>${S.peak_hour}:00</b><small>network peak</small></div><div class="c"><b>${S.segments}</b><small>segments</small></div><div class="c"><b>${S.vehicles}</b><small>vehicles (est.)</small></div></div>
        <div class="grid2"><div><h3>${T('Dayanacaq üzrə gündəlik validasiya (histoqram)', 'Daily validations per stop (histogram)')}</h3>${A.bar(hist, { labels: ['<100', '<300', '<1k', '<3k', '<10k', '10k+'], label: 'stop histogram' })}</div>
        <div><h3>${T('08:00 seqment sürəti (km/s)', 'Segment speed at 08:00 (km/h)')}</h3>${A.bar(sh, { labels: ['<10', '<15', '<20', '<25', '<30', '<40', '<60', '60+'], color: '#e9a23b', label: 'speed histogram' })}</div></div></section>
      <section class="card"><h3>4 · ${T('Çatışmayan, təkrarlanan, uyğunsuz və anomal qeydlər', 'Missing, duplicate, inconsistent and anomalous records')}</h3>
        ${`<table class="t"><thead><tr><th>issue</th><th class="num">count</th><th class="num">share</th><th>severity</th><th>comment</th></tr></thead><tbody>${dq.map((r) => `<tr><td>${r[0]}</td><td class="num">${typeof r[1] === 'number' ? A.fmt(r[1]) : r[1]}</td><td class="num">${r[2]}</td><td><span class="badge ${r[3]}">${r[3] === 'bad' ? 'high' : 'medium'}</span></td><td>${r[4]}</td></tr>`).join('')}</tbody></table>`}
        <small>${T('Sintetik defektlər qəsdən əlavə edilib ki, hesabat şablonu işləsin.', 'Defects are injected on purpose so the report template has something to show.')}</small></section>
      <section class="card"><h3>5 · ${T('Mənbələri əlaqələndirmə variantları', 'Options for linking the sources')}</h3>
        ${A.tableHTML(['link', 'join key', 'approach', 'risk'], [
          ['AFC ↔ Registry', 'stop_id, route_id', T('Dəqiq açar', 'Exact key'), T('Köhnə dayanacaq ID-ləri', 'Stale stop IDs')],
          ['AFC ↔ AVL', 'vehicle_id + time ±60 s', T('Zaman pəncərəsi + ən yaxın GPS', 'Time window + nearest GPS fix'), T('Saat uyğunsuzluğu, terminal→nəqliyyat xəritəsi', 'Clock drift, terminal→vehicle map')],
          ['AFC ↔ Operational', 'trip_id (via vehicle + time)', T('Reys cədvəli ilə kəsişmə', 'Interval join against trip schedule'), T('Reyssiz validasiyalar ' + Q.validations_without_trip_pct + '%', 'Trip-less validations ' + Q.validations_without_trip_pct + '%')],
          ['AFC ↔ AFC (same card)', 'card_hash + day', T('Zəncirləmə (DT-04/05)', 'Chaining (DT-04/05)'), T('Tək validasiyalı kartlar', 'Single-validation cards')],
        ])}</section>
      <section class="card"><h3>6 · ${T('Diaqnostik alətlərə yararlılıq və məhdudiyyətlər', 'Suitability for the diagnostic tools and known limitations')}</h3>
        <table class="t"><thead><tr><th>tool</th><th>needs</th><th>verdict</th><th>limitations</th></tr></thead><tbody>${suit.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td><span class="badge ${r[2]}">${bd[r[2]]}</span></td><td>${r[3]}</td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h3>7 · ${T('Sonrakı mərhələlər üçün hazırlıq metodologiyası', 'Methodology recommendations for data preparation')}</h3><ul>
        <li>${T('Təkrarlanan validasiyaları (kart+dayanacaq, <60 san.) deduplikasiya edin; kartı yalnız HMAC-hash kimi saxlayın (SC-04).', 'Deduplicate validations (card + stop within 60 s); store cards only as keyed hashes (SC-04).')}</li>
        <li>${T('AVL–AFC saat sinxronizasiyası üçün hər nəqliyyat üzrə ofset təxmin edin.', 'Estimate a per-vehicle clock offset to align AVL and AFC.')}</li>
        <li>${T('Seqment sürətlərini median/IQR ilə saatlıq aqreqasiya edin, GPS boşluqlarını interpolyasiya etməyin.', 'Aggregate segment speeds hourly with median/IQR; do not interpolate GPS gaps.')}</li>
        <li>${T('Agent yalnız aqreqat cədvəllərə (bu MVP-dəki sxem) baxsın; xam axın heç vaxt modelə getməsin (AG-02).', 'Expose only aggregate tables (the schema in this MVP) to the agent; raw streams never reach the model (AG-02).')}</li>
        <li>${T('O/D üçün qəbul metodologiya üzrə: kalibrləmə nümunəsi (sorğu/APC) ilə yoxlama.', 'Accept O/D on methodology; validate against a calibration sample (survey / APC).')}</li></ul></section>
      <h2>${T('İnfrastrukturun ölçülməsi (DD-03) və əsaslandırma (DD-04)', 'Infrastructure sizing (DD-03) and justification (DD-04)')}</h2>
      <section class="card"><div class="form">
        ${[['val', 'Validations / day', 1500000], ['veh', 'Vehicles with AVL', 2600], ['ping', 'AVL ping interval (s)', 30], ['yrs', 'History kept (years)', 3], ['usr', 'Concurrent users', 40], ['qry', 'Agent queries / day', 1500]].map(([k, l, v]) => `<label class="f">${l}<input type="number" id="sz_${k}" value="${v}" min="1"></label>`).join('')}
        <label class="f">LLM size<select id="sz_llm"><option value="8">8B</option><option value="32" selected>32B</option><option value="70">70B</option></select></label></div>
        <div id="szOut"></div><div class="row2"><button id="szMd" class="pri">⬇ ${T('Texniki əsaslandırma (.md)', 'Technical justification (.md)')}</button></div>
        <small>${T('Düsturlar sadədir və Mərhələ 0-da ölçülmüş verilənlərlə əvəz olunmalıdır. Standart dəyərlər illüstrativdir.', 'Formulas are deliberately simple and must be replaced by measured values in Stage 0. Defaults are illustrative.')}</small></section>`;
    const calc = () => {
      const g = (k) => +$('sz_' + k).value || 0, llm = +$('sz_llm').value;
      const valRow = 120, avlRow = 80, comp = 3, idx = 1.5, rep = 2, bk = 2;
      const afcGB = (g('val') * 365 * g('yrs') * valRow) / 1e9, avlGB = (g('veh') * ((17 * 3600) / g('ping')) * 365 * g('yrs') * avlRow) / 1e9;
      const rawGB = (afcGB + avlGB) / comp * idx, totTB = (rawGB * rep * bk) / 1000;
      const ingest = (g('val') / 86400) * 6 + (g('veh') / g('ping')) , cores = Math.ceil(ingest / 5000) + Math.ceil(g('usr') * 0.6) + 16;
      const ram = Math.ceil(rawGB * 0.05 + 64 + g('usr') * 1.5), vram = llm * 1.0 * 1.25 + 8 + Math.ceil(g('qry') / 5000) * 8, gpus = Math.ceil(vram / 80);
      const out = { afcGB, avlGB, totTB, cores, ram, vram, gpus, ingest };
      $('szOut').innerHTML = `<div class="cards"><div class="c"><b>${totTB.toFixed(1)} TB</b><small>storage (replicated + backup)</small></div><div class="c"><b>${cores}</b><small>vCPU</small></div><div class="c"><b>${ram} GB</b><small>RAM</small></div><div class="c"><b>${gpus}× 80 GB</b><small>GPU (${Math.round(vram)} GB VRAM)</small></div></div>
        <small>AFC ${afcGB.toFixed(0)} GB + AVL ${avlGB.toFixed(0)} GB raw → ÷${comp} compression ×${idx} index; ×${rep} replication ×${bk} backups. Ingest ≈ ${ingest.toFixed(0)} events/s peak.</small>`;
      return out;
    };
    document.querySelectorAll('#edaBody input,#edaBody select').forEach((e) => (e.oninput = calc)); calc();
    $('szMd').onclick = () => {
      const o = calc(), g = (k) => $('sz_' + k).value;
      A.download('infrastructure_justification.md', `# Infrastructure justification (DRAFT – synthetic inputs)\n\n## Inputs\n- Validations/day: ${g('val')}\n- Vehicles: ${g('veh')}\n- AVL interval: ${g('ping')} s\n- History: ${g('yrs')} years\n- Concurrent users: ${g('usr')}\n- Agent queries/day: ${g('qry')}\n- LLM: ${$('sz_llm').value}B parameters (8-bit)\n\n## Result\n| Resource | Value |\n|---|---|\n| Storage | ${o.totTB.toFixed(1)} TB |\n| vCPU | ${o.cores} |\n| RAM | ${o.ram} GB |\n| GPU | ${o.gpus} × 80 GB (${Math.round(o.vram)} GB VRAM) |\n\n## Method\nAFC row 120 B, AVL row 80 B, 3× compression, 1.5× index overhead, 2× replication, 2× backup. CPU = ingest/5000 + 0.6/user + 16 base. VRAM = params × 1.25 + 8 GB KV/runtime per 5000 queries/day.\n\n_To be replaced with measured values from the Stage 0 EDA._\n`, 'text/markdown');
    };
  }

  /* ============================================================ Audit */
  function audit() {
    const log = A.audit.all().slice().reverse(), v = A.audit.verify();
    const roles = Object.keys(A.ROLE_TABLES), tbl = A.ROLE_TABLES.analyst;
    $('auditBody').innerHTML = `
      <h2>${T('Audit jurnalı və təhlükəsizlik', 'Audit log and security')}</h2>
      <div class="grid2">
      <section class="card"><h3>SC-01 · ${T('AYNA kimlik sistemi (simulyasiya)', 'AYNA identity (simulated)')}</h3>
        <p>${T('Daxil olmuş istifadəçi', 'Signed-in user')}: <b>${A.esc(A.user.name)}</b><br><code>${A.esc(A.user.id)}</code> · ${T('rol', 'role')}: <span class="badge ok">${A.user.role}</span></p>
        <small>${T('Real layihədə autentifikasiya AYNA SSO (OIDC/SAML) ilə aparılır; yuxarıdakı seçici yalnız demodur.', 'In production, authentication goes through AYNA SSO (OIDC/SAML); the selector in the header is a demo stand-in.')}</small></section>
      <section class="card"><h3>SC-04 · ${T('PII maskalanması', 'PII masking')}</h3>
        <ul><li>${T('Kart ID-ləri bu tətbiqə heç vaxt daxil edilmir — yalnız aqreqat cədvəllər yüklənir.', 'Card IDs never enter this app — only aggregate tables are loaded.')}</li>
        <li>${T('Hüceyrə < k olduqda maskalanır', 'Cells below k are masked')}: k = <b>${A.kFor(A.user.role)}</b> (${T('rol', 'role')} ${A.user.role}).</li>
        <li>${T('Canlı lentdə kart “••••” kimi göstərilir.', 'The live ticker shows the card as “••••”.')}</li></ul>
        <small>${T('k həddi və kimin parçalanmış məlumat görə biləcəyi — AYNA ilə açıq məsələdir.', 'The threshold k and who may see disaggregated data are open items with AYNA.')}</small></section></div>
      <section class="card"><h3>SC-02 · RBAC (${T('rol → cədvəl icazələri', 'role → table permissions')})</h3>
        <div style="overflow:auto"><table class="t"><thead><tr><th>table</th>${roles.map((r) => `<th>${r}</th>`).join('')}</tr></thead><tbody>${tbl.map((t) => `<tr><td>${t}</td>${roles.map((r) => `<td>${A.ROLE_TABLES[r].includes(t) ? '✔' : '<span style="color:#c8394a">✖</span>'}</td>`).join('')}</tr>`).join('')}${['stops', 'routes', 'route_stops', 'route_hour', 'stop_hour', 'route_overlap', 'route_diag'].length ? '' : ''}</tbody></table></div>
        <small>${T('Rol siyahısı müvəqqətidir (tələb mətni natamamdır).', 'Role list is a placeholder (the source requirement is incomplete).')}</small></section>
      <section class="card"><h3>SC-03 · ${T('Dəyişməz audit jurnalı', 'Immutable audit log')} <span class="badge ${v.ok ? 'ok' : 'bad'}">${v.ok ? T('zəncir bütövdür', 'chain intact') : T('DƏYİŞİKLİK aşkarlandı #', 'TAMPERING detected at #') + v.at}</span> <small>${v.total} ${T('qeyd', 'entries')}</small></h3>
        <div class="row2"><button id="auVerify">${T('Zənciri yoxla', 'Verify chain')}</button><button id="auTamper">${T('Pozuntu simulyasiyası', 'Simulate tampering')}</button><button id="auExport">⬇ JSON</button><button id="auClear">${T('Təmizlə (demo)', 'Clear (demo)')}</button></div>
        <div style="max-height:380px;overflow:auto">${log.length ? `<table class="t"><thead><tr><th>#</th><th>timestamp (UTC)</th><th>user</th><th>status</th><th>question</th><th>hash</th></tr></thead><tbody>${log.map((e) => `<tr><td>${e.seq}</td><td>${e.ts}</td><td>${A.esc(e.user_id)}</td><td><span class="badge ${e.status === 'OK' ? 'ok' : 'bad'}">${e.status}</span></td><td title="${A.esc(e.sql)}\n→ ${A.esc(e.response)}">${A.esc(e.question)}</td><td><code>${e.hash.slice(0, 10)}…</code></td></tr>`).join('')}</tbody></table>` : `<p><small>${T('Hələ qeyd yoxdur — Agent bölməsində sual verin.', 'No entries yet — ask something in the Agent tab.')}</small></p>`}</div>
        <div class="note">${T('Hər qeyd əvvəlki qeydin SHA-256 hash-ini daşıyır. Statik səhifə yalnız brauzerdə saxlayır; real həllə server tərəfdə WORM saxlama və saxlama müddəti (açıq məsələ) lazımdır.', 'Each entry carries the previous entry\'s SHA-256, so edits are detectable. A static page only stores in the browser; production needs server-side WORM storage and a retention policy (open item).')}</div></section>`;
    $('auVerify').onclick = audit; $('auTamper').onclick = () => { A.audit.tamper(); audit(); };
    $('auClear').onclick = () => { A.audit.clear(); audit(); };
    $('auExport').onclick = () => A.download('audit_log.json', JSON.stringify(A.audit.all(), null, 2), 'application/json');
  }

  /* ======================================================== Requirements */
  const REQ = [
    ['DD-01', 'EDA on AFC/AVL/registry/operational', 'sim', 'Stage 0 tab (synthetic data)'], ['DD-02', 'EDA report sections 1–7', 'sim', 'Stage 0 tab'],
    ['DD-03', 'Infrastructure sizing from measured data', 'sim', 'Sizing calculator (illustrative inputs)'], ['DD-04', 'Technical justification for AzInTelecom', 'sim', 'Markdown export'],
    ['UI-01', 'UI design & brand book', 'open', 'Draft palette below; source text incomplete'], ['UI-02', 'Final UX', 'open', 'Needs customer review'], ['UI-03', 'User interface', 'mvp', 'This static app'],
    ['AG-01', 'Azerbaijani + English questions', 'mvp', 'Agent tab (AZ/EN, rule-based parser)'], ['AG-02', 'Text-to-SQL, aggregated results only', 'mvp', 'Real SQL on in-browser SQLite; ≤50 aggregated rows to the "model"'],
    ['AG-03', 'Map object → chat parameter', 'mvp', 'Click stop/route/segment → "Ask the agent"'],
    ['DT-01', 'Travel time & slow zones', 'mvp', 'Map tab · DT-01'], ['DT-02', 'Utilization / occupancy', 'mvp', 'Map tab · DT-02'], ['DT-03', 'Demand concentration (clustering)', 'mvp', 'Map tab · DT-03'],
    ['DT-04', 'Route diagnostics & transfers', 'mvp', 'Map tab · DT-04'], ['DT-05', 'O/D reconstruction', 'mvp', 'Map tab · DT-05 (chaining on synthetic cards)'],
    ['SC-01', 'AYNA identity integration', 'sim', 'User selector stands in for SSO'], ['SC-02', 'RBAC', 'sim', 'Role → table permissions (placeholder roles)'],
    ['SC-03', 'Immutable audit log', 'sim', 'Hash-chained log in browser storage'], ['SC-04', 'PII masking / aggregation', 'mvp', 'No card IDs shipped; small-cell masking'],
  ];
  const ST = { mvp: ['ok', 'Working in MVP'], sim: ['warn', 'Simulated / demo'], open: ['bad', 'Open / needs input'] };
  function req() {
    $('reqBody').innerHTML = `<h2>${T('Tələblərin izlənməsi', 'Requirements traceability')}</h2>
      <section class="card"><table class="t"><thead><tr><th>ID</th><th>requirement</th><th>MVP status</th><th>where</th></tr></thead><tbody>${REQ.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td><span class="badge ${ST[r[2]][0]}">${ST[r[2]][1]}</span></td><td>${r[3]}</td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h3>${T('AYNA ilə açıq məsələlər', 'Open items to clarify with AYNA')}</h3><ul>
        <li>UI-01: brand book full text</li><li>AG-03: map parameter full text</li><li>SC-02: RBAC text and role list</li><li>AG-01/02: acceptance criteria and AZ Text-to-SQL test question set</li><li>SC-03: audit retention and tamper-proofing</li><li>SC-04: aggregation threshold (MVP uses k=${A.K}) and roles allowed to see disaggregated data</li></ul></section>
      <section class="card"><h3>${T('Marka palitrası (qaralama)', 'Brand palette (draft)')}</h3><div class="row2">${[['#0b7a75', 'Brand'], ['#075b57', 'Brand dark'], ['#d9f0ee', 'Brand light'], ['#e9a23b', 'Accent'], ['#c8394a', 'Alert'], ['#16252b', 'Ink']].map(([c, n]) => `<div style="text-align:center"><div style="background:${c};width:72px;height:44px;border-radius:8px"></div><small>${n}<br>${c}</small></div>`).join('')}</div>
        <small>${T('Real brend kitabı gələnə qədər müvəqqətidir.', 'Placeholder until the real brand book is supplied.')}</small></section>
      <section class="card"><h3>${T('Məlumat mənbələri və lisenziyalar', 'Data sources and licences')}</h3><ul>
        <li>Azerbaijan outline: Natural Earth (public domain).</li><li>Leaflet 1.9.4 (BSD-2), sql.js 1.10.3 (MIT) vendored in <code>vendor/</code>; online basemap tiles © OpenStreetMap contributors (optional).</li>
        <li>Video clips: OpenCV sample/test footage ("vtest") and a public highway-traffic clip from the OpenCV_3_Car_Counting repository; used for demonstration only — confirm licence terms before any public release and replace with AYNA-owned footage.</li></ul></section>`;
  }

  A.renderDoc = (v) => ({ eda, audit, req })[v]?.();
})();
