/* AG-01..03 conversational agent (demo).
   A rule-based parser stands in for the LLM: it turns an Azerbaijani / English question into a SQL query,
   runs it against the in-browser analytical DB, and summarises ONLY the aggregated result rows.
   Swap `interpret()` for an LLM call later; the guardrails (runSQL, mask, audit) stay the same. */
(function () {
  const CITY = { baki: 'Baku', baku: 'Baku', gence: 'Ganja', ganja: 'Ganja', sumqayit: 'Sumgait', sumgait: 'Sumgait', naxcivan: 'Nakhchivan', nakhchivan: 'Nakhchivan',
    mingecevir: 'Mingachevir', mingachevir: 'Mingachevir', seki: 'Sheki', sheki: 'Sheki', lenkeran: 'Lankaran', lankaran: 'Lankaran', quba: 'Quba', samaxi: 'Shamakhi', shamakhi: 'Shamakhi', sirvan: 'Shirvan', shirvan: 'Shirvan', qebele: 'Gabala', gabala: 'Gabala' };
  const has = (n, re) => re.test(n);

  function slots(q, n) {
    const s = { n: 5, hour: null, day: /heftesonu|hefte sonu|weekend|bazar/.test(n) ? 'weekend' : 'weekday', route: null, stops: [], city: null, zones: [] };
    const num = n.match(/(?:\btop\b|\bilk\b|\ben\b)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:en\b|top\b|ilk\b|marsrut|route|dayacaq|stop|segment)/);
    if (num) s.n = Math.min(20, +(num[1] || num[2]));
    let m;
    if ((m = n.match(/\bsaat\s*(\d{1,2})\b|\b(\d{1,2})[:.]00\b|\b(?:at|saat)\s*(\d{1,2})\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/))) {
      let h = +(m[1] || m[2] || m[3] || m[5]); const ap = m[4] || m[6];
      if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
      if (h >= 0 && h <= 23) s.hour = h;
    } else if (has(n, /seher|morning|rush.?hour|sabah/)) s.hour = 8;
    else if (has(n, /axsam|evening/)) s.hour = 18;
    else if (has(n, /gunorta|noon|midday/)) s.hour = 13;
    else if (has(n, /gece|night/)) s.hour = 23;
    if ((m = n.match(/\b([bgin]\d{1,2})\b/))) s.route = m[1].toUpperCase();
    for (const k of Object.keys(CITY)) if (n.includes(k)) { s.city = CITY[k]; break; }
    // stop mentions: longest hub names first
    Object.values(A.stops).filter((x) => x.is_hub).sort((a, b) => b.name.length - a.name.length).forEach((st) => {
      const nm = A.norm(st.name);
      if (n.includes(nm) && !s.stops.some((x) => A.norm(A.stops[x].name).includes(nm))) s.stops.push(st.stop_id);
    });
    s.stops.sort((a, b) => n.indexOf(A.norm(A.stops[a].name)) - n.indexOf(A.norm(A.stops[b].name)));
    Object.keys(A.D.meta.zones).forEach((z) => { if (n.includes(A.norm(z))) s.zones.push(z); });
    // AG-03: map selection as parameter
    const deictic = has(n, /\bbu\b|\bbunun\b|secilmis|selected|\bthis\b|\bit\b|haqqinda|about/);
    if (A.sel && (deictic || (!s.route && !s.stops.length))) {
      if (A.sel.type === 'route' && !s.route) s.route = A.sel.id;
      if (A.sel.type === 'stop' && !s.stops.length) s.stops = [A.sel.id];
      s.sel = A.sel;
    }
    return s;
  }

  const L = (az, en) => (A.lang === 'az' ? az : en);
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

  function interpret(text) {
    const n = A.norm(text), s = slots(text, n);
    const hr = s.hour, dt = s.day;
    // contextual selection first
    if (s.sel && has(n, /\bbu\b|secilmis|selected|\bthis\b|haqqinda|about|profil|profile/) && !has(n, /yavas|slow|transfer|kocur|overlap|ortus|od\b/)) {
      if (s.sel.type === 'stop') return { intent: 'stop_profile', s, sql: `SELECT hour, validations FROM stop_hour WHERE stop_id=${q(s.sel.id)} ORDER BY hour` };
      if (s.sel.type === 'route') return { intent: 'route_profile', s, sql: `SELECT hour, trips, validations, load_ratio FROM route_hour WHERE route_id=${q(s.sel.id)} AND day_type=${q(dt)} ORDER BY hour` };
      if (s.sel.type === 'segment') return { intent: 'seg_profile', s, sql: `SELECT hour, speed_kmh, travel_min, delay_idx FROM segment_hour WHERE seg_id=${q(s.sel.id)} ORDER BY hour` };
    }
    if (has(n, /transfer|kocur|aktar|qosul/))
      return { intent: 'transfers', s, sql: `SELECT s.name, s.city, t.transfers_est FROM transfers t JOIN stops s USING(stop_id) ORDER BY t.transfers_est DESC LIMIT ${s.n}` };
    if (has(n, /\bo\/?d\b|mense|teyinat|origin|destination|matris|matrix|haradan|where do/))
      return { intent: 'od', s, sql: `SELECT origin_zone, dest_zone, trips_est FROM od_zone${s.zones.length ? ` WHERE origin_zone=${q(s.zones[0])}` : ''} ORDER BY trips_est DESC LIMIT ${s.n}` };
    if (has(n, /geri qayit|backtrack|dolayi|circuit|tekrar|loop/))
      return { intent: 'backtrack', s, sql: `SELECT d.route_id, r.name, d.length_km, d.displacement_km, d.circuity, d.backtrack_km FROM route_diag d JOIN routes r USING(route_id) ORDER BY d.backtrack_km DESC LIMIT ${s.n}` };
    if (has(n, /ust-uste|ustuste|ortus|overlap|duplic|paralel|eyni yol/))
      return { intent: 'overlap', s, sql: `SELECT route_a, route_b, shared_km, overlap_pct FROM route_overlap ORDER BY overlap_pct DESC LIMIT ${s.n}` };
    const twoStops = s.stops.length >= 2;
    if (has(n, /muddet|travel time|duration|nece deqiqe|how long|how many minutes|yol vaxti|sefer vaxti/) || (twoStops && has(n, /arasi|between|from|dan\b|den\b/))) {
      if (twoStops) {
        const [a, b] = s.stops;
        for (const rid of s.route ? [s.route] : Object.keys(A.routeStops)) {
          const seq = A.routeStops[rid], i = seq.indexOf(a), j = seq.indexOf(b);
          if (i >= 0 && j >= 0) {
            const lo = Math.min(i, j) + 1, hi = Math.max(i, j) + 1;
            return { intent: 'travel_pair', s: { ...s, route: rid }, sql: `SELECT sh.hour, ROUND(SUM(sh.travel_min),1) AS minutes FROM segments sg JOIN segment_hour sh USING(seg_id) WHERE sg.route_id=${q(rid)} AND sg.seq>=${lo} AND sg.seq<${hi} GROUP BY sh.hour ORDER BY sh.hour` };
          }
        }
        return { intent: 'travel_nopair', s, sql: null };
      }
      if (s.route) return { intent: 'travel_route', s, sql: `SELECT sh.hour, ROUND(SUM(sh.travel_min),1) AS minutes FROM segments sg JOIN segment_hour sh USING(seg_id) WHERE sg.route_id=${q(s.route)} GROUP BY sh.hour ORDER BY sh.hour` };
    }
    if (has(n, /yavas|slow|gecik|delay|tixac|congest|sur[e]t|speed|slow zone/)) {
      return hr == null
        ? { intent: 'slow_all', s, sql: `SELECT sg.seg_id, sg.route_id, f.name AS from_stop, t.name AS to_stop, sg.slow_hours, sg.free_speed_kmh FROM segments sg JOIN stops f ON f.stop_id=sg.from_stop JOIN stops t ON t.stop_id=sg.to_stop ORDER BY sg.slow_hours DESC, sg.dist_km DESC LIMIT ${s.n}` }
        : { intent: 'slow_hour', s, sql: `SELECT sg.seg_id, sg.route_id, f.name AS from_stop, t.name AS to_stop, sh.speed_kmh, sh.delay_idx FROM segment_hour sh JOIN segments sg USING(seg_id) JOIN stops f ON f.stop_id=sg.from_stop JOIN stops t ON t.stop_id=sg.to_stop WHERE sh.hour=${hr} ORDER BY sh.delay_idx DESC LIMIT ${s.n}` };
    }
    if (has(n, /pik|peak|rush|busiest hour|en sixliq saat/) && !has(n, /dayacaq|stop/))
      return { intent: 'peak', s, sql: `SELECT hour, SUM(validations) AS validations FROM route_hour WHERE day_type=${q(dt)}${s.route ? ` AND route_id=${q(s.route)}` : ''} GROUP BY hour ORDER BY validations DESC LIMIT 3` };
    if (has(n, /yuklen|overload|capacity|tutum|dolu|crowd|ratio|utiliz|istifade/)) {
      if (s.route) return { intent: 'route_profile', s, sql: `SELECT hour, trips, validations, load_ratio FROM route_hour WHERE route_id=${q(s.route)} AND day_type=${q(dt)} ORDER BY hour` };
      return hr == null
        ? { intent: 'overload', s, sql: `SELECT r.route_id, r.name, ROUND(MAX(rh.load_ratio),2) AS peak_load_ratio, rh.hour AS peak_hour FROM route_hour rh JOIN routes r USING(route_id) WHERE rh.day_type=${q(dt)} AND rh.load_ratio IS NOT NULL GROUP BY r.route_id ORDER BY peak_load_ratio DESC LIMIT ${s.n}` }
        : { intent: 'overload_h', s, sql: `SELECT r.route_id, r.name, ROUND(rh.load_ratio,2) AS load_ratio, rh.validations, rh.capacity_total FROM route_hour rh JOIN routes r USING(route_id) WHERE rh.day_type=${q(dt)} AND rh.hour=${hr} AND rh.load_ratio IS NOT NULL ORDER BY rh.load_ratio DESC LIMIT ${s.n}` };
    }
    if (has(n, /dayacaq|stop|station|talab|demand|validasiya|validation|sernisin|passenger|busiest|klaster|cluster|konsentr/)) {
      if (s.stops.length === 1 && !has(n, /en cox|top|busiest|most/))
        return { intent: 'stop_profile', s, sql: `SELECT hour, validations FROM stop_hour WHERE stop_id=${q(s.stops[0])} ORDER BY hour` };
      return { intent: 'stops', s, sql: `SELECT s.stop_id, s.name, s.city, SUM(sh.validations) AS validations FROM stop_hour sh JOIN stops s USING(stop_id) WHERE 1=1${hr != null ? ` AND sh.hour=${hr}` : ''}${s.city ? ` AND s.city=${q(s.city)}` : ''} GROUP BY s.stop_id ORDER BY validations DESC LIMIT ${s.n}` };
    }
    if (has(n, /nece|how many|sayi|count|siyahi|list|marsrut|route/)) {
      if (has(n, /dayacaq|stop/)) return { intent: 'count_stops', s, sql: `SELECT city, COUNT(*) AS stops FROM stops GROUP BY city ORDER BY stops DESC` };
      return { intent: 'count_routes', s, sql: `SELECT city, COUNT(*) AS routes, SUM(vehicle_capacity>0) AS with_capacity FROM routes GROUP BY city ORDER BY routes DESC` };
    }
    return { intent: 'unknown', s, sql: null };
  }

  /* ------------------------------------------------------ summaries (only from aggregated rows) */
  function summarize(it, cols, rows) {
    const c = (name) => cols.indexOf(name), r0 = rows[0], H = (h) => A.hh(h);
    if (!rows.length) return L('Bu sorğu üzrə nəticə tapılmadı.', 'No results for this query.');
    const hrEn = it.s.hour != null ? ` at ${H(it.s.hour)}` : '', hrAz = it.s.hour != null ? `${H(it.s.hour)} saatında` : 'Ümumilikdə';
    switch (it.intent) {
      case 'overload': { const over = rows.filter((r) => r[c('peak_load_ratio')] >= 1).length;
        return L(`Ən yüklənmiş marşrut ${r0[1]} (${r0[0]}) — pik yüklənmə əmsalı ${r0[2]}, saat ${H(r0[3])}. Siyahıdakı ${rows.length} marşrutdan ${over}-nin əmsalı 1.0-dan yuxarıdır (tələb tutumu aşır).`,
          `Most loaded route: ${r0[1]} (${r0[0]}) — peak demand/capacity ${r0[2]} at ${H(r0[3])}. ${over} of the ${rows.length} listed routes exceed 1.0 (demand above capacity).`); }
      case 'overload_h':
        return L(`${hrAz} ən yüklü marşrut ${r0[1]} (${r0[0]}): əmsal ${r0[2]}.`, `Most loaded route${hrEn}: ${r0[1]} (${r0[0]}), ratio ${r0[2]}.`);
      case 'stops':
        return L(`${hrAz} ən çox validasiya olan dayanacaq: ${r0[1]} (${r0[2]}) — ${A.fmt(r0[3])} validasiya. Siyahıda ${rows.length} dayanacaq var.`, `Busiest stop${hrEn}: ${r0[1]} (${r0[2]}) with ${A.fmt(r0[3])} validations. ${rows.length} stops listed.`);
      case 'stop_profile': { const v = rows.map((r) => r[1]), mx = Math.max(...v), h = v.indexOf(mx), tot = v.reduce((a, b) => a + b, 0);
        return L(`${A.stops[it.s.stops[0] || it.s.sel?.id]?.name || 'Dayanacaq'}: gün ərzində ${A.fmt(tot)} validasiya, pik saat ${H(h)} (${A.fmt(mx)}).`, `${A.stops[it.s.stops[0] || it.s.sel?.id]?.name || 'Stop'}: ${A.fmt(tot)} validations per day, peak at ${H(h)} (${A.fmt(mx)}).`); }
      case 'route_profile': { const lr = rows.map((r) => r[3] ?? 0), mx = Math.max(...lr), h = lr.indexOf(mx);
        return L(`Marşrut ${it.s.route || it.s.sel?.id}: pik yüklənmə əmsalı ${mx.toFixed(2)} (${H(h)}). ${mx >= 1 ? 'Pik saatda tələb tutumu aşır.' : 'Tutum pik saatda da kifayətdir.'}`, `Route ${it.s.route || it.s.sel?.id}: peak demand/capacity ${mx.toFixed(2)} at ${H(h)}. ${mx >= 1 ? 'Demand exceeds capacity in the peak.' : 'Capacity holds even in the peak.'}`); }
      case 'seg_profile': { const sp = rows.map((r) => r[1]), mn = Math.min(...sp), h = sp.indexOf(mn);
        return L(`Seçilmiş seqmentdə ən aşağı sürət ${mn} km/s (${H(h)}); serbest axın sürətindən ${rows[h][3]}× yavaş.`, `Slowest on this segment: ${mn} km/h at ${H(h)}, ${rows[h][3]}× slower than free flow.`); }
      case 'slow_all':
        return L(`Ən davamlı yavaş seqment: ${r0[2]} → ${r0[3]} (${r0[1]}) — gündə ${r0[4]} saat sərbəst axın sürətinin 75%-dən aşağıdır.`, `Most persistently slow segment: ${r0[2]} → ${r0[3]} (${r0[1]}) — below 75% of free-flow speed for ${r0[4]} hours a day.`);
      case 'slow_hour':
        return L(`${hrAz} ən yavaş seqment: ${r0[2]} → ${r0[3]} (${r0[1]}), ${r0[4]} km/s (gecikmə indeksi ${r0[5]}).`, `Slowest segment${hrEn}: ${r0[2]} → ${r0[3]} (${r0[1]}) at ${r0[4]} km/h (delay index ${r0[5]}).`);
      case 'travel_pair': case 'travel_route': { const mn = rows.map((r) => r[1]), lo = Math.min(...mn), hi = Math.max(...mn), hh = mn.indexOf(hi);
        const pair = it.intent === 'travel_pair' ? `${A.stops[it.s.stops[0]].name} → ${A.stops[it.s.stops[1]].name} (${it.s.route})` : `${it.s.route}`;
        return L(`${pair}: səyahət vaxtı ${lo}–${hi} dəq; ən uzun ${H(hh)} saatında.`, `${pair}: travel time ${lo}–${hi} min; longest at ${H(hh)}.`); }
      case 'transfers': return L(`Ən böyük köçürmə nöqtəsi: ${r0[0]} (${r0[1]}), təxminən ${A.fmt(r0[2])} köçürmə/gün. Ümumi köçürmə payı: ${A.D.eda.chaining.avg_transfers} köçürmə/səfər.`, `Top transfer hotspot: ${r0[0]} (${r0[1]}), ≈${A.fmt(r0[2])} transfers/day. Network average: ${A.D.eda.chaining.avg_transfers} transfers per journey.`);
      case 'od': return L(`Ən güclü axın: ${r0[0]} → ${r0[1]}, təxminən ${A.fmt(r0[2])} səfər/gün (kartın növbəti minişinə əsasən qiymətləndirmə).`, `Strongest flow: ${r0[0]} → ${r0[1]}, ≈${A.fmt(r0[2])} trips/day (estimated from each card's next boarding).`);
      case 'overlap': return L(`Ən çox üst-üstə düşən marşrutlar: ${r0[0]} və ${r0[1]} — ümumi ${r0[2]} km (${r0[3]}%).`, `Most overlapping routes: ${r0[0]} and ${r0[1]} share ${r0[2]} km (${r0[3]}% of the shorter route).`);
      case 'backtrack': return L(`Ən çox geri qayıdan marşrut: ${r0[0]} (${r0[1]}) — dolaylılıq əmsalı ${r0[4]}, geri istiqamətdə ${r0[5]} km.`, `Most backtracking route: ${r0[0]} (${r0[1]}) — circuity ${r0[4]}, ${r0[5]} km against the main direction.`);
      case 'peak': return L(`Pik saat: ${H(r0[0])} (${A.fmt(r0[1])} validasiya). Növbəti: ${rows.slice(1).map((r) => H(r[0])).join(', ')}.`, `Peak hour: ${H(r0[0])} (${A.fmt(r0[1])} validations). Next: ${rows.slice(1).map((r) => H(r[0])).join(', ')}.`);
      case 'count_stops': case 'count_routes': return L(`Cəmi ${rows.reduce((a, r) => a + r[1], 0)} ${it.intent === 'count_stops' ? 'dayacaq' : 'marşrut'}; ən çoxu ${r0[0]} üzrə (${r0[1]}).`, `${rows.reduce((a, r) => a + r[1], 0)} ${it.intent === 'count_stops' ? 'stops' : 'routes'} in total; most in ${r0[0]} (${r0[1]}).`);
    }
    return '';
  }

  const EX = {
    az: ['Ən çox yüklənən 5 marşrut hansılardır?', 'Saat 8-də ən yavaş seqmentlər hansılardır?', 'Ən çox validasiya olan dayanacaqlar', 'Narimanov ilə Ulduz arasında səyahət müddəti nə qədərdir?', 'B2 marşrutunun yüklənməsi', 'Ən böyük köçürmə nöqtələri', 'Ən güclü mənşə-təyinat axınları', 'Hansı marşrutlar üst-üstə düşür?', 'Pik saat nə vaxtdır?', 'Bu obyekt haqqında məlumat ver'],
    en: ['Which 5 routes are most overloaded?', 'Slowest segments at 8am', 'Busiest stops in Baku', 'Travel time between Narimanov and Ulduz', 'Load of route B5', 'Top transfer hotspots', 'Strongest origin-destination flows', 'Which routes overlap?', 'What is the peak hour?', 'Tell me about the selected object'],
  };

  /* ------------------------------------------------------ chat UI */
  let busy = false;
  function addMsg(cls, html) {
    const el = document.createElement('div'); el.className = 'm ' + cls; el.innerHTML = html;
    const box = document.getElementById('msgs'); box.appendChild(el); box.scrollTop = box.scrollHeight; return el;
  }
  async function ask(text) {
    text = text.trim(); if (!text || busy) return; busy = true;
    addMsg('u', A.esc(text));
    const it = interpret(text), role = A.user.role;
    let html, status = 'OK', resp = '', sqlShown = it.sql;
    try {
      if (!it.sql) {
        status = 'NO_INTENT';
        resp = it.intent === 'travel_nopair'
          ? L('Bu iki dayanacaq eyni marşrutda deyil. Marşrut kodunu (məs., B1) göstərin.', 'These two stops are not on one route. Please name a route (e.g. B1).')
          : L('Sualı SQL-ə çevirə bilmədim. Nümunələrdən birini yoxlayın (marşrut yüklənməsi, yavaş seqmentlər, dayanacaq tələbi, köçürmələr, O/D, səyahət müddəti).', 'I could not turn that into SQL. Try an example (route load, slow segments, stop demand, transfers, O/D, travel time).');
        html = A.esc(resp);
      } else {
        const res = await A.runSQL(it.sql, role);
        const shown = res.rows.slice(0, 50), mk = A.mask(res.cols, shown, role);
        const summary = summarize(it, res.cols, res.rows);
        resp = summary;
        const hourly = res.cols[0] === 'hour' && res.cols.length >= 2;
        const chart = hourly ? A.bar(res.rows.map((r) => r[res.cols.length > 3 && res.cols[3] === 'load_ratio' ? 3 : 1]), { labels: res.rows.map((r) => A.pad(r[0])), ref: it.intent === 'route_profile' ? 1 : null, refLabel: '1.0', label: res.cols[1] }) : '';
        html = `<div>${A.esc(summary)}</div>${chart}<details open><summary>${A.t('sql_label')} · ${res.rows.length} ${L('sətir', 'rows')}</summary><pre>${A.esc(it.sql)}</pre><div class="tw">${A.tableHTML(res.cols, mk.rows)}</div></details>` +
          `<div class="meta">${A.t('rows_to_model')}: ${shown.length} (${L('aqreqasiya olunmuş', 'aggregated')})${mk.masked ? ` · ${mk.masked} ${L('kiçik hüceyrə maskalandı', 'small cells masked')} (k=${A.kFor(role)})` : ''} · ${L('rol', 'role')}: ${role}</div>`;
      }
    } catch (e) {
      status = e.code || 'ERROR'; resp = e.msg || String(e);
      html = `<span class="badge bad">${A.t('denied')}</span> ${A.esc(resp)}`;
    }
    addMsg('a', html);
    A.audit.append('chat', text, sqlShown, resp, status);
    busy = false;
  }
  A.ask = ask;

  function renderSel() {
    const chip = document.getElementById('ctxChip');
    chip.hidden = !A.sel;
    if (A.sel) { chip.innerHTML = `📍 ${A.t('selected')}: <b>${A.esc(A.selLabel(A.sel))}</b> <button type="button" id="ctxClear">${A.t('clear')}</button>`; document.getElementById('ctxClear').onclick = () => A.select(null); }
  }
  function renderExamples() {
    const b = document.getElementById('examples');
    b.innerHTML = EX[A.lang].map((x) => `<button type="button">${A.esc(x)}</button>`).join('');
    b.querySelectorAll('button').forEach((el) => (el.onclick = () => ask(el.textContent)));
  }
  A.initAgent = () => {
    document.getElementById('chatForm').onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('chatInput'); ask(i.value); i.value = ''; };
    document.getElementById('schemaBox').innerHTML = Object.entries(A.schema).map(([t, c]) => `<div><b>${t}</b>(${c.join(', ')})</div>`).join('');
    renderExamples(); renderSel();
    A.on('select', renderSel);
    A.on('lang', () => { renderExamples(); renderSel(); });
    addMsg('a', L('Salam! Şəbəkə haqqında Azərbaycan və ya ingilis dilində sual verin. Xəritədə bir dayanacaq/marşrut/seqment seçib “Agentdən soruş” düyməsini də basa bilərsiniz.', 'Hello! Ask about the network in Azerbaijani or English. You can also pick a stop/route/segment on the map and press “Ask the agent”.'));
  };
})();
