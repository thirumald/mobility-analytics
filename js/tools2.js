/* Additional solution modules on the same data platform:
   fleet & EV energy, emissions, event surge planner, safety, what-if scenario planner, heat & dust resilience, accessibility & equity */
(function () {
  const M = A.M, $ = M.$, L = window.L;
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  const nearestDepot = (ll) => A.rows('chargers').reduce((m, c) => { const d = A.hav(ll, [c.lat, c.lon]); return d < m[0] ? [d, c.depot] : m; }, [1e9, ''])[1];
  const depots = () => { const o = {}; A.chargers.forEach((c) => ((o[c.depot] = o[c.depot] || { name: c.depot, lat: c.lat, lon: c.lon, ch: [] }).ch.push(c))); return Object.values(o); };

  /* ======================================================= FLEET & EV */
  A.reg('fleet', 'energy', 't_fleet', () => {
    const h = A.hour, F = A.fleet, ev = F.filter((f) => f.fuel_type === 'electric'), D = depots();
    const pos = (f) => { if (f.status === 'depot' || f.status === 'charging' || f.status === 'maintenance') { const d = D.find((x) => x.name === nearestDepot(A.ll(A.routeStops[f.route_id][0]))); return [d.lat + (hash(f.vehicle_id) - .5) * .004, d.lon + (hash(f.vehicle_id + 'x') - .5) * .004]; } const seq = A.routeStops[f.route_id]; return A.ll(seq[Math.floor(hash(f.vehicle_id) * seq.length)]); };
    const col = (f) => (f.fuel_type === 'electric' ? (f.soc_pct < 25 ? A.C.bad : f.soc_pct < 50 ? A.C.warn : A.C.ok) : f.fuel_type === 'cng' ? A.C.violet : '#94a3b8');
    F.forEach((f) => { const m = L.circleMarker(pos(f), { radius: f.fuel_type === 'electric' ? 6 : 5, color: A.C.halo, weight: 1.5, fillColor: col(f), fillOpacity: 1 }).addTo(M.toolLayer); m.bindTooltip(`${f.vehicle_id} · ${f.fuel_type}${f.soc_pct != null ? ' · SOC ' + f.soc_pct + '%' : ''}`); m.on('click', (e) => { L.DomEvent.stopPropagation(e); M.popup(e.latlng, { type: 'vehicle', id: f.vehicle_id }); }); });
    const dutil = (d) => d.ch.reduce((a, c) => a + A.chargerHour[c.charger_id][h].util, 0) / d.ch.length, dkw = (d) => d.ch.reduce((a, c) => a + A.chargerHour[c.charger_id][h].kwh, 0);
    D.forEach((d) => L.circleMarker([d.lat, d.lon], { radius: 12, color: A.C.cyan, weight: 2, fillColor: A.C.cyan, fillOpacity: .15 + .5 * dutil(d) / 100 }).addTo(M.toolLayer).bindTooltip(`${d.name}: ${dutil(d).toFixed(0)}% · ${dkw(d).toFixed(0)} kW`));
    const grid = Array.from({ length: 24 }, (_, hh) => A.chargers.reduce((a, c) => a + A.chargerHour[c.charger_id][hh].kwh, 0));
    const low = ev.filter((f) => f.status === 'in_service' && f.soc_pct < 25), weak = F.filter((f) => f.health_score < 65);
    const avgSoc = ev.reduce((a, f) => a + f.soc_pct, 0) / ev.length, by = { electric: ev.length, diesel: F.filter((f) => f.fuel_type === 'diesel').length, cng: F.filter((f) => f.fuel_type === 'cng').length };
    $('toolPanel').innerHTML = `<h3>Fleet & EV energy · ${A.hh(h)}</h3>
      <div class="cards"><div class="c"><b>${F.length}</b><small>vehicles</small></div><div class="c ok"><b>${Math.round(100 * by.electric / F.length)}%</b><small>electric</small></div><div class="c"><b>${avgSoc.toFixed(0)}%</b><small>avg EV SOC</small></div><div class="c ${low.length ? 'bad' : 'ok'}"><b>${low.length}</b><small>EV in service &lt;25% SOC</small></div></div>
      <h3>Charging load (kW) · peak ${Math.max(...grid).toFixed(0)} kW</h3>${A.bar(grid, { labels: grid.map((_, i) => A.pad(i)), color: (v, i) => (i === h ? '#fff' : A.C.cyan), label: 'charging load' })}
      <h3>Depots</h3><table class="t"><thead><tr><th>depot</th><th class="num">chargers</th><th class="num">util</th><th class="num">kW now</th></tr></thead><tbody>${D.map((d) => `<tr class="click" data-lat="${d.lat}" data-lon="${d.lon}"><td>${d.name}</td><td class="num">${d.ch.length}</td><td class="num"><span class="badge ${dutil(d) > 85 ? 'warn' : 'ok'}">${dutil(d).toFixed(0)}%</span></td><td class="num">${dkw(d).toFixed(0)}</td></tr>`).join('')}</tbody></table>
      <h3>Needs attention (${low.length + weak.length})</h3><table class="t"><tbody>${[...low.map((f) => [f, 'low SOC ' + f.soc_pct + '%']), ...weak.map((f) => [f, 'health ' + f.health_score])].slice(0, 9).map(([f, why]) => `<tr class="click" data-v="${f.vehicle_id}"><td>${f.vehicle_id}</td><td>${f.fuel_type}</td><td><span class="badge warn">${why}</span></td></tr>`).join('')}</tbody></table>
      <div class="rec"><b>Insight</b> · Overnight charging saturates depots 00–04 h (${(Math.max(...grid.slice(0, 5)) / 1000).toFixed(1)} MW). Shifting 25% of sessions to 10–14 h cuts the peak and aligns with solar supply.</div>`;
    M.legend(`<b>Vehicles</b><div class="row"><i style="background:#34d399"></i>EV ≥50% SOC</div><div class="row"><i style="background:#fbbf24"></i>EV 25–50%</div><div class="row"><i style="background:#fb7185"></i>EV &lt;25%</div><div class="row"><i style="background:#94a3b8"></i>diesel</div><div class="row"><i style="background:#8b5cf6"></i>CNG</div>`);
    M.rowClick('tr.click', (d) => { if (d.v) { A.select({ type: 'vehicle', id: d.v }); } else M.map.setView([+d.lat, +d.lon], 14); });
    M.map.fitBounds([[24.30, 54.30], [24.55, 54.70]]);
  });

  /* ======================================================= EMISSIONS */
  let evTarget = null;
  A.reg('emis', 'energy', 't_emis', () => {
    const E = A.emis, EF = A.D.meta.ef, curEv = A.fleet.filter((f) => f.fuel_type === 'electric').length / A.fleet.length;
    if (evTarget == null) evTarget = Math.round(curEv * 100);
    const tot = E.reduce((a, e) => a + e.co2_t_day, 0), base = E.reduce((a, e) => a + e.co2_baseline_t_day, 0), km = E.reduce((a, e) => a + e.km_day, 0);
    const scen = E.reduce((a, e) => { const r = A.routes[e.route_id]; const evs = r.city === 'Intercity' ? e.ev_share : evTarget / 100; const other = r.city === 'Al Ain' ? EF.cng : EF.diesel; return a + e.km_day * (evs * EF.electric + (1 - evs) * other) / 1000; }, 0);
    E.forEach((e) => M.routeLines[e.route_id].setStyle({ color: e.co2_t_day / (e.km_day / 1000 || 1) > .9 ? A.C.bad : e.co2_t_day / (e.km_day / 1000 || 1) > .6 ? A.C.warn : A.C.ok, weight: 3 + 9 * e.co2_t_day / Math.max(...E.map((x) => x.co2_t_day)), opacity: .9 }));
    const mx = Math.max(...E.map((e) => e.co2_saved_t_day), .01);
    $('toolPanel').innerHTML = `<h3>Sustainability · CO₂ & electrification</h3>
      <div class="cards"><div class="c"><b>${tot.toFixed(1)} t</b><small>CO₂ / day (tank-to-wheel + grid)</small></div><div class="c ok"><b>${(base - tot).toFixed(1)} t</b><small>saved vs all-diesel</small></div><div class="c"><b>${A.fmt(km)}</b><small>bus-km / day</small></div><div class="c"><b>${(tot * 1000 / km).toFixed(2)}</b><small>kg CO₂ / km</small></div></div>
      <h3>Electrification what-if (city routes)</h3>
      <label class="f">EV share target <b class="mono" id="evv">${evTarget}%</b><input type="range" id="evs" min="0" max="100" value="${evTarget}"></label>
      <div class="rec"><b>${scen.toFixed(1)} t/day</b> at ${evTarget}% EV → <b>${(tot - scen >= 0 ? '−' : '+') + Math.abs(tot - scen).toFixed(1)} t/day</b> vs today (${(Math.abs(tot - scen) * 365).toFixed(0)} t / year).</div>
      <h3>CO₂ saved by route (t/day)</h3><table class="t"><tbody>${E.slice().sort((a, b) => b.co2_saved_t_day - a.co2_saved_t_day).map((e) => `<tr class="click" data-id="${e.route_id}"><td>${e.route_id}</td><td>${Math.round(e.ev_share * 100)}% EV</td><td style="width:42%"><div class="bar-h"><i style="width:${100 * e.co2_saved_t_day / mx}%;background:${A.C.ok}"></i></div></td><td class="num">${e.co2_saved_t_day}</td></tr>`).join('')}</tbody></table>
      <div class="note">Factors (kg CO₂/km): diesel ${EF.diesel}, CNG ${EF.cng}, electric ${EF.electric} (UAE grid mix, illustrative). Replace with measured energy use.</div>`;
    $('evs').oninput = (e) => { evTarget = +e.target.value; A.renderTool(); };
    M.rowClick('tr.click', (d) => { A.select({ type: 'route', id: d.id }); M.map.fitBounds(M.routeLines[d.id].getBounds(), { padding: [80, 80] }); });
    M.legend('<b>Route CO₂ intensity</b><div class="row"><i style="background:#34d399"></i>low</div><div class="row"><i style="background:#fbbf24"></i>medium</div><div class="row"><i style="background:#fb7185"></i>high (diesel)</div><small>line width = t/day</small>');
  });

  /* ======================================================= EVENTS */
  let evSel = 'EV1';
  A.reg('events', 'ops', 't_events', () => {
    const e = A.events.find((x) => x.event_id === evSel), dm = A.eventDemand[evSel], hs = A.stops[e.venue_stop], serve = (dm.find((x) => x.routes)?.routes || '').split(',').filter(Boolean);
    serve.forEach((r) => M.routeLines[r] && M.routeLines[r].setStyle({ weight: 7, opacity: 1 }));
    L.circle(A.ll(e.venue_stop), { radius: 1500, color: A.C.warn, weight: 2, fillColor: A.C.warn, fillOpacity: .12 }).addTo(M.toolLayer);
    L.circleMarker(A.ll(e.venue_stop), { radius: 9, color: A.C.halo, weight: 2, fillColor: A.C.warn, fillOpacity: 1 }).addTo(M.toolLayer).bindTooltip(e.venue, { permanent: true, direction: 'top' });
    const extra = dm.map((x) => x.extra), gap = dm.map((x) => x.gap), pk = Math.max(...gap), ph = gap.indexOf(pk), buses = Math.ceil(pk / 2), tot = extra.reduce((a, b) => a + b, 0);
    const dep = nearestDepot(A.ll(e.venue_stop)), active = dm.map((x, i) => (x.extra ? i : -1)).filter((i) => i >= 0);
    $('toolPanel').innerHTML = `<h3>Event surge planner</h3>
      <div class="row2"><select id="evSel" style="flex:1">${A.events.map((x) => `<option value="${x.event_id}" ${x.event_id === evSel ? 'selected' : ''}>${x.name}</option>`).join('')}</select></div>
      <div class="cards"><div class="c"><b>${A.fmt(e.attendance)}</b><small>attendance · ${e.event_date}</small></div><div class="c"><b>${Math.round(e.transit_share * 100)}%</b><small>transit share</small></div><div class="c warn"><b>${A.fmt(tot)}</b><small>extra rides</small></div><div class="c ${pk ? 'bad' : 'ok'}"><b>${pk}</b><small>peak trip gap @${A.hh(ph)}</small></div></div>
      <h3>Extra demand by hour</h3>${A.bar(extra, { labels: extra.map((_, i) => A.pad(i)), color: (v, i) => (i === A.hour ? A.C.ink : A.C.warn), label: 'extra demand' })}
      <h3>Trip gap (needed − spare capacity)</h3>${A.bar(gap, { labels: gap.map((_, i) => A.pad(i)), color: (v, i) => (v > 0 ? A.C.bad : A.C.ok), label: 'trip gap' })}
      <div class="rec"><b>Recommendation</b> · Pre-position <b>${buses}</b> standby buses at <b>${dep}</b> for ${A.hh(active[0])}–${A.hh(Math.min(23, active[active.length - 1]))}; add shuttle loops on <b>${serve.join(', ') || '—'}</b> and hold egress departures at ${A.hh(ph)}. Estimated ${A.fmt(Math.round(pk * 80 * .85))} rides moved off-road at the peak hour.</div>
      <div class="note">Mode share and ingress/egress curves are placeholders; calibrate with ticketing and past-event validations.</div>`;
    $('evSel').onchange = (x) => { evSel = x.target.value; A.renderTool(); };
    M.map.setView(A.ll(e.venue_stop), 12.5);
    M.legend('<b>Event</b><div class="row"><i style="background:#fbbf24"></i>venue catchment (1.5 km)</div><div class="row"><i style="background:var(--txt)"></i>serving routes</div>');
  });

  /* ======================================================= SAFETY */
  let sType = 'all'; const ack = new Set();
  A.reg('safety', 'ops', 't_safety', () => {
    const I = A.incidents.filter((i) => sType === 'all' || i.type === sType), types = [...new Set(A.incidents.map((i) => i.type))], byH = Array.from({ length: 24 }, (_, h) => I.filter((i) => i.hour === h).length);
    I.forEach((i) => L.circleMarker(A.ll(i.stop_id), { radius: 4 + 2.5 * i.severity, color: A.C.halo, weight: 1, fillColor: i.severity >= 3 ? A.C.bad : i.severity === 2 ? A.C.warn : A.C.cyan, fillOpacity: i.hour === A.hour ? 1 : .35 }).addTo(M.toolLayer).bindTooltip(`${i.type.replace(/_/g, ' ')} · S${i.severity} · ${A.hh(i.hour)}`));
    const now = I.filter((i) => i.hour === A.hour), open = I.filter((i) => i.status === 'open').length;
    $('toolPanel').innerHTML = `<h3>Safety & incidents</h3>
      <div class="row2"><select id="sT" style="flex:1"><option value="all">All types (${A.incidents.length})</option>${types.map((t) => `<option value="${t}" ${t === sType ? 'selected' : ''}>${t.replace(/_/g, ' ')} (${A.incidents.filter((i) => i.type === t).length})</option>`).join('')}</select></div>
      <div class="cards"><div class="c"><b>${I.length}</b><small>incidents (24h)</small></div><div class="c ${open > 12 ? 'warn' : ''}"><b>${open}</b><small>open</small></div><div class="c bad"><b>${I.filter((i) => i.severity >= 3).length}</b><small>severity 3</small></div></div>
      <h3>By hour</h3>${A.bar(byH, { labels: byH.map((_, i) => A.pad(i)), color: (v, i) => (i === A.hour ? A.C.ink : A.C.violet), label: 'incidents by hour' })}
      <h3>${A.hh(A.hour)} · ${now.length} incident(s)</h3>
      <table class="t"><tbody>${now.slice(0, 8).map((i) => `<tr class="click" data-s="${i.stop_id}" data-i="${i.incident_id}"><td><span class="badge ${i.severity >= 3 ? 'bad' : i.severity === 2 ? 'warn' : ''}">S${i.severity}</span></td><td>${i.type.replace(/_/g, ' ')}</td><td>${i.route_id}</td><td>${ack.has(i.incident_id) ? '<span class="badge ok">ack</span>' : '<button data-ack="' + i.incident_id + '">Acknowledge</button>'}</td></tr>`).join('') || '<tr><td>No incidents this hour</td></tr>'}</tbody></table>
      <div class="rec"><b>Insight</b> · Vision-detected bus-lane violations and stopped vehicles cluster in the morning peak on corridors flagged in DT-01; enforce there first. Sources: vision, telematics, AFC, depot, IoT, driver app.</div>`;
    $('sT').onchange = (e) => { sType = e.target.value; A.renderTool(); };
    $('toolPanel').querySelectorAll('[data-ack]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); ack.add(b.dataset.ack); A.audit.append('action', 'acknowledge ' + b.dataset.ack, '', 'incident acknowledged', 'OK'); A.renderTool(); }));
    M.rowClick('tr.click', (d) => M.map.setView(A.ll(d.s), 14));
    M.legend('<b>Incidents</b><div class="row"><i style="background:#fb7185"></i>severity 3</div><div class="row"><i style="background:#fbbf24"></i>severity 2</div><div class="row"><i style="background:#22d3ee"></i>severity 1</div><small>bright = current hour</small>');
  });

  /* ======================================================= SCENARIO */
  const sc = { route: 'T5', from: 6, to: 19, pct: 30, cap: 80, ev: 0 };
  A.reg('scen', 'ops', 't_scen', () => {
    const r = A.routes[sc.route], RH = A.routeHour.weekday[sc.route], len = A.rows('route_diag').find((d) => d.route_id === sc.route).length_km, EF = A.D.meta.ef;
    const base = RH.map((x) => x.lr), neu = RH.map((x, h) => (x.trips && h >= sc.from && h <= sc.to ? +(x.val * .9 / (x.trips * (1 + sc.pct / 100) * sc.cap)).toFixed(3) : x.trips ? +(x.val * .9 / (x.trips * sc.cap)).toFixed(3) : null));
    const addTrips = RH.reduce((a, x, h) => a + (h >= sc.from && h <= sc.to ? x.trips * sc.pct / 100 : 0), 0), km = addTrips * len;
    const evShare = sc.ev / 100, cost = km * (evShare * 5.1 + (1 - evShare) * 7.2), co2 = km * (evShare * EF.electric + (1 - evShare) * EF.diesel) / 1000;
    const pb = Math.max(...base.filter((x) => x != null)), pn = Math.max(...neu.filter((x) => x != null)), still = neu.map((v, h) => (v >= 1 ? h : -1)).filter((h) => h >= 0);
    M.routeLines[sc.route].setStyle({ weight: 8, color: A.C.cyan, opacity: 1 }); M.map.fitBounds(M.routeLines[sc.route].getBounds(), { padding: [90, 90] });
    $('toolPanel').innerHTML = `<h3>What-if planner</h3>
      <div class="form">
        <label class="f">Route<select id="sRoute">${Object.keys(A.routes).map((x) => `<option ${x === sc.route ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="f">Vehicle capacity<select id="sCap">${[60, 80, 110].map((c) => `<option ${c === sc.cap ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="f">From hour <b class="mono">${sc.from}</b><input type="range" id="sFrom" min="0" max="23" value="${sc.from}"></label>
        <label class="f">To hour <b class="mono">${sc.to}</b><input type="range" id="sTo" min="0" max="23" value="${sc.to}"></label>
        <label class="f">Extra trips <b class="mono">${sc.pct > 0 ? '+' : ''}${sc.pct}%</b><input type="range" id="sPct" min="-30" max="100" value="${sc.pct}"></label>
        <label class="f">EV share of extra trips <b class="mono">${sc.ev}%</b><input type="range" id="sEv" min="0" max="100" value="${sc.ev}"></label></div>
      <div class="cards"><div class="c ${pb >= 1 ? 'bad' : ''}"><b>${pb.toFixed(2)}</b><small>peak ratio before</small></div><div class="c ${pn >= 1 ? 'bad' : 'ok'}"><b>${pn.toFixed(2)}</b><small>peak ratio after</small></div><div class="c"><b>${A.fmt(km)}</b><small>extra km / day</small></div><div class="c"><b>AED ${A.fmt(cost)}</b><small>extra cost / day</small></div><div class="c"><b>${co2.toFixed(2)} t</b><small>extra CO₂ / day</small></div></div>
      ${A.line([{ name: 'before', color: A.C.mute, vals: base.map((v) => v || 0) }, { name: 'after', color: A.C.cyan, vals: neu.map((v) => v || 0) }], { labels: base.map((_, i) => A.pad(i)), max: 1.5, label: 'demand/capacity before vs after' })}
      <small><span style="color:var(--mut)">━</span> before · <span style="color:#22d3ee">━</span> after · capacity = 1.0</small>
      <div class="rec">${still.length ? `<b>Still overloaded</b> at ${still.map(A.hh).join(', ')} — increase frequency further or use larger vehicles.` : `<b>Resolved</b> · no hour exceeds capacity with this plan.`} Cost model: AED 7.2/km diesel, 5.1/km EV (illustrative).</div>`;
    const bind = (id, key, num = true) => ($(id).oninput = $(id).onchange = (e) => { sc[key] = num ? +e.target.value : e.target.value; A.renderTool(); });
    bind('sRoute', 'route', false); bind('sCap', 'cap'); bind('sFrom', 'from'); bind('sTo', 'to'); bind('sPct', 'pct'); bind('sEv', 'ev');
    M.legend('<b>What-if</b><div class="row"><i style="background:#22d3ee"></i>selected route</div>');
  });

  /* ======================================================= HEAT & DUST */
  let scen = 'summer';
  A.reg('heat', 'resil', 't_heat', () => {
    const W = A.weather[scen], h = A.hour;
    const hf = (hh) => (scen === 'winter' ? 0.05 : Math.max(0, Math.min(1.5, (W[hh].hi - 32) / 14)) + (scen === 'dust_storm' ? 0.5 * (W[hh].vis < 3 ? 1 : 0) : 0));
    const expo = (id, hh) => A.stopHour[id][hh] * 0.35 * hf(hh) * (A.stops[id].shelter_ac ? 0.25 : 1);
    const ids = Object.keys(A.stopHour), net = Array.from({ length: 24 }, (_, hh) => ids.reduce((a, id) => a + expo(id, hh), 0));
    const rank = ids.map((id) => [id, expo(id, h)]).sort((a, b) => b[1] - a[1]), noAc = rank.filter(([id]) => !A.stops[id].shelter_ac);
    const mx = rank[0][1] || 1;
    ids.forEach((id) => { const e = expo(id, h); M.stopMarkers[id].setStyle({ radius: 3 + 11 * Math.sqrt(e / mx), fillColor: A.stops[id].shelter_ac ? A.C.cyan : e / mx > .35 ? A.C.bad : A.C.warn, fillOpacity: .85 }); });
    const top = noAc.slice(0, 10), saved = top.reduce((a, [id]) => a + Math.max(...Array.from({ length: 24 }, (_, hh) => expo(id, hh))) * .75, 0), totPk = Math.max(...net);
    $('toolPanel').innerHTML = `<h3>Heat & dust resilience · ${A.hh(h)}</h3>
      <div class="row2"><div class="seg">${['summer', 'winter', 'dust_storm'].map((s) => `<button data-sc="${s}" class="${s === scen ? 'on' : ''}">${s.replace('_', ' ')}</button>`).join('')}</div></div>
      <div class="cards"><div class="c ${W[h].hi > 45 ? 'bad' : W[h].hi > 38 ? 'warn' : 'ok'}"><b>${W[h].t}°C</b><small>heat index ${W[h].hi}°</small></div><div class="c"><b>${W[h].vis} km</b><small>visibility</small></div><div class="c ${noAc.length ? 'warn' : 'ok'}"><b>${ids.filter((i) => !A.stops[i].shelter_ac).length}</b><small>stops without AC shelter</small></div></div>
      ${A.line([{ name: 'temp', color: A.C.hot, vals: W.map((x) => x.t) }, { name: 'HI', color: A.C.bad, vals: W.map((x) => x.hi) }], { labels: W.map((_, i) => A.pad(i)), min: 10, label: 'temperature and heat index' })}
      <small><span style="color:#f97316">━</span> temp · <span style="color:#fb7185">━</span> heat index</small>
      <h3>Rider exposure (relative) · peak ${A.hh(net.indexOf(totPk))}</h3>${A.bar(net, { labels: net.map((_, i) => A.pad(i)), color: (v, i) => (i === h ? '#fff' : A.C.hot), label: 'exposure' })}
      <h3>Highest-exposure stops without AC shelter</h3><table class="t"><tbody>${top.map(([id, e]) => `<tr class="click" data-s="${id}"><td>${A.esc(A.stops[id].name)}</td><td class="num">${A.fmt(A.stopHour[id][h])}</td><td style="width:34%"><div class="bar-h"><i style="width:${100 * e / mx}%;background:${A.C.bad}"></i></div></td></tr>`).join('')}</tbody></table>
      <div class="rec"><b>Recommendation</b> · Retrofit AC shelters at these ${top.length} stops: removes ≈${Math.round(100 * saved / totPk)}% of peak rider heat exposure. Trigger dispatcher alerts when heat index &gt; 45° or visibility &lt; 2 km.</div>`;
    $('toolPanel').querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => { scen = b.dataset.sc; A.renderTool(); }));
    M.rowClick('tr.click', (d) => { A.select({ type: 'stop', id: d.s }); M.map.setView(A.ll(d.s), 14); });
    M.legend('<b>Stop exposure</b><div class="row"><i style="background:#fb7185"></i>no AC · high</div><div class="row"><i style="background:#fbbf24"></i>no AC · moderate</div><div class="row"><i style="background:#22d3ee"></i>AC shelter</div>');
  });

  /* ======================================================= EQUITY */
  A.reg('equity', 'resil', 't_equity', () => {
    const Z = A.D.meta.zones, P = A.zonePop.map((z) => ({ ...z, gap: z.population * (1 - z.coverage_400m_pct / 100) * (1 + z.low_income_pct / 100) })).sort((a, b) => b.gap - a.gap);
    const tp = P.reduce((a, z) => a + z.population, 0), cov = P.reduce((a, z) => a + z.population * z.coverage_400m_pct / 100, 0), under = P.filter((z) => z.coverage_400m_pct < 30).reduce((a, z) => a + z.population, 0), mxg = P[0].gap;
    P.forEach((z) => { const c = Z[z.zone]; if (!c) return; L.circle(c, { radius: 450 + 900 * Math.sqrt(z.population / 170000), color: z.coverage_400m_pct < 20 ? A.C.bad : z.coverage_400m_pct < 40 ? A.C.warn : A.C.ok, weight: 2, fillOpacity: .2 + .4 * z.gap / mxg }).addTo(M.toolLayer).bindTooltip(`${z.zone}: ${z.coverage_400m_pct}% within 400 m`); });
    $('toolPanel').innerHTML = `<h3>Accessibility & equity</h3>
      <div class="cards"><div class="c"><b>${(100 * cov / tp).toFixed(0)}%</b><small>residents ≤400 m from a stop</small></div><div class="c bad"><b>${A.fmt(under)}</b><small>in zones &lt;30% covered</small></div><div class="c"><b>${P.length}</b><small>zones analysed</small></div></div>
      <table class="t"><thead><tr><th>zone</th><th class="num">pop.</th><th class="num">≤400 m</th><th class="num">walk m</th><th class="num">low-inc</th></tr></thead><tbody>${P.map((z) => `<tr class="click" data-z="${z.zone}"><td>${z.zone}</td><td class="num">${A.fmt(z.population)}</td><td class="num"><span class="badge ${z.coverage_400m_pct < 20 ? 'bad' : z.coverage_400m_pct < 40 ? 'warn' : 'ok'}">${z.coverage_400m_pct}%</span></td><td class="num">${z.avg_walk_m}</td><td class="num">${z.low_income_pct}%</td></tr>`).join('')}</tbody></table>
      <div class="rec"><b>Priority gaps</b> · ${P.slice(0, 3).map((z) => `<b>${z.zone}</b> (${z.coverage_400m_pct}%)`).join(', ')}. Candidates for new stops, demand-responsive shuttles or feeder routes; weight by low-income and senior share.</div>
      <div class="note">Coverage is a Monte-Carlo estimate (500 resident points per zone, synthetic population). Replace with census/GIS grids.</div>`;
    M.rowClick('tr.click', (d) => { A.select({ type: 'zone', id: d.z }); M.map.setView(Z[d.z], 13); });
    M.legend('<b>400 m coverage</b><div class="row"><i style="background:#fb7185"></i>&lt;20%</div><div class="row"><i style="background:#fbbf24"></i>20–40%</div><div class="row"><i style="background:#34d399"></i>≥40%</div>');
  });
})();
