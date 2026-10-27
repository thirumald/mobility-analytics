/* Live data: (1) simulated AVL vehicles + AFC validation events on the map,
              (2) real video clips with motion-tracked points replayed in sync (data/tracks.js) */
(function () {
  const $ = (id) => document.getElementById(id);

  /* ======================================================== map simulation */
  let on = false, timer = null, simT = 0, vehicles = [], cum = null, val = 0, carry = 0, pulses = [];
  const ticker = [];

  function prepare() {
    if (cum) return;
    cum = {};
    Object.keys(A.routes).forEach((rid) => { cum[rid] = A.segments.filter((s) => s.route_id === rid).sort((a, b) => a.seq - b.seq); });
  }
  function spawn() {
    vehicles.forEach((v) => v.mk.remove()); vehicles = [];
    Object.keys(A.routes).forEach((rid) => {
      const n = Math.min(5, Math.max(1, Math.round(A.routeHour.weekday[rid][A.hour].trips / 5) || 1));
      const nseg = cum[rid].length;
      for (let i = 0; i < n; i++) {
        const mk = L.marker([0, 0], { interactive: true, keyboard: false, icon: L.divIcon({ className: '', iconSize: [12, 12], html: `<div class="veh" style="background:${A.routes[rid].color}"></div>` }) }).addTo(A.map);
        mk.bindTooltip(rid);
        vehicles.push({ rid, mk, seg: Math.floor(Math.random() * nseg), f: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, idx: i, speed: 0 });
      }
    });
    place();
  }
  function place() {
    vehicles.forEach((v) => {
      const sg = cum[v.rid][v.seg], a = A.ll(sg.from_stop), b = A.ll(sg.to_stop);
      v.mk.setLatLng([a[0] + (b[0] - a[0]) * v.f, a[1] + (b[1] - a[1]) * v.f]);
    });
  }
  function hourNow() { return Math.floor(simT / 3600) % 24; }
  function tick() {
    const k = +$('simSpeed').value, dt = 0.25 * k;       // sim seconds this tick
    const prevH = hourNow(); simT += dt; const h = hourNow();
    if (h !== prevH) { A.hour = h; $('hour').value = h; A.renderTool(); spawn(); }
    let spdSum = 0, moving = 0;
    vehicles.forEach((v) => {
      const active = A.routeHour.weekday[v.rid][h].trips > 0 && v.idx < Math.ceil(A.routeHour.weekday[v.rid][h].trips / 5);
      v.mk.getElement() && (v.mk.getElement().style.display = active ? '' : 'none');
      if (!active) return;
      const sg = cum[v.rid][v.seg], sp = A.segHour[sg.seg_id][h].speed;
      v.speed = sp; spdSum += sp; moving++;
      v.f += v.dir * ((sp * dt) / 3600 / sg.dist_km);
      if (v.f > 1) { if (v.seg < cum[v.rid].length - 1) { v.seg++; v.f -= 1; } else { v.dir = -1; v.f = 1; } }
      else if (v.f < 0) { if (v.seg > 0) { v.seg--; v.f += 1; } else { v.dir = 1; v.f = 0; } }
    });
    place();
    // AFC events
    const ids = Object.keys(A.stopHour), w = ids.map((id) => A.stopHour[id][h]), tot = w.reduce((a, b) => a + b, 0);
    carry += (tot / 3600) * dt; const n = Math.floor(carry); carry -= n; val += n;
    for (let i = 0; i < Math.min(3, n); i++) {
      let r = Math.random() * tot, j = 0; while (r > w[j] && j < ids.length - 1) { r -= w[j]; j++; }
      const id = ids[j], st = A.stops[id], rs = Object.keys(A.routeStops).filter((x) => A.routeStops[x].includes(id)), rid = rs[Math.floor(Math.random() * rs.length)];
      const pm = L.marker(A.ll(id), { interactive: false, icon: L.divIcon({ className: '', iconSize: [14, 14], html: '<div class="pulse"></div>' }) }).addTo(A.map);
      setTimeout(() => pm.remove(), 1200);
      const t = simT % 86400, ts = `${A.pad(Math.floor(t / 3600))}:${A.pad(Math.floor((t % 3600) / 60))}:${A.pad(Math.floor(t % 60))}`;
      ticker.unshift(`<li><b>${ts}</b> · ${rid} · ${A.esc(st.name)} · +1 ${A.lang === 'az' ? 'validasiya' : 'validation'} <small>(card ••••)</small></li>`);
      ticker.length = Math.min(ticker.length, 8);
    }
    const t = simT % 86400;
    $('simClock').textContent = `${A.pad(Math.floor(t / 3600))}:${A.pad(Math.floor((t % 3600) / 60))}:${A.pad(Math.floor(t % 60))}`;
    $('kVeh').textContent = moving; $('kVal').textContent = A.fmt(val); $('kSpd').textContent = moving ? (spdSum / moving).toFixed(1) : '–';
    $('ticker').innerHTML = ticker.join('');
  }
  function toggle() {
    on = !on; prepare();
    $('liveBox').hidden = !on;
    $('btnLive').innerHTML = on ? `⏸ <span>${A.t('pause')}</span>` : `▶ <span>${A.t('live_sim')}</span>`;
    if (on) { simT = A.hour * 3600 + 5; val = 0; carry = 0; ticker.length = 0; spawn(); timer = setInterval(tick, 250); }
    else { clearInterval(timer); vehicles.forEach((v) => v.mk.remove()); vehicles = []; }
  }

  /* ============================================================ videos */
  const VIDEOS = [
    { key: 'corridor-a', file: 'videos/corridor-a.mp4', az: 'Dəhliz A — nəqliyyat axını', en: 'Corridor A — vehicle flow', kind: 'segment', route: 'I2', color: '#e9a23b',
      note_az: 'Magistral görüntüsü AVL/sensor axınının əvəzedicisidir (yol seqmentində sürət və sıxlıq).', note_en: 'Highway footage stands in for an AVL/loop-sensor feed (speed and density on a segment).' },
    { key: 'corridor-b', file: 'videos/corridor-b.mp4', az: 'Dəhliz B — nəqliyyat axını', en: 'Corridor B — vehicle flow', kind: 'segment', route: 'B1', color: '#5ec8ff',
      note_az: 'Eyni magistralın ikinci hissəsi; fərqli “seqmentə” bağlanıb.', note_en: 'Second part of the same clip, bound to a different network segment.' },
    { key: 'stop-pedestrians', file: 'videos/stop-pedestrians.mp4', az: 'Dayanacaq — piyada axını', en: 'Stop — pedestrian flow', kind: 'stop', stop: 'Genclik', color: '#7bdc8a',
      note_az: 'Piyada axını dayanacaqda minmə tələbinin (validasiya) əvəzedicisidir.', note_en: 'Pedestrian flow stands in for boarding demand (validations) at a stop.' },
  ];
  const cards = [];

  function buildVideos() {
    const T = window.AYNA_TRACKS, grid = $('videoGrid'); grid.innerHTML = ''; cards.length = 0;
    VIDEOS.forEach((V) => {
      const tr = T[V.key];
      // first-seen time per track, counts per second
      const first = {}, perSec = [];
      tr.frames.forEach(([t, bs]) => { bs.forEach((b) => { if (first[b[0]] == null) first[b[0]] = t; }); const s = Math.floor(t); perSec[s] = Math.max(perSec[s] || 0, bs.length); });
      for (let i = 0; i < perSec.length; i++) perSec[i] = perSec[i] || 0;
      const firstSorted = Object.values(first).sort((a, b) => a - b);
      const link = V.kind === 'stop' ? { type: 'stop', id: A.stopsHub.find((s) => s.name === V.stop).stop_id } : { type: 'segment', id: A.segments.find((s) => s.route_id === V.route && s.seq === 2).seg_id };
      const el = document.createElement('div'); el.className = 'vcard';
      el.innerHTML = `<div class="vstage"><video muted loop playsinline preload="auto" src="${V.file}"></video><canvas></canvas></div>
        <div class="vbody"><h4>${A.esc(V[A.lang])}</h4><small>${A.esc(V['note_' + A.lang])}</small>
        <div class="vk"><div><b class="kNow">0</b><small>${A.lang === 'az' ? 'kadrda' : 'in frame'}</small></div><div><b class="kUni">0</b><small>${A.lang === 'az' ? 'say (unikal)' : 'counted'}</small></div><div><b class="kRate">0</b><small>${V.kind === 'stop' ? (A.lang === 'az' ? 'nəfər/saat' : 'persons/h') : (A.lang === 'az' ? 'nəql./saat' : 'veh/h')}</small></div><div><b class="kT">0:00</b><small>video</small></div></div>
        <div style="position:relative">${A.bar(perSec, { w: 440, h: 40, labels: perSec.map((_, i) => i + 's'), color: V.color, label: 'objects per second' })}<div class="ph" style="position:absolute;top:0;bottom:16px;width:2px;background:#c8394a;left:3%"></div></div>
        <div class="fuse"></div>
        <div class="row2"><button class="bp">${A.t('pause')}</button><a href="${V.file}" download><button type="button">⬇ ${A.t('download')}</button></a><button class="bc" type="button">⬇ ${A.t('dl_tracks')}</button><button class="bl" type="button">📍 ${A.t('selected')}</button></div></div>`;
      grid.appendChild(el);
      const vid = el.querySelector('video'), cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
      const C = { V, tr, first: firstSorted, vid, cv, ctx, el, link, dur: 0, trail: {} };
      cards.push(C);
      el.querySelector('.bp').onclick = (e) => { if (vid.paused) { vid.play(); e.target.textContent = A.t('pause'); } else { vid.pause(); e.target.textContent = A.t('play'); } };
      el.querySelector('.bc').onclick = () => A.download(`${V.key}_points.csv`, A.csv(['video', 't_sec', 'track_id', 'x', 'y', 'w', 'h'], tr.frames.flatMap(([t, bs]) => bs.map((b) => [V.key, t, ...b]))));
      el.querySelector('.bl').onclick = () => A.select(link);
      vid.addEventListener('loadedmetadata', () => { C.dur = vid.duration; });
    });
    A.cards = cards;
  }

  function frameAt(tr, t) {
    const f = tr.frames; let lo = 0, hi = f.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (f[m][0] <= t) lo = m; else hi = m - 1; }
    return { i: lo, fr: f[lo] };
  }
  function drawLoop() {
    if (document.getElementById('v-live').classList.contains('on')) cards.forEach(draw);
    requestAnimationFrame(drawLoop);
  }
  function draw(C) {
    const { vid, cv, ctx, tr, V } = C, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
    const t = vid.currentTime, sx = r.width / tr.w, sy = r.height / tr.h, { i, fr } = frameAt(tr, t);
    const live = t - fr[0] < 0.6 ? fr[1] : [];
    // trails (last ~1.5 s)
    ctx.lineWidth = 2; ctx.strokeStyle = V.color + 'aa';
    const hist = {};
    for (let k = i; k >= 0 && t - tr.frames[k][0] < 1.5; k--) tr.frames[k][1].forEach((b) => (hist[b[0]] = hist[b[0]] || []).push([(b[1] + b[3] / 2) * sx, (b[2] + b[4] / 2) * sy]));
    Object.values(hist).forEach((p) => { ctx.beginPath(); p.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); });
    ctx.font = '600 11px system-ui'; ctx.textBaseline = 'bottom';
    live.forEach((b) => {
      const x = b[1] * sx, y = b[2] * sy, w = b[3] * sx, h = b[4] * sy;
      ctx.strokeStyle = V.color; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = V.color; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 3.5, 0, 7); ctx.fill();
      const lab = `${tr.label} #${b[0]}`; const tw = ctx.measureText(lab).width + 6;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x, y - 15, tw, 15); ctx.fillStyle = '#fff'; ctx.fillText(lab, x + 3, y - 2);
    });
    // KPIs
    let uni = 0; { let lo = 0, hi = C.first.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C.first[m] <= t) lo = m + 1; else hi = m; } uni = lo; }
    const q = (s) => C.el.querySelector(s), rate = t > 3 ? Math.round((uni / t) * 3600) : 0;
    q('.kNow').textContent = live.length; q('.kUni').textContent = uni; q('.kRate').textContent = A.fmt(rate);
    q('.kT').textContent = `${Math.floor(t / 60)}:${A.pad(Math.floor(t % 60))}`;
    const dur = C.dur || vid.duration || 1; q('.ph').style.left = `calc(${(t / dur) * 94 + 3}%)`;
    const f = q('.fuse');
    if (C.link.type === 'stop') { const s = A.stops[C.link.id]; f.innerHTML = `<small>🔗 ${A.esc(s.name)} · ${A.hh(A.hour)}: ${A.lang === 'az' ? 'model' : 'model'} <b>${A.fmt(A.stopHour[C.link.id][A.hour])}</b> ${A.lang === 'az' ? 'validasiya/saat' : 'validations/h'} · ${A.lang === 'az' ? 'video' : 'video'} <b>${A.fmt(rate)}</b> ${A.lang === 'az' ? 'nəfər/saat' : 'persons/h'}</small>`; }
    else { const s = A.segById[C.link.id], d = A.segHour[s.seg_id][A.hour]; f.innerHTML = `<small>🔗 ${s.seg_id} (${A.esc(A.stops[s.from_stop].name)} → ${A.esc(A.stops[s.to_stop].name)}) · ${A.hh(A.hour)}: ${A.lang === 'az' ? 'model' : 'model'} <b>${d.speed}</b> km/h · ${A.lang === 'az' ? 'video' : 'video'} <b>${A.fmt(rate)}</b> ${A.lang === 'az' ? 'nəql./saat' : 'veh/h'}</small>`; }
  }

  A.initLive = () => {
    $('btnLive').onclick = toggle;
    buildVideos();
    requestAnimationFrame(drawLoop);
    A.on('lang', () => { buildVideos(); $('btnLive').innerHTML = (on ? '⏸ ' : '▶ ') + `<span>${on ? A.t('pause') : A.t('live_sim')}</span>`; });
    A.on('view', (v) => cards.forEach((C) => (v === 'live' ? C.vid.play().catch(() => {}) : C.vid.pause())));
  };
})();
