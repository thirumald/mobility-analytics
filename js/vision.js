/* Vision tab: camera feeds with tracked objects replayed in sync with playback + event log.
   - 4 simulated scenes (tools/make_scenes.py): exact tracks, events from the simulation
   - 3 real clips (tools/track_videos.py): OpenCV motion tracks; generic footage, not from the UAE */
(function () {
  const $ = (id) => document.getElementById(id);
  const COL = { car: '#94a3b8', bus: '#22d3ee', ev_bus: '#34d399', shuttle: '#22d3ee', person: '#e6edf7', vehicle: '#fbbf24', road_user: '#fbbf24' };
  const FEEDS = [
    { key: 'scene-buslane', sim: 1, file: 'videos/scene-buslane.mp4', cam: 'CAM-BL-03', loc: 'Sheikh Zayed Rd · Al Maryah', uc: 'Bus-lane enforcement', link: { seg: 'T2-02' }, unit: 'veh/h' },
    { key: 'scene-busstop', sim: 1, file: 'videos/scene-busstop.mp4', cam: 'CAM-ST-11', loc: 'Corniche · stop T1', uc: 'Dwell, crowding & heat', link: { stop: 'Corniche' }, unit: 'persons/h' },
    { key: 'scene-evdepot', sim: 1, file: 'videos/scene-evdepot.mp4', cam: 'CAM-DP-02', loc: 'Mussafah depot', uc: 'EV charging & depot ops', link: { depot: 1 }, unit: 'buses/h' },
    { key: 'scene-egress', sim: 1, file: 'videos/scene-egress.mp4', cam: 'CAM-EV-07', loc: 'Yas Island · shuttle zone', uc: 'Event crowd & shuttle surge', link: { event: 'EV2' }, unit: 'persons/h' },
    { key: 'corridor-a', sim: 0, file: 'videos/corridor-a.mp4', cam: 'REAL-A', loc: 'Sample highway footage', uc: 'Corridor flow & speed', link: { seg: 'I1-02' }, unit: 'veh/h', label: 'vehicle' },
    { key: 'corridor-b', sim: 0, file: 'videos/corridor-b.mp4', cam: 'REAL-B', loc: 'Sample highway footage', uc: 'Corridor flow & speed', link: { seg: 'I2-02' }, unit: 'veh/h', label: 'vehicle' },
    { key: 'stop-pedestrians', sim: 0, file: 'videos/stop-pedestrians.mp4', cam: 'REAL-C', loc: 'Sample pedestrian footage', uc: 'Boarding demand proxy', link: { stop: 'Al Wahda Mall' }, unit: 'persons/h', label: 'person' },
  ];
  const cards = [];
  const T = () => Object.assign({}, window.SAFAR_TRACKS || {}, window.SAFAR_TRACKS_SYN || {});

  function build() {
    const tracks = T(), grid = $('videoGrid'); grid.innerHTML = ''; cards.length = 0; let evTot = 0, objTot = 0;
    FEEDS.forEach((F) => {
      const tr = tracks[F.key]; if (!tr) return;
      const norm = tr.frames.map(([t, bs]) => [t, bs.map((b) => (b.length > 5 ? b : [...b, F.label || 'vehicle', 0, 0]))]);
      const first = {}, perSec = [];
      norm.forEach(([t, bs]) => { bs.forEach((b) => { if (first[b[0]] == null) first[b[0]] = t; }); const s = Math.floor(t); perSec[s] = Math.max(perSec[s] || 0, bs.length); });
      for (let i = 0; i < perSec.length; i++) perSec[i] = perSec[i] || 0;
      const events = tr.events || [], firstSorted = Object.values(first).sort((a, b) => a - b); evTot += events.length; objTot += tr.unique;
      let link = null;
      if (F.link.seg) link = { type: 'segment', id: F.link.seg }; if (F.link.stop) link = { type: 'stop', id: A.stopsHub.find((s) => s.name === F.link.stop).stop_id };
      const el = document.createElement('div'); el.className = 'vcard';
      el.innerHTML = `<div class="vstage"><div class="vtag"><span class="badge ${F.sim ? 'cy' : 'warn'}">${F.sim ? 'SIMULATED SCENE' : 'REAL FOOTAGE'}</span><span class="badge">${F.cam}</span></div><video muted loop playsinline preload="auto" src="${F.file}"></video><canvas></canvas></div>
        <div class="vbody"><h4>${A.esc(tr.title || F.loc)}</h4><small>${A.esc(F.loc)} · use case: <b>${F.uc}</b></small>
        <div class="vk"><div><b class="kNow">0</b><small>in frame</small></div><div><b class="kUni">0</b><small>counted</small></div><div><b class="kRate">0</b><small>${F.unit}</small></div><div><b class="kT">0:00</b><small>time</small></div></div>
        <div style="position:relative">${A.bar(perSec, { w: 460, h: 38, labels: perSec.map((_, i) => i + 's'), color: F.sim ? A.C.cyan : A.C.warn, label: 'objects per second' })}<div class="ph" style="position:absolute;top:0;bottom:16px;width:2px;background:#fb7185;left:3%"></div></div>
        <ul class="evlog"></ul><div class="fuse"></div>
        <div class="row2"><button class="bp">${A.t('pause')}</button><a href="${F.file}" download><button type="button">⬇ ${A.t('download')}</button></a><button class="bc" type="button">⬇ ${A.t('dl_tracks')}</button>${link ? `<button class="bl" type="button">◎ ${A.t('selected')}</button>` : ''}</div></div>`;
      grid.appendChild(el);
      const vid = el.querySelector('video'), cv = el.querySelector('canvas');
      const C = { F, tr: { ...tr, frames: norm }, first: firstSorted, vid, cv, ctx: cv.getContext('2d'), el, link, dur: 0, events, shown: -1 };
      cards.push(C);
      el.querySelector('.bp').onclick = (e) => { if (vid.paused) { vid.play(); e.target.textContent = A.t('pause'); } else { vid.pause(); e.target.textContent = A.t('play'); } };
      el.querySelector('.bc').onclick = () => A.download(`${F.key}_points.csv`, A.csv(['video', 't_sec', 'track_id', 'x', 'y', 'w', 'h', 'class', 'flag', 'value'], norm.flatMap(([t, bs]) => bs.map((b) => [F.key, t, ...b]))));
      if (link) el.querySelector('.bl').onclick = () => A.select(link);
      vid.addEventListener('loadedmetadata', () => (C.dur = vid.duration));
    });
    $('visionKpi').innerHTML = `<div class="c"><b>${cards.length}</b><small>camera feeds</small></div><div class="c"><b>${objTot}</b><small>tracked objects</small></div><div class="c warn"><b>${evTot}</b><small>events detected</small></div><div class="c"><b>${cards.filter((c) => c.F.sim).length} / ${cards.filter((c) => !c.F.sim).length}</b><small>simulated / real</small></div>`;
  }
  const frameAt = (tr, t) => { const f = tr.frames; let lo = 0, hi = f.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (f[m][0] <= t) lo = m; else hi = m - 1; } return { i: lo, fr: f[lo] }; };
  function loop() { if ($('v-vision').classList.contains('on')) cards.forEach(draw); requestAnimationFrame(loop); }
  function draw(C) {
    const { vid, cv, ctx, tr, F } = C, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
    const t = vid.currentTime, sx = r.width / tr.w, sy = r.height / tr.h, { i, fr } = frameAt(tr, t), live = t - fr[0] < 0.6 ? fr[1] : [];
    // trails
    const hist = {}; for (let k = i; k >= 0 && t - tr.frames[k][0] < 1.4; k--) tr.frames[k][1].forEach((b) => (hist[b[0]] = hist[b[0]] || []).push([(b[1] + b[3] / 2) * sx, (b[2] + b[4] / 2) * sy]));
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(34,211,238,.45)'; Object.values(hist).forEach((p) => { if (p.length < 2) return; ctx.beginPath(); p.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); });
    ctx.font = '600 10.5px Inter,system-ui'; ctx.textBaseline = 'bottom';
    live.forEach((b) => {
      const [id, bx, by, bw, bh, cls, flag, v] = b, x = bx * sx, y = by * sy, w = bw * sx, h = bh * sy, col = flag ? '#fb7185' : (COL[cls] || '#22d3ee');
      ctx.strokeStyle = col; ctx.lineWidth = flag ? 2.2 : 1.3; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 3, 0, 7); ctx.fill();
      if (w > 14 || flag) { const lab = `${cls.replace('_', ' ')} #${id}${flag ? ' ⚠' : ''}${F.key === 'scene-evdepot' ? ' · ' + v + '%' : ''}`, tw = ctx.measureText(lab).width + 6; ctx.fillStyle = 'rgba(2,6,16,.78)'; ctx.fillRect(x, y - 14, tw, 14); ctx.fillStyle = col; ctx.fillText(lab, x + 3, y - 2); }
    });
    // KPIs
    let lo = 0, hi = C.first.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C.first[m] <= t) lo = m + 1; else hi = m; }
    const uni = lo, q = (s) => C.el.querySelector(s), rate = t > 3 ? Math.round((uni / t) * 3600) : 0;
    q('.kNow').textContent = live.length; q('.kUni').textContent = uni; q('.kRate').textContent = A.fmt(rate); q('.kT').textContent = `${Math.floor(t / 60)}:${A.pad(Math.floor(t % 60))}`;
    q('.ph').style.left = `calc(${((t / (C.dur || vid.duration || 1)) * 94 + 3)}%)`;
    // event log (events up to current time)
    const n = C.events.filter((e) => e[0] <= t).length;
    if (n !== C.shown) { C.shown = n; q('.evlog').innerHTML = C.events.filter((e) => e[0] <= t).reverse().map((e) => `<li class="s${e[2]}"><time>${Math.floor(e[0] / 60)}:${A.pad(Math.floor(e[0] % 60))}</time><span>${A.esc(e[1])}</span></li>`).join('') || '<li><small>No events yet</small></li>'; }
    const f = q('.fuse');
    if (C.link?.type === 'stop') f.innerHTML = `🔗 ${A.esc(A.stops[C.link.id].name)} · ${A.hh(A.hour)}: model <b>${A.fmt(A.stopHour[C.link.id][A.hour])}</b> validations/h · video <b>${A.fmt(rate)}</b> ${F.unit}`;
    else if (C.link?.type === 'segment') { const s = A.segById[C.link.id], d = A.segHour[s.seg_id][A.hour]; f.innerHTML = `🔗 ${s.seg_id} (${A.esc(A.stops[s.from_stop].name)} → ${A.esc(A.stops[s.to_stop].name)}) · ${A.hh(A.hour)}: model <b>${d.speed}</b> km/h · video <b>${A.fmt(rate)}</b> ${F.unit}`; }
    else f.innerHTML = F.link.depot ? `🔗 Mussafah Depot · ${A.hh(A.hour)}: ${(A.chargers.filter((c) => c.depot === 'Mussafah Depot').reduce((a, c) => a + A.chargerHour[c.charger_id][A.hour].util, 0) / 8).toFixed(0)}% charger utilization (model)` : `🔗 Event ${F.link.event}: peak trip gap ${Math.max(...A.eventDemand[F.link.event].map((x) => x.gap))} (model)`;
  }
  A.initVision = () => { build(); requestAnimationFrame(loop); A.on('lang', build); A.on('view', (v) => cards.forEach((C) => (v === 'vision' ? C.vid.play().catch(() => {}) : C.vid.pause()))); };
})();
