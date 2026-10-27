/* Use-case hub: use cases discovered on the same data platform, ranked by value and feasibility. */
(function () {
  const $ = (id) => document.getElementById(id);
  const UC = [
    // live in the MVP
    ['UC-01', 'Travel-time & slow-zone diagnostics', 'Transit', 5, 5, 'live', 'travel', 'Where and when buses are consistently slowed; stop-to-stop times.', 'AVL, registry'],
    ['UC-02', 'Utilization & overload detection', 'Transit', 5, 5, 'live', 'util', 'Demand vs capacity by route, trip and hour; overloaded peaks.', 'AFC, operational'],
    ['UC-03', 'Demand hotspot clustering', 'Transit', 4, 5, 'live', 'cluster', 'High-validation stop clusters and overlapping trips.', 'AFC, registry'],
    ['UC-04', 'Route overlap, backtracking & transfers', 'Transit', 4, 4, 'live', 'route', 'Redundant corridors, detours and transfer hotspots.', 'registry, AFC chaining'],
    ['UC-05', 'O/D matrix reconstruction', 'Transit', 5, 3, 'live', 'od', 'Approximate alighting from the same card\'s next boarding.', 'AFC (≥2 trips/card)'],
    ['UC-06', 'Natural-language Copilot', 'Platform', 5, 4, 'live', 'agent', 'Arabic/English questions to governed SQL on aggregate tables.', 'all aggregates'],
    ['UC-07', 'EV fleet energy & charging optimisation', 'Fleet & energy', 5, 4, 'live', 'fleet', 'SOC risk, depot load, shifting charging to solar hours.', 'telematics, chargers'],
    ['UC-08', 'Emissions & electrification planning', 'Sustainability', 4, 5, 'live', 'emis', 'CO₂ per route and what-if electrification share.', 'fleet, km, grid factor'],
    ['UC-09', 'Event surge planner', 'Operations', 5, 4, 'live', 'events', 'F1, concerts, Ramadan, fireworks: demand curves and shuttle gap.', 'AFC history, calendar'],
    ['UC-10', 'Safety & incident command', 'Operations', 5, 3, 'live', 'safety', 'Unified incident feed from vision, telematics and AFC.', 'cameras, telematics'],
    ['UC-11', 'Heat & dust resilience', 'Resilience', 4, 4, 'live', 'heat', 'Rider heat exposure at stops without AC shelters; dust alerts.', 'weather, shelter inventory'],
    ['UC-12', 'Accessibility & equity coverage', 'Equity', 4, 4, 'live', 'equity', '400 m coverage, walk distance, low-income gaps by zone.', 'census grid, stops'],
    ['UC-13', 'What-if service planner', 'Planning', 5, 4, 'live', 'scen', 'Add trips or larger vehicles: effect on load, cost and CO₂.', 'route_hour, cost model'],
    ['UC-14', 'Bus-lane enforcement & dwell vision', 'Operations', 4, 3, 'live', 'vision', 'Violations, stop dwell and crowding from camera feeds.', 'cameras'],
    // discovered / roadmap
    ['UC-15', 'Predictive maintenance', 'Fleet & energy', 4, 3, 'roadmap', null, 'Fault prediction from telematics + health score; fewer breakdowns.', 'telematics, work orders'],
    ['UC-16', 'Real-time headway control & bus holding', 'Operations', 5, 2, 'roadmap', null, 'Even out bunching using live AVL; dispatcher guidance.', 'live AVL, schedule'],
    ['UC-17', 'Demand-responsive transit for low-density zones', 'Planning', 4, 3, 'roadmap', null, 'On-demand shuttles for Al Shamkha, Shakhbout City, Saadiyat.', 'equity, O/D, booking'],
    ['UC-18', 'Fare-integrity & validation anomaly detection', 'Platform', 3, 4, 'roadmap', null, 'Spot tag-on without tag-off patterns, duplicate and cloned cards.', 'AFC'],
    ['UC-19', 'Airport & Etihad Rail intermodal first/last mile', 'Planning', 5, 3, 'roadmap', null, 'Sync buses to flight and rail arrivals; shared dwell/transfer view.', 'flight/rail feeds'],
    ['UC-20', 'Transit signal priority corridors', 'Operations', 4, 2, 'roadmap', null, 'Rank intersections where priority saves most bus minutes.', 'AVL, signal data'],
    ['UC-21', 'Driver behaviour & fatigue coaching', 'Fleet & energy', 3, 3, 'roadmap', null, 'Harsh-braking trends, energy-efficient driving scores.', 'telematics'],
    ['UC-22', 'Crowd-level prediction in the rider app', 'Platform', 4, 3, 'roadmap', null, 'Predicted occupancy per next bus; shift riders off peaks.', 'AFC, APC'],
    ['UC-23', 'Autonomous shuttle pilot siting', 'Planning', 3, 2, 'roadmap', null, 'Masdar, Yas and Saadiyat candidates by demand and road geometry.', 'O/D, GIS'],
    ['UC-24', 'Ramadan & school-term schedule optimisation', 'Planning', 4, 4, 'roadmap', null, 'Seasonal demand shifts; retime frequencies and shifts.', 'multi-year AFC'],
  ].map(([id, name, cat, value, feas, status, open, desc, data]) => ({ id, name, cat, value, feas, status, open, desc, data }));
  let cat = 'All';

  function render() {
    const cats = ['All', ...new Set(UC.map((u) => u.cat))], list = UC.filter((u) => cat === 'All' || u.cat === cat);
    const sc = (n, f) => `<span class="score ${f ? 'f' : ''}" title="${f ? 'feasibility' : 'value'} ${n}/5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
    const W = 520, H = 340, px = (f) => 50 + (f - 1) * (W - 80) / 4, py = (v) => H - 40 - (v - 1) * (H - 70) / 4;
    const dots = UC.map((u) => { const jx = ((u.id.charCodeAt(4) * 7 + u.id.charCodeAt(3)) % 9 - 4) * 3, jy = ((u.id.charCodeAt(4) * 5) % 9 - 4) * 3;
      return `<g><circle cx="${px(u.feas) + jx}" cy="${py(u.value) + jy}" r="${cat === 'All' || u.cat === cat ? 11 : 7}" fill="${u.status === 'live' ? A.C.cyan : A.C.violet}" fill-opacity="${cat === 'All' || u.cat === cat ? .85 : .25}"><title>${u.id} ${u.name}</title></circle><text x="${px(u.feas) + jx}" y="${py(u.value) + jy + 3}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#04121c">${u.id.slice(3)}</text></g>`; }).join('');
    const next = UC.filter((u) => u.status === 'roadmap').sort((a, b) => b.value * b.feas - a.value * a.feas).slice(0, 3);
    $('ucBody').innerHTML = `<h2>${A.t('uc_title')}</h2><p style="color:var(--muted);max-width:760px">${A.t('uc_sub')}</p>
      <div class="grid2"><section class="card"><h3>Value vs feasibility</h3>
        <svg viewBox="0 0 ${W} ${H}" class="bars" role="img" aria-label="Use-case value versus feasibility"><rect x="50" y="20" width="${W - 80}" height="${H - 60}" fill="none" stroke="rgba(148,163,184,.2)"/><rect x="${px(3.5)}" y="20" width="${W - 30 - px(3.5)}" height="${py(3.5) - 20}" fill="rgba(34,211,238,.07)"/>
        <text x="${W - 34}" y="36" text-anchor="end" font-size="10" fill="#22d3ee">quick wins</text><text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#8b9bb4">feasibility →</text><text x="12" y="${H / 2}" font-size="10" fill="#8b9bb4" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">value →</text>${dots}</svg>
        <small><span style="color:#22d3ee">●</span> live in this MVP · <span style="color:#8b5cf6">●</span> discovered / roadmap</small></section>
      <section class="card"><h3>Suggested next use cases</h3>${next.map((u, i) => `<div class="rec"><b>${i + 1}. ${u.name}</b> — ${u.desc}<br><small>needs: ${u.data} · value ${u.value}/5 · feasibility ${u.feas}/5</small></div>`).join('')}
        <small>Ranking = value × feasibility among roadmap items. They reuse the same ingestion, aggregate schema, Copilot and governance layers, so each adds mostly a new data feed and a dashboard module.</small></section></div>
      <div class="row2">${cats.map((c) => `<button data-cat="${c}" class="${c === cat ? 'pri' : ''}">${c}</button>`).join('')}</div>
      <div class="ucgrid">${list.map((u) => `<div class="uc"><div class="meta"><span class="badge ${u.status === 'live' ? 'cy' : ''}">${u.id}</span><span class="badge ${u.status === 'live' ? 'ok' : 'warn'}">${u.status === 'live' ? 'LIVE IN MVP' : 'ROADMAP'}</span><small>${u.cat}</small></div>
        <h4>${u.name}</h4><p>${u.desc}</p><small>Data: ${u.data}</small><div class="meta"><small>value</small>${sc(u.value)}<small>feasibility</small>${sc(u.feas, 1)}</div>
        ${u.open ? `<div><button data-open="${u.open}" class="pri">Open</button></div>` : ''}</div>`).join('')}</div>`;
    $('ucBody').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { cat = b.dataset.cat; render(); }));
    $('ucBody').querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { const k = b.dataset.open; location.hash = '#/' + k; }));
  }
  A.renderDoc2 = render;
})();
