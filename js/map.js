/* Map of Azerbaijan + the five diagnostic tools (DT-01..DT-05) + object selection (AG-03) */
(function () {
  let map, base, toolLayer, stopLayer, routeLayer, tiles, tool = 'overview';
  const stopMarkers = {}, routeLines = {};
  const AZ_BOUNDS = [[38.35, 44.7], [41.95, 50.95]], BAKU = [[40.25, 49.6], [40.65, 50.25]];
  const MAJOR = ['Baku', 'Ganja', 'Sumgait', 'Nakhchivan', 'Lankaran', 'Sheki', 'Quba', 'Mingachevir', 'Shamakhi', 'Gabala', 'Shirvan', 'Salyan', 'Yevlakh'];
  const $ = (id) => document.getElementById(id);
  const wd = () => A.routeHour.weekday;

  /* ------------------------------------------------------------ init */
  function initMap() {
    map = L.map('map', { zoomControl: true, minZoom: 5, maxZoom: 17, preferCanvas: true }).fitBounds(AZ_BOUNDS);
    A.map = map;
    // offline basemap: Azerbaijan outline (Natural Earth, public domain) – always drawn, works without internet
    L.geoJSON(window.AZ_GEO, { style: { color: '#0b7a75', weight: 1.5, fillColor: '#eaf4f3', fillOpacity: 1 }, interactive: false }).addTo(map);
    tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap contributors', opacity: 0.85 });
    let errs = 0;
    tiles.on('tileerror', () => { if (++errs === 4) { $('chkTiles').checked = false; map.removeLayer(tiles); } });
    tiles.addTo(map);
    $('chkTiles').onchange = (e) => (e.target.checked ? (errs = 0, tiles.addTo(map)) : map.removeLayer(tiles));
    routeLayer = L.layerGroup().addTo(map);
    toolLayer = L.layerGroup().addTo(map);
    stopLayer = L.layerGroup().addTo(map);
    A.toolLayer = toolLayer;
    // city labels
    const done = new Set();
    A.stopsHub.forEach((s) => { if (MAJOR.includes(s.city) && !done.has(s.city)) { done.add(s.city); L.marker([s.lat, s.lon], { interactive: false, icon: L.divIcon({ className: '', html: `<div style="font:600 11px system-ui;color:#075b57;text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap;transform:translate(8px,-16px)">${s.city}</div>` }) }).addTo(map); } });
    // routes
    Object.keys(A.routes).forEach((rid) => {
      const ln = L.polyline(A.routeStops[rid].map(A.ll), { color: A.routes[rid].color, weight: 3, opacity: 0.55 }).addTo(routeLayer);
      ln.on('click', (e) => { L.DomEvent.stopPropagation(e); popup(e.latlng, { type: 'route', id: rid }); });
      ln.bindTooltip(`${rid} · ${A.routes[rid].name}`, { sticky: true });
      routeLines[rid] = ln;
    });
    // stops
    Object.values(A.stops).forEach((s) => {
      const m = L.circleMarker([s.lat, s.lon], { radius: 3, color: '#fff', weight: 1, fillColor: '#16252b', fillOpacity: 0.85 }).addTo(stopLayer);
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); popup(e.latlng, { type: 'stop', id: s.stop_id }); });
      m.bindTooltip(s.name, { direction: 'top' });
      stopMarkers[s.stop_id] = m;
    });
    $('chkStops').onchange = (e) => (e.target.checked ? stopLayer.addTo(map) : map.removeLayer(stopLayer));
    $('btnFit').onclick = () => map.fitBounds(AZ_BOUNDS);
    $('btnFitBaku').onclick = () => map.fitBounds(BAKU);
    setTimeout(() => map.invalidateSize(), 50);
  }

  /* ------------------------------------------------- selection popup */
  function popup(latlng, o) {
    const el = document.createElement('div');
    let h = '';
    if (o.type === 'stop') { const s = A.stops[o.id], v = A.stopHour[o.id]; const hrs = Object.keys(A.routeStops).filter((r) => A.routeStops[r].includes(o.id));
      h = `<b>${A.esc(s.name)}</b><br><small>${o.id} · ${s.city} · ${s.zone}</small><br>${A.hh(A.hour)}: <b>${A.fmt(v[A.hour])}</b> ${A.lang === 'az' ? 'validasiya' : 'validations'}<br>${A.lang === 'az' ? 'Marşrutlar' : 'Routes'}: ${hrs.join(', ')}`; }
    if (o.type === 'route') { const r = A.routes[o.id], d = wd()[o.id][A.hour];
      h = `<b>${o.id} · ${A.esc(r.name)}</b><br><small>${r.city} · ${r.kind}</small><br>${A.hh(A.hour)}: ${A.fmt(d.val)} val · ${d.trips} trips · ${A.lang === 'az' ? 'əmsal' : 'ratio'} <b>${d.lr ?? '–'}</b>`; }
    if (o.type === 'segment') { const sg = A.segById[o.id], d = A.segHour[o.id][A.hour];
      h = `<b>${o.id}</b><br>${A.esc(A.stops[sg.from_stop].name)} → ${A.esc(A.stops[sg.to_stop].name)}<br>${A.hh(A.hour)}: <b>${d.speed}</b> km/h · ${d.travel} min · ${A.lang === 'az' ? 'gecikmə' : 'delay'} ×${d.delay}`; }
    el.innerHTML = h + '<br>';
    const b = document.createElement('button'); b.className = 'pri'; b.textContent = '💬 ' + A.t('ask_agent');
    b.onclick = () => { A.select(o); map.closePopup(); A.goto('agent'); const i = $('chatInput'); i.focus(); };
    const b2 = document.createElement('button'); b2.textContent = '📍 ' + A.t('selected'); b2.style.marginLeft = '4px';
    b2.onclick = () => { A.select(o); map.closePopup(); };
    el.append(b, b2);
    L.popup().setLatLng(latlng).setContent(el).openOn(map);
  }
  function renderChip() {
    const c = $('selChip');
    c.hidden = !A.sel;
    if (A.sel) { c.innerHTML = `📍 ${A.esc(A.selLabel(A.sel))} <button id="chipAsk" class="pri">💬</button><button id="chipX">✕</button>`; $('chipAsk').onclick = () => A.goto('agent'); $('chipX').onclick = () => A.select(null); }
    Object.entries(routeLines).forEach(([rid, ln]) => ln.setStyle({ weight: A.sel?.type === 'route' && A.sel.id === rid ? 6 : 3 }));
  }

  /* ----------------------------------------------------- tool shell */
  const TOOLS = [['overview', 'overview'], ['travel', 'dt1'], ['util', 'dt2'], ['cluster', 'dt3'], ['route', 'dt4'], ['od', 'dt5']];
  function tabs() {
    $('toolTabs').innerHTML = TOOLS.map(([k, l]) => `<button data-tool="${k}" class="${k === tool ? 'on' : ''}">${A.t(l)}</button>`).join('');
    $('toolTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { tool = b.dataset.tool; render(); }));
  }
  const legend = (h) => ($('legend').innerHTML = h || '');
  const rowClick = (sel, fn) => $('toolPanel').querySelectorAll(sel).forEach((tr) => (tr.onclick = () => fn(tr.dataset)));
  function resetBase() {
    toolLayer.clearLayers();
    Object.entries(routeLines).forEach(([rid, ln]) => ln.setStyle({ color: A.routes[rid].color, opacity: 0.55, weight: A.sel?.type === 'route' && A.sel.id === rid ? 6 : 3, dashArray: null }));
    // stop size = demand at hour
    const mx = Math.max(...Object.values(A.stopHour).map((v) => v[A.hour]), 1);
    Object.entries(stopMarkers).forEach(([id, m]) => m.setStyle({ radius: 2.5 + 8 * Math.sqrt(A.stopHour[id][A.hour] / mx), fillColor: '#16252b', fillOpacity: 0.8 }));
  }
  function render() {
    tabs(); resetBase(); legend('');
    $('hourLbl').textContent = A.hh(A.hour);
    ({ overview, travel, util, cluster, route, od })[tool]();
  }
  A.renderTool = render;
  const csvBtn = (id, name, cols, rows) => setTimeout(() => { const b = $(id); if (b) b.onclick = () => A.download(name, A.csv(cols, rows)); }, 0);

  /* -------------------------------------------------------- overview */
  function overview() {
    const E = A.D.eda.stats, rs = Object.keys(A.routes);
    const peak = rs.map((r) => [r, Math.max(...wd()[r].map((x) => x.lr || 0))]).sort((a, b) => b[1] - a[1]);
    const slowH = A.segments.filter((s) => A.segHour[s.seg_id][A.hour].delay >= 1.35).length;
    $('toolPanel').innerHTML = `<h3>${A.t('overview')}</h3>
      <div class="cards"><div class="c"><b>${A.fmt(E.total_validations_weekday)}</b><small>validations / weekday</small></div><div class="c"><b>${E.routes}</b><small>routes</small></div><div class="c"><b>${E.stops}</b><small>stops</small></div><div class="c"><b>${E.vehicles}</b><small>vehicles (est.)</small></div></div>
      <div class="note">${A.lang === 'az' ? 'Bütün məlumatlar <b>sintetikdir</b> (tools/gen_data.py). Koordinatlar təxminidir.' : 'All data is <b>synthetic</b> (tools/gen_data.py). Coordinates are approximate.'}</div>
      <h3>${A.lang === 'az' ? 'Əsas nəticələr' : 'Key findings'}</h3>
      <ul>
        <li>${A.lang === 'az' ? 'Ən yüklü marşrutlar' : 'Most loaded routes'}: ${peak.slice(0, 3).map((p) => `<b>${p[0]}</b> (${p[1].toFixed(2)})`).join(', ')}</li>
        <li>${A.lang === 'az' ? 'Pik saat' : 'Network peak'}: <b>${A.hh(E.peak_hour)}</b></li>
        <li>${A.hh(A.hour)}: <b>${slowH}</b> ${A.lang === 'az' ? 'seqment sərbəst sürətdən ≥35% yavaşdır' : 'segments ≥35% slower than free flow'}</li>
        <li>${A.lang === 'az' ? 'Köçürmə' : 'Avg transfers / journey'}: <b>${A.D.eda.chaining.avg_transfers}</b></li>
      </ul>
      <p><small>${A.lang === 'az' ? 'Xəritədə dayanacaq və ya marşrutu seçib agentə ötürün. Sol üstdə diaqnostik alətlər, saat sürüşdürücüsü bütün qatları dəyişir.' : 'Click a stop or route on the map and pass it to the agent. Use the tabs above for the five diagnostic tools; the hour slider drives every layer.'}</small></p>`;
  }

  /* ------------------------------------------------------------ DT-01 */
  function travel() {
    const h = A.hour, THR = 1.35;
    const rows = A.segments.map((s) => ({ s, d: A.segHour[s.seg_id][h] }));
    rows.forEach(({ s, d }) => {
      const ln = L.polyline([A.ll(s.from_stop), A.ll(s.to_stop)], { color: A.rampSpeed(1 / d.delay), weight: 6, opacity: 0.9 }).addTo(toolLayer);
      ln.on('click', (e) => { L.DomEvent.stopPropagation(e); popup(e.latlng, { type: 'segment', id: s.seg_id }); });
      ln.bindTooltip(`${s.seg_id}: ${d.speed} km/h`, { sticky: true });
    });
    // persistent slow zones: segments slow >= 4 h/day
    const persist = A.segments.filter((s) => s.slow_hours >= 4);
    persist.forEach((s) => L.polyline([A.ll(s.from_stop), A.ll(s.to_stop)], { color: '#c8394a', weight: 13, opacity: 0.22, interactive: false }).addTo(toolLayer));
    const slow = rows.filter((r) => r.d.delay >= THR).sort((a, b) => b.d.delay - a.d.delay);
    const avg = rows.reduce((a, r) => a + r.d.speed, 0) / rows.length;
    const rid0 = A.sel?.type === 'route' ? A.sel.id : 'B1';
    $('toolPanel').innerHTML = `<h3>${A.t('dt1')} · ${A.hh(h)}</h3>
      <div class="cards"><div class="c"><b>${avg.toFixed(1)}</b><small>km/h avg</small></div><div class="c"><b>${slow.length}</b><small>${A.lang === 'az' ? 'yavaş seqment' : 'slow segments'}</small></div><div class="c"><b>${persist.length}</b><small>${A.lang === 'az' ? 'davamlı yavaş zona (≥4 s/gün)' : 'persistent slow (≥4 h/day)'}</small></div></div>
      <h3>${A.lang === 'az' ? 'Dayanacaqdan-dayanacağa vaxt' : 'Stop-to-stop travel time'}</h3>
      <div class="row2"><select id="tRoute">${Object.keys(A.routes).map((r) => `<option ${r === rid0 ? 'selected' : ''}>${r}</option>`).join('')}</select><select id="tFrom"></select><span>→</span><select id="tTo"></select></div>
      <div id="tOut"></div>
      <h3>${A.lang === 'az' ? 'Ən yavaş seqmentlər' : 'Slowest segments'}</h3>
      <table class="t"><thead><tr><th>seg</th><th>from → to</th><th class="num">km/h</th><th class="num">×</th></tr></thead><tbody>
      ${slow.slice(0, 12).map(({ s, d }) => `<tr class="click" data-id="${s.seg_id}"><td>${s.seg_id}</td><td>${A.esc(A.stops[s.from_stop].name)} → ${A.esc(A.stops[s.to_stop].name)}</td><td class="num">${d.speed}</td><td class="num">${d.delay}</td></tr>`).join('') || `<tr><td colspan="4">${A.t('no_data')}</td></tr>`}</tbody></table>
      <div class="row2"><button id="csv1">CSV</button></div>`;
    legend(`<b>km/h vs free flow</b><div class="grad"></div><div style="display:flex;justify-content:space-between"><span>slow</span><span>free</span></div><div class="row"><i style="background:#c8394a;opacity:.3;height:10px"></i> persistent slow zone</div>`);
    csvBtn('csv1', 'slow_segments_h' + h + '.csv', ['seg_id', 'from', 'to', 'speed_kmh', 'delay_idx'], slow.map(({ s, d }) => [s.seg_id, A.stops[s.from_stop].name, A.stops[s.to_stop].name, d.speed, d.delay]));
    rowClick('tr.click', (d) => { const s = A.segById[d.id]; map.fitBounds([A.ll(s.from_stop), A.ll(s.to_stop)], { maxZoom: 13, padding: [60, 60] }); A.select({ type: 'segment', id: d.id }); });
    const fill = () => { const seq = A.routeStops[$('tRoute').value]; const opts = seq.map((id, i) => `<option value="${i}">${A.esc(A.stops[id].name)}</option>`).join(''); $('tFrom').innerHTML = opts; $('tTo').innerHTML = opts; $('tTo').value = seq.length - 1; calc(); };
    const calc = () => {
      const rid = $('tRoute').value, seq = A.routeStops[rid]; let i = +$('tFrom').value, j = +$('tTo').value; if (i > j) [i, j] = [j, i];
      const seg = (hh) => { let t = 0, d = 0; for (let k = i; k < j; k++) { const sg = A.segments.find((x) => x.route_id === rid && x.seq === k + 1); t += A.segHour[sg.seg_id][hh].travel; d += sg.dist_km; } return [t, d]; };
      if (i === j) { $('tOut').innerHTML = ''; return; }
      const all = Array.from({ length: 24 }, (_, hh) => seg(hh)[0]), [t, d] = seg(h);
      $('tOut').innerHTML = `<div><b>${t.toFixed(1)} min</b> · ${d.toFixed(1)} km · ${A.hh(h)} <small>(free-flow ${Math.min(...all).toFixed(1)} min)</small></div>${A.bar(all, { labels: all.map((_, k) => A.pad(k)), color: (v, k) => (k === h ? '#c8394a' : '#0b7a75'), label: 'travel time by hour' })}`;
    };
    fill(); $('tRoute').onchange = fill; $('tFrom').onchange = calc; $('tTo').onchange = calc;
  }

  /* ------------------------------------------------------------ DT-02 */
  let dayType = 'weekday';
  function util() {
    const h = A.hour, RH = A.routeHour[dayType];
    const rows = Object.keys(A.routes).map((r) => ({ r, d: RH[r][h], pk: RH[r].reduce((m, x, i) => (x.lr != null && x.lr > m[0] ? [x.lr, i] : m), [0, 0]) })).sort((a, b) => (b.d.lr ?? -1) - (a.d.lr ?? -1));
    rows.forEach(({ r, d }) => routeLines[r].setStyle({ color: A.rampLoad(d.lr), weight: 6, opacity: d.lr == null ? 0.25 : 0.95 }));
    const over = rows.filter((x) => x.d.lr >= 1).length, sel = A.sel?.type === 'route' ? A.sel.id : rows[0].r;
    $('toolPanel').innerHTML = `<h3>${A.t('dt2')} · ${A.hh(h)}</h3>
      <div class="row2"><div class="seg"><button data-dt="weekday" class="${dayType === 'weekday' ? 'on' : ''}">weekday</button><button data-dt="weekend" class="${dayType === 'weekend' ? 'on' : ''}">weekend</button></div><span class="badge ${over ? 'bad' : 'ok'}">${over} ${A.lang === 'az' ? 'tutumdan artıq' : 'over capacity'}</span></div>
      <table class="t"><thead><tr><th>route</th><th class="num">trips</th><th class="num">val</th><th class="num">ratio</th><th class="num">peak</th></tr></thead><tbody>
      ${rows.map(({ r, d, pk }) => `<tr class="click" data-id="${r}"><td><b style="color:${A.routes[r].color}">●</b> ${r}</td><td class="num">${d.trips}</td><td class="num">${A.fmt(d.val)}</td><td class="num"><span class="badge ${d.lr >= 1 ? 'bad' : d.lr >= 0.8 ? 'warn' : 'ok'}">${d.lr ?? '–'}</span></td><td class="num">${pk[0].toFixed(2)} @${A.pad(pk[1])}</td></tr>`).join('')}</tbody></table>
      <h3>${sel} · ${A.esc(A.routes[sel].name)}</h3><div id="uChart"></div>
      <div class="note">${A.lang === 'az' ? 'Əmsal = validasiya × 0.9 / (reys × nəqliyyat tutumu). Boarding/alighting yoxdursa, yük təxmini qiymətdir (DT-02).' : 'Ratio = validations × 0.9 / (trips × vehicle capacity). Without boarding/alighting data the load is an estimate (DT-02).'}</div>
      <button id="csv2">CSV</button>`;
    $('uChart').innerHTML = A.bar(RH[sel].map((x) => x.lr || 0), { labels: RH[sel].map((_, i) => A.pad(i)), ref: 1, refLabel: 'capacity', color: (v, i) => (i === h ? '#16252b' : A.rampLoad(v)), max: 1.2 });
    legend(`<b>demand / capacity</b><div class="row"><i style="background:#2e8b57"></i>&lt;0.6</div><div class="row"><i style="background:#e9a23b"></i>0.6–0.8</div><div class="row"><i style="background:#e9763b"></i>0.8–1.0</div><div class="row"><i style="background:#c8394a"></i>≥1.0 overloaded</div>`);
    $('toolPanel').querySelectorAll('[data-dt]').forEach((b) => (b.onclick = () => { dayType = b.dataset.dt; render(); }));
    rowClick('tr.click', (d) => { A.select({ type: 'route', id: d.id }); map.fitBounds(routeLines[d.id].getBounds(), { padding: [50, 50] }); render(); });
    csvBtn('csv2', 'utilization_h' + h + '.csv', ['route', 'trips', 'validations', 'load_ratio'], rows.map(({ r, d }) => [r, d.trips, d.val, d.lr]));
  }

  /* ------------------------------------------------------------ DT-03 */
  let sigma = 1.0, scope = 'hour';
  function cluster() {
    const h = A.hour, ids = Object.keys(A.stopHour);
    const val = (id) => (scope === 'hour' ? A.stopHour[id][h] : A.stopHour[id].reduce((a, b) => a + b, 0));
    const v = ids.map(val), mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), thr = mean + sigma * sd;
    const hot = ids.filter((id) => val(id) >= thr), par = Object.fromEntries(hot.map((i) => [i, i]));
    const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
    hot.forEach((a, i) => hot.slice(i + 1).forEach((b) => { if (A.hav(A.ll(a), A.ll(b)) < 2.0) par[find(a)] = find(b); }));
    const groups = {}; hot.forEach((id) => (groups[find(id)] = groups[find(id)] || []).push(id));
    const trips = (id) => Object.keys(A.routeStops).filter((r) => A.routeStops[r].includes(id)).reduce((a, r) => a + wd()[r][h].trips, 0);
    const cl = Object.values(groups).map((g) => {
      const tot = g.reduce((a, id) => a + val(id), 0), lat = g.reduce((a, id) => a + A.stops[id].lat * val(id), 0) / tot, lon = g.reduce((a, id) => a + A.stops[id].lon * val(id), 0) / tot;
      const rad = Math.max(400, ...g.map((id) => A.hav([lat, lon], A.ll(id)) * 1000 + 300)), top = g.slice().sort((a, b) => val(b) - val(a))[0];
      return { g, tot, lat, lon, rad, top, trips: g.reduce((a, id) => a + trips(id), 0) };
    }).sort((a, b) => b.tot - a.tot);
    cl.forEach((c, i) => {
      L.circle([c.lat, c.lon], { radius: c.rad, color: '#c8394a', weight: 2, fillColor: '#c8394a', fillOpacity: 0.18 }).addTo(toolLayer).bindTooltip(`#${i + 1} · ${A.stops[c.top].name}`);
      L.marker([c.lat, c.lon], { interactive: false, icon: L.divIcon({ className: '', html: `<div style="background:#c8394a;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;font:700 11px/20px system-ui;transform:translate(-10px,-10px)">${i + 1}</div>` }) }).addTo(toolLayer);
    });
    hot.forEach((id) => stopMarkers[id].setStyle({ fillColor: '#c8394a', fillOpacity: 1 }));
    $('toolPanel').innerHTML = `<h3>${A.t('dt3')} · ${scope === 'hour' ? A.hh(h) : '24h'}</h3>
      <div class="row2"><div class="seg"><button data-sc="hour" class="${scope === 'hour' ? 'on' : ''}">${A.hh(h)}</button><button data-sc="day" class="${scope === 'day' ? 'on' : ''}">24h</button></div>
      <label class="f" style="flex:1">σ ≥ <b id="sgv">${sigma.toFixed(1)}</b><input type="range" id="sg" min="0.3" max="3" step="0.1" value="${sigma}"></label></div>
      <div class="cards"><div class="c"><b>${hot.length}</b><small>${A.lang === 'az' ? 'yüksək tələbli dayanacaq' : 'high-demand stops'}</small></div><div class="c"><b>${cl.length}</b><small>clusters</small></div><div class="c"><b>${A.fmt(thr)}</b><small>threshold</small></div></div>
      <table class="t"><thead><tr><th>#</th><th>top stop</th><th class="num">stops</th><th class="num">val</th><th class="num">trips/h</th></tr></thead><tbody>
      ${cl.map((c, i) => `<tr class="click" data-i="${i}"><td>${i + 1}</td><td>${A.esc(A.stops[c.top].name)}</td><td class="num">${c.g.length}</td><td class="num">${A.fmt(c.tot)}</td><td class="num">${c.trips}</td></tr>`).join('') || `<tr><td colspan="5">${A.t('no_data')}</td></tr>`}</tbody></table>
      <div class="note">${A.lang === 'az' ? 'Klasterləmə: yüksək tələbli dayanacaqlar 2 km daxilində birləşdirilir. “trips/h” — klasterdəki dayanacaqlara eyni saatda çatan reyslərin cəmi (üst-üstə düşmə).' : 'Clustering: high-demand stops within 2 km are merged. “trips/h” = trips serving the cluster\'s stops in the same hour (overlap).'}</div><button id="csv3">CSV</button>`;
    $('toolPanel').querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => { scope = b.dataset.sc; render(); }));
    $('sg').oninput = (e) => { sigma = +e.target.value; render(); };
    rowClick('tr.click', (d) => { const c = cl[+d.i]; map.setView([c.lat, c.lon], 12); A.select({ type: 'stop', id: c.top }); });
    csvBtn('csv3', 'demand_clusters.csv', ['rank', 'top_stop', 'stops', 'validations', 'trips_per_h'], cl.map((c, i) => [i + 1, A.stops[c.top].name, c.g.length, c.tot, c.trips]));
    legend('<b>DT-03</b><div class="row"><i style="background:#c8394a"></i> high-demand stop</div>');
  }

  /* ------------------------------------------------------------ DT-04 */
  let mode4 = 'overlap';
  function route() {
    const OV = A.rows('route_overlap'), DG = A.rows('route_diag'), TR = A.rows('transfers').slice(0, 12), C = A.D.eda.chaining;
    let body = '';
    if (mode4 === 'overlap') {
      body = `<table class="t"><thead><tr><th>A</th><th>B</th><th class="num">km</th><th class="num">%</th></tr></thead><tbody>${OV.slice(0, 14).map((o) => `<tr class="click" data-a="${o.route_a}" data-b="${o.route_b}"><td>${o.route_a}</td><td>${o.route_b}</td><td class="num">${o.shared_km}</td><td class="num"><span class="badge ${o.overlap_pct > 60 ? 'bad' : 'warn'}">${o.overlap_pct}</span></td></tr>`).join('')}</tbody></table>`;
      const pairs = (r) => { const q = A.routeStops[r], o = new Set(); q.slice(1).forEach((s, i) => o.add([q[i], s].sort().join('|'))); return o; };
      OV.slice(0, 14).forEach((o) => { const pa = pairs(o.route_a), pb = pairs(o.route_b); [...pa].filter((x) => pb.has(x)).forEach((k) => L.polyline(k.split('|').map(A.ll), { color: '#e9763b', weight: 9, opacity: 0.55, interactive: false }).addTo(toolLayer)); });
      legend('<b>DT-04</b><div class="row"><i style="background:#e9763b"></i> shared corridor (≥2 routes)</div>');
    } else if (mode4 === 'back') {
      body = `<table class="t"><thead><tr><th>route</th><th class="num">km</th><th class="num">disp.</th><th class="num">circuity</th><th class="num">back km</th></tr></thead><tbody>${DG.slice().sort((a, b) => b.backtrack_km - a.backtrack_km).map((d) => `<tr class="click" data-r="${d.route_id}"><td>${d.route_id} ${d.backtrack_flag ? '<span class="badge bad">backtrack</span>' : ''}</td><td class="num">${d.length_km}</td><td class="num">${d.displacement_km}</td><td class="num">${d.circuity}</td><td class="num">${d.backtrack_km}</td></tr>`).join('')}</tbody></table>`;
      DG.filter((d) => d.backtrack_flag).forEach((d) => routeLines[d.route_id].setStyle({ color: '#c8394a', weight: 6, opacity: 1, dashArray: '8 6' }));
      legend('<b>DT-04</b><div class="row"><i style="background:#c8394a"></i> backtracking route</div>');
    } else {
      const mx = TR[0]?.transfers_est || 1;
      TR.forEach((t) => { const s = A.stops[t.stop_id]; if (s) L.circleMarker([s.lat, s.lon], { radius: 6 + 22 * Math.sqrt(t.transfers_est / mx), color: '#5e60ce', fillColor: '#5e60ce', fillOpacity: 0.35, weight: 2 }).addTo(toolLayer).bindTooltip(`${s.name}: ${A.fmt(t.transfers_est)}`); });
      body = `<div class="cards"><div class="c"><b>${C.avg_transfers}</b><small>transfers / journey</small></div><div class="c"><b>${A.fmt(C.transfers_0)}</b><small>direct (sample)</small></div><div class="c"><b>${A.fmt(C.transfers_1)}</b><small>1 transfer</small></div></div>
        <table class="t"><thead><tr><th>transfer hotspot</th><th>city</th><th class="num">est./day</th></tr></thead><tbody>${TR.map((t) => `<tr class="click" data-s="${t.stop_id}"><td>${A.esc(A.stops[t.stop_id]?.name || t.stop_id)}</td><td>${A.stops[t.stop_id]?.city || ''}</td><td class="num">${A.fmt(t.transfers_est)}</td></tr>`).join('')}</tbody></table>`;
      legend('<b>DT-04</b><div class="row"><i style="background:#5e60ce"></i> transfer hotspot</div>');
    }
    $('toolPanel').innerHTML = `<h3>${A.t('dt4')}</h3><div class="seg" style="margin-bottom:8px">${[['overlap', 'Overlap'], ['back', 'Backtracking'], ['xfer', 'Transfers']].map(([k, l]) => `<button data-m="${k}" class="${mode4 === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}
      <div class="note">${A.lang === 'az' ? 'Üst-üstə düşmə: ortaq dayanacaq cütləri. Geri qayıtma: əsas istiqamətdən >90° uzaqlaşan seqmentlər. Köçürmə: eyni kartın 45 dəq. daxilində başqa marşrutda növbəti minişi.' : 'Overlap = shared consecutive stop pairs. Backtracking = segments heading >90° away from the route\'s main direction. Transfer = same card boards another route within 45 min near the estimated alighting stop.'}</div>`;
    $('toolPanel').querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode4 = b.dataset.m; render(); }));
    rowClick('tr.click', (d) => {
      if (d.a) map.fitBounds(L.featureGroup([routeLines[d.a], routeLines[d.b]]).getBounds(), { padding: [50, 50] });
      if (d.r) { A.select({ type: 'route', id: d.r }); map.fitBounds(routeLines[d.r].getBounds(), { padding: [50, 50] }); }
      if (d.s) { map.setView(A.ll(d.s), 12); A.select({ type: 'stop', id: d.s }); }
    });
  }

  /* ------------------------------------------------------------ DT-05 */
  function od() {
    const OD = A.rows('od_zone'), C = A.D.eda.chaining, Z = A.D.meta.zones;
    const tot = {}; OD.forEach((o) => { tot[o.origin_zone] = (tot[o.origin_zone] || 0) + o.trips_est; tot[o.dest_zone] = (tot[o.dest_zone] || 0) + o.trips_est; });
    const zs = Object.keys(tot).sort((a, b) => tot[b] - tot[a]).slice(0, 10), m = {}; OD.forEach((o) => (m[o.origin_zone + '|' + o.dest_zone] = o.trips_est));
    const mx = Math.max(...OD.map((o) => o.trips_est), 1);
    const cell = (a, b) => { const v = m[a + '|' + b] || 0, k = A.kFor(A.user.role); if (!v) return '<td></td>'; if (v < k) return `<td title="masked">&lt;${k}</td>`; const t = Math.sqrt(v / mx); return `<td class="z" style="background:rgba(11,122,117,${0.12 + 0.88 * t});color:${t > .45 ? '#fff' : '#16252b'}" title="${a} → ${b}: ${v}">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</td>`; };
    OD.slice(0, 18).forEach((o) => { if (o.origin_zone === o.dest_zone || !Z[o.origin_zone] || !Z[o.dest_zone]) return; L.polyline([Z[o.origin_zone], Z[o.dest_zone]], { color: '#0b7a75', weight: 1 + 9 * Math.sqrt(o.trips_est / mx), opacity: 0.5 }).addTo(toolLayer).bindTooltip(`${o.origin_zone} → ${o.dest_zone}: ${A.fmt(o.trips_est)}`, { sticky: true }); });
    $('toolPanel').innerHTML = `<h3>${A.t('dt5')}</h3>
      <div class="cards"><div class="c"><b>${A.fmt(C.journeys)}</b><small>journeys (sample)</small></div><div class="c"><b>${C.alight_exact_pct}%</b><small>alight stop = truth</small></div><div class="c"><b>${C.alight_zone_pct}%</b><small>alight zone = truth</small></div><div class="c"><b>×${C.expansion}</b><small>expansion</small></div></div>
      <div style="overflow:auto"><table class="mx"><tr><th></th>${zs.map((z) => `<th title="${z}">${z.slice(0, 4)}</th>`).join('')}</tr>${zs.map((a) => `<tr><th title="${a}">${a.slice(0, 5)}</th>${zs.map((b) => cell(a, b)).join('')}</tr>`).join('')}</table></div>
      <small>rows = origin, columns = destination (est. trips/day, top-10 zones)</small>
      <div class="note">${A.lang === 'az' ? 'Metod: hər validasiyada minmə nöqtəsi məlumdur; düşmə nöqtəsi eyni kartın <b>növbəti minişinə</b> ən yaxın dayanacaq kimi qiymətləndirilir (gün sonu → səhər). Dəqiqlik sintetik “ground truth” ilə ölçülüb; real datada qəbul metodologiya üzrə aparılır.' : 'Method: boarding is known per validation; the alighting stop is the stop on the route nearest to the same card\'s <b>next boarding</b> (last trip → first trip of the day), accepted within 600 m. Accuracy is measured against synthetic ground truth; on real data acceptance is on methodology, not an exact figure.'}</div>
      <div class="row2"><button id="csv5">CSV</button></div>`;
    csvBtn('csv5', 'od_matrix.csv', ['origin_zone', 'dest_zone', 'trips_est'], OD.map((o) => [o.origin_zone, o.dest_zone, o.trips_est]));
    legend('<b>DT-05</b><div class="row"><i style="background:#0b7a75"></i> top O/D flows</div>');
  }

  A.initMap = () => {
    initMap(); tabs(); render();
    $('hour').oninput = (e) => { A.hour = +e.target.value; render(); A.emit('hour', A.hour); };
    A.on('select', () => { renderChip(); });
    A.on('lang', render);
    A.on('role', render);
    A.mapZoomTo = (o) => { if (o.type === 'stop') map.setView(A.ll(o.id), 13); };
  };
  A.stopMarkers = stopMarkers; A.routeLines = routeLines;
})();
