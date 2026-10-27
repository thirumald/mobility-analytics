/* Live simulation on the map: moving vehicles (AVL-like) + validation events (AFC-like). */
(function () {
  const $ = (id) => document.getElementById(id);
  let on = false, timer = null, simT = 0, vehicles = [], cum = null, val = 0, carry = 0;
  const ticker = [];
  const prepare = () => { if (cum) return; cum = {}; Object.keys(A.routes).forEach((rid) => { cum[rid] = A.segments.filter((s) => s.route_id === rid).sort((a, b) => a.seq - b.seq); }); };
  function spawn() {
    vehicles.forEach((v) => v.mk.remove()); vehicles = [];
    Object.keys(A.routes).forEach((rid) => {
      const n = Math.min(5, Math.max(1, Math.round(A.routeHour.weekday[rid][A.hour].trips / 5) || 1)), nseg = cum[rid].length;
      for (let i = 0; i < n; i++) {
        const mk = L.marker([0, 0], { keyboard: false, icon: L.divIcon({ className: '', iconSize: [12, 12], html: `<div class="veh" style="background:${A.routes[rid].color};color:${A.routes[rid].color}"></div>` }) }).addTo(A.map);
        mk.bindTooltip(rid); vehicles.push({ rid, mk, seg: Math.floor(Math.random() * nseg), f: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, idx: i });
      }
    });
    place();
  }
  function place() { vehicles.forEach((v) => { const sg = cum[v.rid][v.seg], a = A.ll(sg.from_stop), b = A.ll(sg.to_stop); v.mk.setLatLng([a[0] + (b[0] - a[0]) * v.f, a[1] + (b[1] - a[1]) * v.f]); }); }
  const hourNow = () => Math.floor(simT / 3600) % 24;
  function tick() {
    const k = +$('simSpeed').value, dt = 0.25 * k, prevH = hourNow(); simT += dt; const h = hourNow();
    if (h !== prevH) { A.hour = h; $('hour').value = h; A.renderTool(); spawn(); A.emit('hour', h); }
    let spd = 0, moving = 0;
    vehicles.forEach((v) => {
      const tr = A.routeHour.weekday[v.rid][h].trips, active = tr > 0 && v.idx < Math.ceil(tr / 5), el = v.mk.getElement(); if (el) el.style.display = active ? '' : 'none'; if (!active) return;
      const sg = cum[v.rid][v.seg], sp = A.segHour[sg.seg_id][h].speed; spd += sp; moving++;
      v.f += v.dir * ((sp * dt) / 3600 / sg.dist_km);
      if (v.f > 1) { if (v.seg < cum[v.rid].length - 1) { v.seg++; v.f -= 1; } else { v.dir = -1; v.f = 1; } } else if (v.f < 0) { if (v.seg > 0) { v.seg--; v.f += 1; } else { v.dir = 1; v.f = 0; } }
    });
    place();
    const ids = Object.keys(A.stopHour), w = ids.map((id) => A.stopHour[id][h]), tot = w.reduce((a, b) => a + b, 0);
    carry += (tot / 3600) * dt; const n = Math.floor(carry); carry -= n; val += n;
    const t = simT % 86400, ts = `${A.pad(Math.floor(t / 3600))}:${A.pad(Math.floor((t % 3600) / 60))}:${A.pad(Math.floor(t % 60))}`;
    for (let i = 0; i < Math.min(3, n); i++) {
      let r = Math.random() * tot, j = 0; while (r > w[j] && j < ids.length - 1) { r -= w[j]; j++; }
      const id = ids[j], rs = Object.keys(A.routeStops).filter((x) => A.routeStops[x].includes(id)), rid = rs[Math.floor(Math.random() * rs.length)];
      const pm = L.marker(A.ll(id), { interactive: false, icon: L.divIcon({ className: '', iconSize: [14, 14], html: '<div class="pulse"></div>' }) }).addTo(A.map); setTimeout(() => pm.remove(), 1200);
      ticker.unshift(`<li><b>${ts}</b> · ${rid} · ${A.esc(A.stops[id].name)} · +1 validation <small>card ••••</small></li>`); ticker.length = Math.min(ticker.length, 8);
    }
    $('simClock').textContent = ts; $('clock').textContent = ts.slice(0, 5);
    $('kVeh').textContent = moving; $('kVal').textContent = A.fmt(val); $('kSpd').textContent = moving ? (spd / moving).toFixed(1) : '–'; $('ticker').innerHTML = ticker.join('');
  }
  function toggle() {
    on = !on; A.simOn = on; prepare(); $('liveBox').hidden = !on;
    $('btnLive').innerHTML = on ? `⏸ <span>${A.t('pause')}</span>` : `▶ <span>${A.t('live_sim')}</span>`;
    if (on) { simT = A.hour * 3600 + 5; val = 0; carry = 0; ticker.length = 0; spawn(); timer = setInterval(tick, 250); }
    else { clearInterval(timer); vehicles.forEach((v) => v.mk.remove()); vehicles = []; }
  }
  A.initSim = () => { $('btnLive').onclick = toggle; A.on('lang', () => { $('btnLive').innerHTML = (on ? '⏸ ' : '▶ ') + `<span>${on ? A.t('pause') : A.t('live_sim')}</span>`; }); };
})();
