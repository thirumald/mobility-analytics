/* Network view: UAE / Abu Dhabi map, tool registry, KPI strip, transit diagnostics (DT-01..DT-05) */
(function () {
  let map, tiles, toolLayer, stopLayer, routeLayer, labelLayer, tool = 'overview', group = 'transit';
  const stopMarkers = {}, routeLines = {};
  const UAE = [[22.4, 51.4], [26.2, 56.5]], EMIRATE = [[22.7, 51.6], [25.2, 56.0]], CITY = [[24.28, 54.28], [24.58, 54.72]];
  const $ = (id) => document.getElementById(id);
  const wd = () => A.routeHour.weekday;
  const REG = {}; // tool registry: key -> {group,label,run}
  const GROUPS = [['transit', 'g_transit'], ['energy', 'g_energy'], ['ops', 'g_ops'], ['resil', 'g_resil']];

  function initMap() {
    map = L.map('map', { zoomControl: true, minZoom: 6, maxZoom: 17, preferCanvas: true, zoomSnap: 0.25 }).fitBounds(EMIRATE);
    A.map = map;
    // offline basemap: emirate outlines (Natural Earth, public domain). Abu Dhabi highlighted. Re-styled on theme change.
    const dark = () => A.theme() === 'dark';
    const geoStyle = (f) => ({ color: f.properties.name === 'Abu Dhabi' ? A.C.cyan : (dark() ? '#334155' : '#a9b6c8'), weight: f.properties.name === 'Abu Dhabi' ? 1.4 : 1, fillColor: f.properties.name === 'Abu Dhabi' ? (dark() ? '#0c1a2e' : '#e6eef8') : (dark() ? '#0b1220' : '#eef2f7'), fillOpacity: 1, opacity: .9 });
    const geo = L.geoJSON(window.UAE_GEO, { interactive: false, style: geoStyle }).addTo(map);
    const geoKey = () => { try { return localStorage.getItem('safar.geoapifyKey') || (window.SAFAR_CONFIG && window.SAFAR_CONFIG.geoapifyKey) || ''; } catch (e) { return (window.SAFAR_CONFIG && window.SAFAR_CONFIG.geoapifyKey) || ''; } };
    // Basemap = Geoapify only (osm-bright light / dark-matter dark). No key or tile failure → bundled emirate outlines.
    const tileUrl = () => `https://maps.geoapify.com/v1/tile/${dark() ? 'dark-matter' : 'osm-bright'}/{z}/{x}/{y}${L.Browser.retina ? '@2x' : ''}.png?apiKey=${encodeURIComponent(geoKey())}`;
    const attrib = 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    const note = (t) => { const n = $('mapNote'); n.textContent = t || ''; n.hidden = !t; };
    tiles = L.tileLayer(tileUrl(), { maxZoom: 19, attribution: attrib, opacity: .95 });
    let errs = 0;
    tiles.on('tileerror', () => { if (++errs === 4) { $('chkTiles').checked = false; map.removeLayer(tiles); note('Geoapify tiles are not loading — check the API key and its allowed origins. Showing offline outline.'); } });
    tiles.on('tileload', () => { errs = 0; note(''); });
    if (geoKey()) tiles.addTo(map); else { $('chkTiles').checked = false; $('chkTiles').disabled = true; note('No Geoapify key configured — showing offline outline. Add GEOAPIFY_KEY (deploy secret) or use the account menu → Map key.'); }
    $('chkTiles').onchange = (e) => (e.target.checked ? (errs = 0, tiles.addTo(map)) : map.removeLayer(tiles));
    // Place search: Geoapify geocoding (UAE only), biased to Abu Dhabi.
    let pin = null; const gq = $('geoq'), gr = $('geores');
    const search = async () => {
      const q = gq.value.trim(); if (q.length < 2) { gr.hidden = true; return; }
      if (!geoKey()) { gr.innerHTML = '<div class="gr-i">Add a Geoapify key to enable place search.</div>'; gr.hidden = false; return; }
      try {
        const r = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&filter=countrycode:ae&bias=proximity:54.3773,24.4539&limit=6&format=json&apiKey=${encodeURIComponent(geoKey())}`);
        const j = await r.json(), items = j.results || [];
        gr.innerHTML = items.length ? items.map((x, i) => `<button type="button" class="gr-i" data-i="${i}">${A.esc(x.formatted || x.name || '')}</button>`).join('') : '<div class="gr-i">No places found</div>'; gr.hidden = false;
        gr.querySelectorAll('button').forEach((b) => (b.onclick = () => { const x = items[+b.dataset.i]; if (pin) map.removeLayer(pin); pin = L.marker([x.lat, x.lon]).addTo(map).bindPopup(`<b>${A.esc(x.name || x.address_line1 || '')}</b><br><small>${A.esc(x.formatted || '')}</small>`).openPopup(); map.setView([x.lat, x.lon], 15); gr.hidden = true; }));
      } catch (e) { gr.innerHTML = '<div class="gr-i">Search unavailable</div>'; gr.hidden = false; }
    };
    gq.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } if (e.key === 'Escape') gr.hidden = true; });
    document.addEventListener('click', (e) => { if (!e.target.closest('#geowrap')) gr.hidden = true; });
    A.on('theme', () => { geo.setStyle(geoStyle); if (geoKey()) tiles.setUrl(tileUrl()); render(); });
    routeLayer = L.layerGroup().addTo(map); toolLayer = L.layerGroup().addTo(map); stopLayer = L.layerGroup().addTo(map); labelLayer = L.layerGroup().addTo(map);
    A.toolLayer = toolLayer;
    // labels
    const lab = (ll, txt, cls) => L.marker(ll, { interactive: false, icon: L.divIcon({ className: '', html: `<div class="${cls}">${txt}</div>` }) });
    const style = document.createElement('style');
    style.textContent = '.lb{font:600 11px Inter,system-ui;color:var(--txt);text-shadow:0 0 4px var(--bg),0 0 4px var(--bg);white-space:nowrap;transform:translate(8px,-16px)}.lb.c{font-size:12.5px;letter-spacing:.06em}.lb.s{font-weight:500;font-size:10px;color:var(--mut)}';
    document.head.appendChild(style);
    const done = new Set();
    A.stopsHub.forEach((s) => { if (['Abu Dhabi', 'Al Ain', 'Dubai', 'Ruwais', 'Madinat Zayed', 'Liwa'].includes(s.city) && !done.has(s.city) && s.name !== 'Jebel Ali') { done.add(s.city); } });
    [['Abu Dhabi', 24.4539, 54.3773], ['Al Ain', 24.2075, 55.7447], ['Dubai', 25.2048, 55.2708], ['Ruwais', 24.11, 52.73], ['Madinat Zayed', 23.658, 53.706], ['Liwa', 23.13, 53.78], ['Sharjah', 25.3463, 55.4209]]
      .forEach(([n, la, lo]) => lab([la, lo], n.toUpperCase(), 'lb c').addTo(map));
    A.stopsHub.forEach((s) => lab([s.lat, s.lon], A.esc(s.name), 'lb s').addTo(labelLayer));
    const zl = () => (map.getZoom() >= 11.5 ? labelLayer.addTo(map) : map.removeLayer(labelLayer)); map.on('zoomend', zl); zl();
    // routes
    Object.keys(A.routes).forEach((rid) => {
      const ln = L.polyline(A.routeStops[rid].map(A.ll), { color: A.routes[rid].color, weight: 3, opacity: 0.6 }).addTo(routeLayer);
      ln.on('click', (e) => { L.DomEvent.stopPropagation(e); popup(e.latlng, { type: 'route', id: rid }); });
      ln.bindTooltip(`${rid} · ${A.routes[rid].name}`, { sticky: true }); routeLines[rid] = ln;
    });
    // stops
    Object.values(A.stops).forEach((s) => {
      if (!A.stopHour[s.stop_id]) return;
      const m = L.circleMarker([s.lat, s.lon], { radius: 3, color: A.C.halo, weight: 1, fillColor: A.C.stop, fillOpacity: 0.85 }).addTo(stopLayer);
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); popup(e.latlng, { type: 'stop', id: s.stop_id }); });
      m.bindTooltip(s.name, { direction: 'top' }); stopMarkers[s.stop_id] = m;
    });
    $('chkStops').onchange = (e) => (e.target.checked ? stopLayer.addTo(map) : map.removeLayer(stopLayer));
    $('btnFit').onclick = () => map.fitBounds(UAE); $('btnFitAD').onclick = () => map.fitBounds(EMIRATE);
    setTimeout(() => map.invalidateSize(), 60);
  }

  /* -------------------------------------------------- selection popup */
  function popup(latlng, o) {
    const el = document.createElement('div'); let h = '';
    if (o.type === 'stop') { const s = A.stops[o.id], v = A.stopHour[o.id], rs = Object.keys(A.routeStops).filter((r) => A.routeStops[r].includes(o.id));
      h = `<b>${A.esc(s.name)}</b><br><small>${o.id} · ${s.city} · ${s.zone}${s.shelter_ac ? ' · AC shelter' : ''}</small><br>${A.hh(A.hour)}: <b>${A.fmt(v[A.hour])}</b> validations<br>Routes: ${rs.join(', ')}`; }
    if (o.type === 'route') { const r = A.routes[o.id], d = wd()[o.id][A.hour]; h = `<b>${o.id} · ${A.esc(r.name)}</b><br><small>${r.city} · ${r.kind}</small><br>${A.hh(A.hour)}: ${A.fmt(d.val)} val · ${d.trips} trips · ratio <b>${d.lr ?? '–'}</b>`; }
    if (o.type === 'segment') { const sg = A.segById[o.id], d = A.segHour[o.id][A.hour]; h = `<b>${o.id}</b><br>${A.esc(A.stops[sg.from_stop].name)} → ${A.esc(A.stops[sg.to_stop].name)}<br>${A.hh(A.hour)}: <b>${d.speed}</b> km/h · ${d.travel} min · delay ×${d.delay}`; }
    if (o.type === 'vehicle') { const f = A.fleet.find((x) => x.vehicle_id === o.id); h = `<b>${o.id}</b><br>${f.fuel_type} · ${f.status}<br>${f.soc_pct != null ? 'SOC <b>' + f.soc_pct + '%</b> · ' : ''}health <b>${f.health_score}</b>`; }
    el.innerHTML = h + '<br>';
    const b = document.createElement('button'); b.className = 'pri'; b.textContent = '✦ ' + A.t('ask_agent');
    b.onclick = () => { A.select(o); map.closePopup(); A.goto('agent'); $('chatInput').focus(); };
    const b2 = document.createElement('button'); b2.textContent = '◎ ' + A.t('selected'); b2.style.marginInlineStart = '4px'; b2.onclick = () => { A.select(o); map.closePopup(); };
    el.append(b, b2); L.popup().setLatLng(latlng).setContent(el).openOn(map);
  }
  function renderChip() {
    const c = $('selChip'); c.hidden = !A.sel;
    if (A.sel) { c.innerHTML = `◎ ${A.esc(A.selLabel(A.sel))} <button id="chipAsk" class="pri">✦</button><button id="chipX">✕</button>`; $('chipAsk').onclick = () => A.goto('agent'); $('chipX').onclick = () => A.select(null); }
    Object.entries(routeLines).forEach(([rid, ln]) => ln.setStyle({ weight: A.sel?.type === 'route' && A.sel.id === rid ? 6 : 3 }));
  }

  /* ----------------------------------------------------- shell */
  const legend = (h) => ($('legend').innerHTML = h || '');
  const rowClick = (sel, fn) => $('toolPanel').querySelectorAll(sel).forEach((tr) => (tr.onclick = () => fn(tr.dataset)));
  const csvBtn = (id, name, cols, rows) => setTimeout(() => { const b = $(id); if (b) b.onclick = () => A.download(name, A.csv(cols, rows)); }, 0);
  function resetBase() {
    toolLayer.clearLayers();
    Object.entries(routeLines).forEach(([rid, ln]) => { ln.setStyle({ color: A.routes[rid].color, opacity: 0.6, weight: A.sel?.type === 'route' && A.sel.id === rid ? 6 : 3, dashArray: null }); });
    const mx = Math.max(...Object.values(A.stopHour).map((v) => v[A.hour]), 1);
    Object.entries(stopMarkers).forEach(([id, m]) => m.setStyle({ radius: 2.5 + 8 * Math.sqrt(A.stopHour[id][A.hour] / mx), color: A.C.halo, fillColor: A.C.stop, fillOpacity: 0.8 }));
  }
  function tabs() {
    const g = GROUPS.find(([k]) => k === REG[tool].group); $('dockTitle').textContent = A.t(REG[tool].label); $('dockGroup').textContent = A.t(g[1]);
  }
  function kpis() {
    const h = A.hour, RH = wd(), rs = Object.keys(A.routes);
    const val = rs.reduce((a, r) => a + RH[r][h].val, 0), over = rs.filter((r) => RH[r][h].lr >= 1).length;
    const avg = A.segments.reduce((a, s) => a + A.segHour[s.seg_id][h].speed, 0) / A.segments.length;
    const ev = A.fleet.filter((f) => f.fuel_type === 'electric').length / A.fleet.length, open = A.incidents.filter((i) => i.status === 'open').length;
    const sv = A.emis.reduce((a, e) => a + e.co2_saved_t_day, 0);
    const K = (l, v, c) => `<div class="kpi"><small>${l}</small><b class="${c || ''}">${v}</b></div>`;
    $('kpiStrip').innerHTML = K('Validations ' + A.hh(h), A.fmt(val)) + K('Overloaded routes', over, over ? 'bad' : 'ok') + K('Avg speed', avg.toFixed(1) + ' km/h') + K('EV fleet', Math.round(ev * 100) + '%', 'ok') + K('Open incidents', open, open > 10 ? 'warn' : '') + K('CO₂ saved / day', sv.toFixed(1) + ' t', 'ok');
    const w = A.weather.summer[h]; $('barWx').textContent = `☀ ${w.t}°C · HI ${w.hi}`; if (!A.simOn) $('clock').textContent = A.hh(h);
  }
  function render() {
    tabs(); resetBase(); legend(''); $('hourLbl').textContent = A.hh(A.hour); kpis();
    (REG[tool] || REG.overview).run();
  }
  A.renderTool = render;
  A.openTool = (key) => { if (!REG[key]) return; tool = key; group = REG[key].group; render(); };
  A.tools = () => Object.entries(REG).map(([k, t]) => ({ key: k, group: t.group, label: t.label }));
  A.GROUPS = GROUPS;
  A.reg = (key, group, label, run) => { REG[key] = { group, label, run }; };
  A.M = { $, wd, routeLines, stopMarkers, popup, legend, rowClick, csvBtn, get map() { return map; }, get toolLayer() { return toolLayer; }, render };

  /* ----------------------------------------------------- overview */
  A.reg('overview', 'transit', 't_overview', () => {
    const E = A.D.eda.stats, rs = Object.keys(A.routes);
    const peak = rs.map((r) => [r, Math.max(...wd()[r].map((x) => x.lr || 0))]).sort((a, b) => b[1] - a[1]);
    const slowH = A.segments.filter((s) => A.segHour[s.seg_id][A.hour].delay >= 1.35).length;
    const inc = A.incidents.filter((i) => i.hour === A.hour);
    $('toolPanel').innerHTML = `<h3>Command overview</h3>
      <div class="cards"><div class="c"><b>${A.fmt(E.total_validations_weekday)}</b><small>validations / weekday</small></div><div class="c"><b>${E.routes}</b><small>routes</small></div><div class="c"><b>${E.stops}</b><small>stops</small></div><div class="c"><b>${E.vehicles}</b><small>vehicles</small></div></div>
      <div class="rec"><b>Insight</b> · ${peak.slice(0, 3).map((p) => `<b>${p[0]}</b> peaks at ${p[1].toFixed(2)}`).join(', ')} demand/capacity. At ${A.hh(A.hour)} <b>${slowH}</b> segments run ≥35% below free-flow speed.</div>
      <h3>Alerts this hour (${inc.length})</h3>
      ${inc.length ? `<table class="t"><tbody>${inc.slice(0, 6).map((i) => `<tr class="click" data-s="${i.stop_id}"><td><span class="badge ${i.severity >= 3 ? 'bad' : i.severity === 2 ? 'warn' : ''}">S${i.severity}</span></td><td>${i.type.replace(/_/g, ' ')}</td><td>${i.route_id}</td><td>${A.esc(A.stops[i.stop_id].name)}</td></tr>`).join('')}</tbody></table>` : '<small>No incidents recorded this hour.</small>'}
      <div class="note">All data is <b>synthetic</b> (tools/gen_data.py); Abu Dhabi hub coordinates are approximate and routes are fictional.</div>
      <small>Pick a module from the groups above. Click any stop, route or segment on the map and send it to the Copilot. The hour slider drives every layer.</small>`;
    inc.forEach((i) => L.circleMarker(A.ll(i.stop_id), { radius: 9, color: i.severity >= 3 ? A.C.bad : A.C.warn, weight: 2, fillOpacity: .25 }).addTo(toolLayer).bindTooltip(i.type.replace(/_/g, ' ')));
    rowClick('tr.click', (d) => A.M.map.setView(A.ll(d.s), 14));
  });

  /* ------------------------------------------------------------ DT-01 */
  A.reg('travel', 'transit', 't_travel', () => {
    const h = A.hour, THR = 1.35;
    const rows = A.segments.map((s) => ({ s, d: A.segHour[s.seg_id][h] }));
    const persist = A.segments.filter((s) => s.slow_hours >= 4);
    persist.forEach((s) => L.polyline([A.ll(s.from_stop), A.ll(s.to_stop)], { color: A.C.bad, weight: 14, opacity: 0.2, interactive: false }).addTo(toolLayer));
    rows.forEach(({ s, d }) => { const ln = L.polyline([A.ll(s.from_stop), A.ll(s.to_stop)], { color: A.rampSpeed(1 / d.delay), weight: 6, opacity: 0.95 }).addTo(toolLayer);
      ln.on('click', (e) => { L.DomEvent.stopPropagation(e); popup(e.latlng, { type: 'segment', id: s.seg_id }); }); ln.bindTooltip(`${s.seg_id}: ${d.speed} km/h`, { sticky: true }); });
    const slow = rows.filter((r) => r.d.delay >= THR).sort((a, b) => b.d.delay - a.d.delay), avg = rows.reduce((a, r) => a + r.d.speed, 0) / rows.length, rid0 = A.sel?.type === 'route' ? A.sel.id : 'T1';
    $('toolPanel').innerHTML = `<h3>DT-01 · Travel time & slow zones · ${A.hh(h)}</h3>
      <div class="cards"><div class="c"><b>${avg.toFixed(1)}</b><small>km/h network avg</small></div><div class="c ${slow.length ? 'warn' : ''}"><b>${slow.length}</b><small>slow segments</small></div><div class="c bad"><b>${persist.length}</b><small>persistent (≥4 h/day)</small></div></div>
      <h3>Stop-to-stop travel time</h3>
      <div class="row2"><select id="tRoute">${Object.keys(A.routes).map((r) => `<option ${r === rid0 ? 'selected' : ''}>${r}</option>`).join('')}</select><select id="tFrom"></select><span>→</span><select id="tTo"></select></div><div id="tOut"></div>
      <h3>Slowest segments</h3><table class="t"><thead><tr><th>seg</th><th>from → to</th><th class="num">km/h</th><th class="num">×</th></tr></thead><tbody>
      ${slow.slice(0, 12).map(({ s, d }) => `<tr class="click" data-id="${s.seg_id}"><td>${s.seg_id}</td><td>${A.esc(A.stops[s.from_stop].name)} → ${A.esc(A.stops[s.to_stop].name)}</td><td class="num">${d.speed}</td><td class="num">${d.delay}</td></tr>`).join('') || '<tr><td colspan="4">No slow segments</td></tr>'}</tbody></table>
      <div class="row2"><button id="csv1">⬇ CSV</button></div>`;
    legend(`<b>Speed vs free flow</b><div class="grad"></div><div style="display:flex;justify-content:space-between"><span>slow</span><span>free</span></div><div class="row"><i style="background:#fb7185;opacity:.35;height:10px"></i> persistent slow zone</div>`);
    csvBtn('csv1', `slow_segments_h${h}.csv`, ['seg_id', 'from', 'to', 'speed_kmh', 'delay_idx'], slow.map(({ s, d }) => [s.seg_id, A.stops[s.from_stop].name, A.stops[s.to_stop].name, d.speed, d.delay]));
    rowClick('tr.click', (d) => { const s = A.segById[d.id]; map.fitBounds([A.ll(s.from_stop), A.ll(s.to_stop)], { maxZoom: 13, padding: [80, 80] }); A.select({ type: 'segment', id: d.id }); });
    const fill = () => { const seq = A.routeStops[$('tRoute').value], o = seq.map((id, i) => `<option value="${i}">${A.esc(A.stops[id].name)}</option>`).join(''); $('tFrom').innerHTML = o; $('tTo').innerHTML = o; $('tTo').value = seq.length - 1; calc(); };
    const calc = () => { const rid = $('tRoute').value; let i = +$('tFrom').value, j = +$('tTo').value; if (i > j) [i, j] = [j, i]; if (i === j) { $('tOut').innerHTML = ''; return; }
      const seg = (hh) => { let t = 0, d = 0; for (let k = i; k < j; k++) { const sg = A.segments.find((x) => x.route_id === rid && x.seq === k + 1); t += A.segHour[sg.seg_id][hh].travel; d += sg.dist_km; } return [t, d]; };
      const all = Array.from({ length: 24 }, (_, hh) => seg(hh)[0]), [t, d] = seg(h);
      $('tOut').innerHTML = `<div><b class="mono">${t.toFixed(1)} min</b> · ${d.toFixed(1)} km <small>(free-flow ${Math.min(...all).toFixed(1)} min)</small></div>${A.bar(all, { labels: all.map((_, k) => A.pad(k)), color: (v, k) => (k === h ? A.C.bad : A.C.cyan), label: 'travel time by hour' })}`; };
    fill(); $('tRoute').onchange = fill; $('tFrom').onchange = calc; $('tTo').onchange = calc;
  });

  /* ------------------------------------------------------------ DT-02 */
  let dayType = 'weekday';
  A.reg('util', 'transit', 't_util', () => {
    const h = A.hour, RH = A.routeHour[dayType];
    const rows = Object.keys(A.routes).map((r) => ({ r, d: RH[r][h], pk: RH[r].reduce((m, x, i) => (x.lr != null && x.lr > m[0] ? [x.lr, i] : m), [0, 0]) })).sort((a, b) => (b.d.lr ?? -1) - (a.d.lr ?? -1));
    rows.forEach(({ r, d }) => routeLines[r].setStyle({ color: A.rampLoad(d.lr), weight: 6, opacity: d.lr == null ? 0.25 : 0.95 }));
    const over = rows.filter((x) => x.d.lr >= 1).length, sel = A.sel?.type === 'route' ? A.sel.id : rows[0].r;
    $('toolPanel').innerHTML = `<h3>DT-02 · Utilization · ${A.hh(h)}</h3>
      <div class="row2"><div class="seg"><button data-dt="weekday" class="${dayType === 'weekday' ? 'on' : ''}">weekday</button><button data-dt="weekend" class="${dayType === 'weekend' ? 'on' : ''}">weekend</button></div><span class="badge ${over ? 'bad' : 'ok'}">${over} over capacity</span></div>
      <table class="t"><thead><tr><th>route</th><th class="num">trips</th><th class="num">val</th><th class="num">ratio</th><th class="num">peak</th></tr></thead><tbody>
      ${rows.map(({ r, d, pk }) => `<tr class="click" data-id="${r}"><td><b style="color:${A.routes[r].color}">●</b> ${r}</td><td class="num">${d.trips}</td><td class="num">${A.fmt(d.val)}</td><td class="num"><span class="badge ${d.lr >= 1 ? 'bad' : d.lr >= 0.8 ? 'warn' : 'ok'}">${d.lr ?? '–'}</span></td><td class="num">${pk[0].toFixed(2)} @${A.pad(pk[1])}</td></tr>`).join('')}</tbody></table>
      <h3>${sel} · ${A.esc(A.routes[sel].name)}</h3><div id="uChart"></div>
      <div class="note">Ratio = validations × 0.9 / (trips × vehicle capacity). Without boarding/alighting data the load is an estimate (improves with DT-05).</div><button id="csv2">⬇ CSV</button>`;
    $('uChart').innerHTML = A.bar(RH[sel].map((x) => x.lr || 0), { labels: RH[sel].map((_, i) => A.pad(i)), ref: 1, refLabel: 'capacity', color: (v, i) => (i === h ? A.C.ink : A.rampLoad(v)), max: 1.2 });
    legend(`<b>demand / capacity</b><div class="row"><i style="background:#34d399"></i>&lt;0.6</div><div class="row"><i style="background:#fbbf24"></i>0.6–0.8</div><div class="row"><i style="background:#f97316"></i>0.8–1.0</div><div class="row"><i style="background:#fb7185"></i>≥1.0 overloaded</div>`);
    $('toolPanel').querySelectorAll('[data-dt]').forEach((b) => (b.onclick = () => { dayType = b.dataset.dt; render(); }));
    rowClick('tr.click', (d) => { A.select({ type: 'route', id: d.id }); map.fitBounds(routeLines[d.id].getBounds(), { padding: [80, 80] }); render(); });
    csvBtn('csv2', `utilization_h${h}.csv`, ['route', 'trips', 'validations', 'load_ratio'], rows.map(({ r, d }) => [r, d.trips, d.val, d.lr]));
  });

  /* ------------------------------------------------------------ DT-03 */
  let sigma = 1.0, scope = 'hour';
  A.reg('cluster', 'transit', 't_cluster', () => {
    const h = A.hour, ids = Object.keys(A.stopHour), val = (id) => (scope === 'hour' ? A.stopHour[id][h] : A.stopHour[id].reduce((a, b) => a + b, 0));
    const v = ids.map(val), mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), thr = mean + sigma * sd;
    const hot = ids.filter((id) => val(id) >= thr), par = Object.fromEntries(hot.map((i) => [i, i])), find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
    hot.forEach((a, i) => hot.slice(i + 1).forEach((b) => { if (A.hav(A.ll(a), A.ll(b)) < 2.0) par[find(a)] = find(b); }));
    const groups = {}; hot.forEach((id) => (groups[find(id)] = groups[find(id)] || []).push(id));
    const trips = (id) => Object.keys(A.routeStops).filter((r) => A.routeStops[r].includes(id)).reduce((a, r) => a + wd()[r][h].trips, 0);
    const cl = Object.values(groups).map((g) => { const tot = g.reduce((a, id) => a + val(id), 0), lat = g.reduce((a, id) => a + A.stops[id].lat * val(id), 0) / tot, lon = g.reduce((a, id) => a + A.stops[id].lon * val(id), 0) / tot;
      return { g, tot, lat, lon, rad: Math.max(400, ...g.map((id) => A.hav([lat, lon], A.ll(id)) * 1000 + 300)), top: g.slice().sort((a, b) => val(b) - val(a))[0], trips: g.reduce((a, id) => a + trips(id), 0) }; }).sort((a, b) => b.tot - a.tot);
    cl.forEach((c, i) => { L.circle([c.lat, c.lon], { radius: c.rad, color: A.C.hot, weight: 2, fillColor: A.C.hot, fillOpacity: 0.16 }).addTo(toolLayer).bindTooltip(`#${i + 1} · ${A.stops[c.top].name}`);
      L.marker([c.lat, c.lon], { interactive: false, icon: L.divIcon({ className: '', html: `<div style="background:#f97316;color:#04121c;border-radius:50%;width:20px;height:20px;text-align:center;font:700 11px/20px Inter;transform:translate(-10px,-10px)">${i + 1}</div>` }) }).addTo(toolLayer); });
    hot.forEach((id) => stopMarkers[id].setStyle({ fillColor: A.C.hot, fillOpacity: 1 }));
    $('toolPanel').innerHTML = `<h3>DT-03 · Demand clusters · ${scope === 'hour' ? A.hh(h) : '24h'}</h3>
      <div class="row2"><div class="seg"><button data-sc="hour" class="${scope === 'hour' ? 'on' : ''}">${A.hh(h)}</button><button data-sc="day" class="${scope === 'day' ? 'on' : ''}">24h</button></div><label class="f" style="flex:1">σ ≥ <b id="sgv" class="mono">${sigma.toFixed(1)}</b><input type="range" id="sg" min="0.3" max="3" step="0.1" value="${sigma}"></label></div>
      <div class="cards"><div class="c"><b>${hot.length}</b><small>high-demand stops</small></div><div class="c"><b>${cl.length}</b><small>clusters</small></div><div class="c"><b>${A.fmt(thr)}</b><small>threshold</small></div></div>
      <table class="t"><thead><tr><th>#</th><th>top stop</th><th class="num">stops</th><th class="num">val</th><th class="num">trips/h</th></tr></thead><tbody>
      ${cl.map((c, i) => `<tr class="click" data-i="${i}"><td>${i + 1}</td><td>${A.esc(A.stops[c.top].name)}</td><td class="num">${c.g.length}</td><td class="num">${A.fmt(c.tot)}</td><td class="num">${c.trips}</td></tr>`).join('') || '<tr><td colspan="5">No clusters</td></tr>'}</tbody></table>
      <div class="note">High-demand stops within 2 km merge into one cluster. “trips/h” sums trips serving the cluster's stops in the same hour (overlap).</div><button id="csv3">⬇ CSV</button>`;
    $('toolPanel').querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => { scope = b.dataset.sc; render(); }));
    $('sg').oninput = (e) => { sigma = +e.target.value; render(); };
    rowClick('tr.click', (d) => { const c = cl[+d.i]; map.setView([c.lat, c.lon], 13); A.select({ type: 'stop', id: c.top }); });
    csvBtn('csv3', 'demand_clusters.csv', ['rank', 'top_stop', 'stops', 'validations', 'trips_per_h'], cl.map((c, i) => [i + 1, A.stops[c.top].name, c.g.length, c.tot, c.trips]));
    legend('<b>DT-03</b><div class="row"><i style="background:#f97316"></i> high-demand stop / cluster</div>');
  });

  /* ------------------------------------------------------------ DT-04 */
  let mode4 = 'overlap';
  A.reg('route', 'transit', 't_route', () => {
    const OV = A.rows('route_overlap'), DG = A.rows('route_diag'), TR = A.rows('transfers').slice(0, 12), C = A.D.eda.chaining; let body = '';
    if (mode4 === 'overlap') {
      body = `<table class="t"><thead><tr><th>A</th><th>B</th><th class="num">km</th><th class="num">%</th></tr></thead><tbody>${OV.slice(0, 14).map((o) => `<tr class="click" data-a="${o.route_a}" data-b="${o.route_b}"><td>${o.route_a}</td><td>${o.route_b}</td><td class="num">${o.shared_km}</td><td class="num"><span class="badge ${o.overlap_pct > 60 ? 'bad' : 'warn'}">${o.overlap_pct}</span></td></tr>`).join('')}</tbody></table>`;
      const pairs = (r) => { const q = A.routeStops[r], o = new Set(); q.slice(1).forEach((s, i) => o.add([q[i], s].sort().join('|'))); return o; };
      OV.slice(0, 14).forEach((o) => { const pa = pairs(o.route_a), pb = pairs(o.route_b); [...pa].filter((x) => pb.has(x)).forEach((k) => L.polyline(k.split('|').map(A.ll), { color: A.C.hot, weight: 10, opacity: 0.5, interactive: false }).addTo(toolLayer)); });
      legend('<b>DT-04</b><div class="row"><i style="background:#f97316"></i> shared corridor (≥2 routes)</div>');
    } else if (mode4 === 'back') {
      body = `<table class="t"><thead><tr><th>route</th><th class="num">km</th><th class="num">disp.</th><th class="num">circuity</th><th class="num">back km</th></tr></thead><tbody>${DG.slice().sort((a, b) => b.backtrack_km - a.backtrack_km).map((d) => `<tr class="click" data-r="${d.route_id}"><td>${d.route_id} ${d.backtrack_flag ? '<span class="badge bad">backtrack</span>' : ''}</td><td class="num">${d.length_km}</td><td class="num">${d.displacement_km}</td><td class="num">${d.circuity}</td><td class="num">${d.backtrack_km}</td></tr>`).join('')}</tbody></table>`;
      DG.filter((d) => d.backtrack_flag).forEach((d) => routeLines[d.route_id].setStyle({ color: A.C.bad, weight: 6, opacity: 1, dashArray: '8 6' }));
      legend('<b>DT-04</b><div class="row"><i style="background:#fb7185"></i> backtracking route</div>');
    } else {
      const mx = TR[0]?.transfers_est || 1;
      TR.forEach((t) => { const s = A.stops[t.stop_id]; if (s) L.circleMarker([s.lat, s.lon], { radius: 6 + 22 * Math.sqrt(t.transfers_est / mx), color: A.C.violet, fillColor: A.C.violet, fillOpacity: 0.35, weight: 2 }).addTo(toolLayer).bindTooltip(`${s.name}: ${A.fmt(t.transfers_est)}`); });
      body = `<div class="cards"><div class="c"><b>${C.avg_transfers}</b><small>transfers / journey</small></div><div class="c"><b>${A.fmt(C.transfers_0)}</b><small>direct (sample)</small></div><div class="c"><b>${A.fmt(C.transfers_1)}</b><small>1 transfer</small></div></div>
        <table class="t"><thead><tr><th>transfer hotspot</th><th>city</th><th class="num">est./day</th></tr></thead><tbody>${TR.map((t) => `<tr class="click" data-s="${t.stop_id}"><td>${A.esc(A.stops[t.stop_id]?.name || t.stop_id)}</td><td>${A.stops[t.stop_id]?.city || ''}</td><td class="num">${A.fmt(t.transfers_est)}</td></tr>`).join('')}</tbody></table>`;
      legend('<b>DT-04</b><div class="row"><i style="background:#8b5cf6"></i> transfer hotspot</div>');
    }
    $('toolPanel').innerHTML = `<h3>DT-04 · Route diagnostics & transfers</h3><div class="seg" style="margin-bottom:9px">${[['overlap', 'Overlap'], ['back', 'Backtracking'], ['xfer', 'Transfers']].map(([k, l]) => `<button data-m="${k}" class="${mode4 === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}
      <div class="note">Overlap = shared consecutive stop pairs. Backtracking = segments heading >100° away from the route's main direction. Transfer = same card boards another route within 45 min near the estimated alighting stop.</div>`;
    $('toolPanel').querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode4 = b.dataset.m; render(); }));
    rowClick('tr.click', (d) => { if (d.a) map.fitBounds(L.featureGroup([routeLines[d.a], routeLines[d.b]]).getBounds(), { padding: [80, 80] }); if (d.r) { A.select({ type: 'route', id: d.r }); map.fitBounds(routeLines[d.r].getBounds(), { padding: [80, 80] }); } if (d.s) { map.setView(A.ll(d.s), 13); A.select({ type: 'stop', id: d.s }); } });
  });

  /* ------------------------------------------------------------ DT-05 */
  A.reg('od', 'transit', 't_od', () => {
    const OD = A.rows('od_zone'), C = A.D.eda.chaining, Z = A.D.meta.zones, tot = {};
    OD.forEach((o) => { tot[o.origin_zone] = (tot[o.origin_zone] || 0) + o.trips_est; tot[o.dest_zone] = (tot[o.dest_zone] || 0) + o.trips_est; });
    const zs = Object.keys(tot).sort((a, b) => tot[b] - tot[a]).slice(0, 10), m = {}; OD.forEach((o) => (m[o.origin_zone + '|' + o.dest_zone] = o.trips_est));
    const mx = Math.max(...OD.map((o) => o.trips_est), 1), k = A.kFor(A.user.role);
    const cell = (a, b) => { const v = m[a + '|' + b] || 0; if (!v) return '<td></td>'; if (v < k) return `<td title="masked">&lt;${k}</td>`; const t = Math.sqrt(v / mx); return `<td style="background:rgba(34,211,238,${0.1 + 0.8 * t});color:${t > .5 ? '#04121c' : '#e6edf7'}" title="${a} → ${b}: ${v}">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</td>`; };
    OD.slice(0, 20).forEach((o) => { if (o.origin_zone === o.dest_zone || !Z[o.origin_zone] || !Z[o.dest_zone]) return; L.polyline([Z[o.origin_zone], Z[o.dest_zone]], { color: A.C.cyan, weight: 1 + 9 * Math.sqrt(o.trips_est / mx), opacity: 0.55 }).addTo(toolLayer).bindTooltip(`${o.origin_zone} → ${o.dest_zone}: ${A.fmt(o.trips_est)}`, { sticky: true }); });
    $('toolPanel').innerHTML = `<h3>DT-05 · Origin–Destination (reconstructed)</h3>
      <div class="cards"><div class="c"><b>${A.fmt(C.journeys)}</b><small>journeys (sample)</small></div><div class="c ok"><b>${C.alight_exact_pct}%</b><small>alight stop = truth</small></div><div class="c ok"><b>${C.alight_zone_pct}%</b><small>alight zone = truth</small></div><div class="c"><b>×${C.expansion}</b><small>expansion</small></div></div>
      <div style="overflow:auto"><table class="mx"><tr><th></th>${zs.map((z) => `<th title="${z}">${z.slice(0, 5)}</th>`).join('')}</tr>${zs.map((a) => `<tr><th title="${a}">${a.slice(0, 6)}</th>${zs.map((b) => cell(a, b)).join('')}</tr>`).join('')}</table></div>
      <small>rows = origin, columns = destination (est. trips/day, top-10 zones)</small>
      <div class="note">Boarding is known per validation; the alighting stop is the stop on the route nearest the same card's <b>next boarding</b> (last trip → first trip of the day), accepted within 600 m. Accuracy is measured against synthetic ground truth; on real data accept on methodology.</div><button id="csv5">⬇ CSV</button>`;
    csvBtn('csv5', 'od_matrix.csv', ['origin_zone', 'dest_zone', 'trips_est'], OD.map((o) => [o.origin_zone, o.dest_zone, o.trips_est]));
    legend('<b>DT-05</b><div class="row"><i style="background:#22d3ee"></i> top O/D flows</div>');
  });

  A.initMap = () => {
    initMap();
    A.on('select', renderChip); A.on('lang', render); A.on('role', render);
    $('hour').oninput = (e) => { A.hour = +e.target.value; render(); A.emit('hour', A.hour); };
    $('btnFitCity') && ($('btnFitCity').onclick = () => map.fitBounds(CITY));
    A.fitCity = () => map.fitBounds(CITY);
    setTimeout(render, 0);
  };
  A.stopMarkers = stopMarkers; A.routeLines = routeLines;
})();
