/* SAFAR Copilot (demo): English + Arabic question → SQL → aggregated answer.
   A rule-based parser stands in for the LLM. It turns the question into one read-only SQL query, runs it on the
   in-browser analytical DB, and summarises ONLY the aggregated result rows. Swap `interpret()` for an LLM call later;
   the guardrails (runSQL, mask, audit) stay the same. */
(function () {
  const CITY = { 'abu dhabi': 'Abu Dhabi', 'ابوظبي': 'Abu Dhabi', 'al ain': 'Al Ain', 'العين': 'Al Ain', dubai: 'Dubai', 'دبي': 'Dubai', ruwais: 'Ruwais', 'الرويس': 'Ruwais', liwa: 'Liwa', 'ليوا': 'Liwa', 'madinat zayed': 'Madinat Zayed', 'مدينه زايد': 'Madinat Zayed' };
  const ALIAS = { 'الكورنيش': 'Corniche', 'مارينا': 'Marina Mall', 'ياس': 'Yas Island', 'المطار': 'Zayed Intl Airport', 'المصفح': 'Mussafah', 'خليفه': 'Khalifa City', 'الوحده': 'Al Wahda Mall', 'السعديات': 'Saadiyat Beach', 'اللوفر': 'Louvre Abu Dhabi',
    'المسجد': 'Grand Mosque', 'مصدر': 'Masdar City', 'شخبوط': 'Shakhbout City', 'المريه': 'Al Maryah Island', 'الريم': 'Al Reem Island', 'الشمخه': 'Al Shamkha', 'الراحه': 'Al Raha Beach' };
  const EVENT = { 'grand prix': 'EV1', 'formula': 'EV1', 'f1': 'EV1', 'سباق': 'EV1', 'concert': 'EV2', 'arena': 'EV2', 'حفل': 'EV2', 'book fair': 'EV3', 'معرض': 'EV3', 'taraweeh': 'EV4', 'ramadan': 'EV4', 'تراويح': 'EV4', 'رمضان': 'EV4', 'national day': 'EV5', 'fireworks': 'EV5', 'العيد الوطني': 'EV5', 'louvre': 'EV6', 'اللوفر': 'EV6' };
  const has = (n, re) => re.test(n);
  const L = (en, ar) => (A.lang === 'ar' ? ar : en);
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const AD = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  function slots(n) {
    const s = { n: 5, hour: null, day: /weekend|نهايه الاسبوع|عطله/.test(n) ? 'weekend' : 'weekday', route: null, stops: [], city: null, zones: [], event: null };
    let m;
    const num = n.match(/(?:\btop\b|\bfirst\b|\bأعلى\b|اعلى|اكثر)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:top\b|routes|stops|segments|vehicles|خطوط|محطات|مركبات)/);
    if (num) s.n = Math.min(20, +(num[1] || num[2]));
    if ((m = n.match(/\bat\s*(\d{1,2})\s*(am|pm)?\b|\b(\d{1,2})[:.]00\b|\b(\d{1,2})\s*(am|pm)\b|الساعه\s*(\d{1,2})|\bhour\s*(\d{1,2})\b/))) {
      let h = +(m[1] || m[3] || m[4] || m[6] || m[7]); const ap = m[2] || m[5];
      if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (h >= 0 && h <= 23) s.hour = h;
    } else if (has(n, /morning|rush.?hour|صباح/)) s.hour = 8; else if (has(n, /evening|مساء/)) s.hour = 18; else if (has(n, /midday|noon|ظهر/)) s.hour = 13; else if (has(n, /night|ليل/)) s.hour = 23;
    if ((m = n.match(/\b(t\d{1,2}|al1|i\d)\b/))) s.route = m[1].toUpperCase();
    for (const k of Object.keys(CITY)) if (n.includes(A.norm(k))) { s.city = CITY[k]; break; }
    Object.values(A.stops).filter((x) => x.is_hub).sort((a, b) => b.name.length - a.name.length).forEach((st) => { const nm = A.norm(st.name); if (n.includes(nm) && !s.stops.some((x) => A.norm(A.stops[x].name).includes(nm))) s.stops.push(st.stop_id); });
    Object.entries(ALIAS).forEach(([k, v]) => { if (n.includes(A.norm(k))) { const id = A.stopsHub.find((x) => x.name === v)?.stop_id; if (id && !s.stops.includes(id)) s.stops.push(id); } });
    s.stops.sort((a, b) => n.indexOf(A.norm(A.stops[a].name)) - n.indexOf(A.norm(A.stops[b].name)));
    Object.keys(A.D.meta.zones).forEach((z) => { if (n.includes(A.norm(z))) s.zones.push(z); });
    for (const k of Object.keys(EVENT)) if (n.includes(A.norm(k))) { s.event = EVENT[k]; break; }
    const deictic = has(n, /\bthis\b|\bselected\b|\bit\b|\babout\b|هذا|المحدد|هذه/);
    if (A.sel && (deictic || (!s.route && !s.stops.length))) { if (A.sel.type === 'route' && !s.route) s.route = A.sel.id; if (A.sel.type === 'stop' && !s.stops.length) s.stops = [A.sel.id]; s.sel = A.sel; }
    return s;
  }

  function interpret(text) {
    const n = A.norm(AD(text)), s = slots(n), hr = s.hour, dt = s.day;
    if (s.sel && has(n, /\bthis\b|\bselected\b|\babout\b|profile|هذا|المحدد|هذه|عن/) && !has(n, /slow|transfer|overlap|origin|بطي|تبديل/)) {
      if (s.sel.type === 'stop') return { intent: 'stop_profile', s, sql: `SELECT hour, validations FROM stop_hour WHERE stop_id=${q(s.sel.id)} ORDER BY hour` };
      if (s.sel.type === 'route') return { intent: 'route_profile', s, sql: `SELECT hour, trips, validations, load_ratio FROM route_hour WHERE route_id=${q(s.sel.id)} AND day_type=${q(dt)} ORDER BY hour` };
      if (s.sel.type === 'segment') return { intent: 'seg_profile', s, sql: `SELECT hour, speed_kmh, travel_min, delay_idx FROM segment_hour WHERE seg_id=${q(s.sel.id)} ORDER BY hour` };
      if (s.sel.type === 'vehicle') return { intent: 'vehicle', s, sql: `SELECT vehicle_id, route_id, fuel_type, soc_pct, health_score, status, km_today FROM fleet WHERE vehicle_id=${q(s.sel.id)}` };
      if (s.sel.type === 'zone') return { intent: 'zone', s, sql: `SELECT zone, population, coverage_400m_pct, avg_walk_m, low_income_pct, senior_pct FROM zone_pop WHERE zone=${q(s.sel.id)}` };
    }
    // ---- new modules
    if (has(n, /event|concert|grand prix|formula|f1\b|fireworks|taraweeh|book fair|surge|فعاليه|سباق|حفل|مهرجان|معرض|تراويح/)) {
      return s.event ? { intent: 'event_detail', s, sql: `SELECT d.hour, d.extra_validations, d.trips_needed, d.gap_trips FROM event_demand d WHERE d.event_id=${q(s.event)} AND d.extra_validations>0 ORDER BY d.hour` }
        : { intent: 'events', s, sql: `SELECT e.name, e.attendance, MAX(d.gap_trips) AS peak_gap_trips, MAX(d.extra_validations) AS peak_extra_validations FROM events e JOIN event_demand d USING(event_id) GROUP BY e.event_id ORDER BY peak_gap_trips DESC LIMIT ${s.n}` };
    }
    if (has(n, /incident|safety|violation|breakdown|near.?miss|alert|حادث|حوادث|بلاغ|سلامه|مخالف/))
      return { intent: 'incidents', s, sql: `SELECT type, COUNT(*) AS incidents, SUM(severity>=3) AS severe, SUM(status='open') AS open FROM incidents${hr != null ? ` WHERE hour=${hr}` : ''} GROUP BY type ORDER BY incidents DESC LIMIT ${s.n}` };
    if (has(n, /emission|co2|carbon|sustainab|انبعاث|كربون|استدام/))
      return has(n, /total|overall|all|how much|اجمال|كم/) ? { intent: 'emis_total', s, sql: `SELECT ROUND(SUM(co2_t_day),1) AS co2_t_day, ROUND(SUM(co2_baseline_t_day),1) AS baseline_t_day, ROUND(SUM(co2_saved_t_day),1) AS saved_t_day, ROUND(SUM(km_day)) AS km_day FROM route_emissions` }
        : { intent: 'emis', s, sql: `SELECT route_id, km_day, ROUND(ev_share*100) AS ev_pct, co2_t_day, co2_saved_t_day FROM route_emissions ORDER BY co2_saved_t_day DESC LIMIT ${s.n}` };
    if (has(n, /charger|charging|depot|kwh|grid load|شاحن|الشحن|شحن|المستودع/) && !has(n, /low soc|low battery|منخفض/))
      return has(n, /peak|ذرو/) ? { intent: 'charge_peak', s, sql: `SELECT hour, ROUND(SUM(kwh)) AS kw FROM charger_hour GROUP BY hour ORDER BY kw DESC LIMIT 3` }
        : { intent: 'chargers', s, sql: `SELECT c.depot, ROUND(AVG(h.utilization_pct)) AS avg_util_pct, ROUND(SUM(h.kwh)) AS kwh FROM charger_hour h JOIN chargers c USING(charger_id)${hr != null ? ` WHERE h.hour=${hr}` : ''} GROUP BY c.depot ORDER BY avg_util_pct DESC` };
    if (has(n, /fleet|electric|\bev\b|vehicle|battery|soc|maintenance|health|اسطول|كهربائ|بطاري|صيانه|مركبه|مركبات/))
      return has(n, /low|soc|battery|منخفض|بطاري/) ? { intent: 'fleet_low', s, sql: `SELECT vehicle_id, route_id, soc_pct, status FROM fleet WHERE fuel_type='electric' AND soc_pct<25 ORDER BY soc_pct LIMIT ${s.n}` }
        : has(n, /health|maintenance|صيانه/) ? { intent: 'fleet_health', s, sql: `SELECT vehicle_id, route_id, health_score, status FROM fleet WHERE health_score<65 ORDER BY health_score LIMIT ${s.n}` }
        : { intent: 'fleet_mix', s, sql: `SELECT fuel_type, COUNT(*) AS vehicles, ROUND(AVG(soc_pct)) AS avg_soc_pct, ROUND(AVG(health_score)) AS avg_health FROM fleet GROUP BY fuel_type ORDER BY vehicles DESC` };
    if (has(n, /heat|hot|dust|weather|temperature|shelter|ac\b|حر|غبار|طقس|مظل|مكيف|حراره/)) {
      const sc = has(n, /dust|غبار|عاصف/) ? 'dust_storm' : has(n, /winter|شتاء/) ? 'winter' : 'summer';
      return has(n, /shelter|stop|ac\b|مظل|مكيف|محط/) ? { intent: 'heat_stops', s, sql: `SELECT s.name, s.zone, SUM(sh.validations) AS validations FROM stops s JOIN stop_hour sh USING(stop_id) WHERE s.shelter_ac=0${hr != null ? ` AND sh.hour=${hr}` : ''} GROUP BY s.stop_id ORDER BY validations DESC LIMIT ${s.n}` }
        : { intent: 'weather', s: { ...s, sc }, sql: `SELECT hour, temp_c, heat_index_c, visibility_km FROM weather_hour WHERE scenario=${q(sc)} ORDER BY heat_index_c DESC LIMIT 5` };
    }
    if (has(n, /equity|access|coverage|underserved|walk|population|resident|تغطيه|وصول|عداله|سكان|مناطق/))
      return { intent: 'equity', s, sql: `SELECT zone, population, coverage_400m_pct, avg_walk_m, low_income_pct FROM zone_pop ORDER BY coverage_400m_pct ASC LIMIT ${s.n}` };
    // ---- transit diagnostics
    if (has(n, /transfer|interchange|تبديل|تحويل/)) return { intent: 'transfers', s, sql: `SELECT s.name, s.city, t.transfers_est FROM transfers t JOIN stops s USING(stop_id) ORDER BY t.transfers_est DESC LIMIT ${s.n}` };
    if (has(n, /\bo\/?d\b|origin|destination|matrix|منشا|وجهه|مصفوفه/)) return { intent: 'od', s, sql: `SELECT origin_zone, dest_zone, trips_est FROM od_zone WHERE origin_zone<>dest_zone${s.zones.length ? ` AND origin_zone=${q(s.zones[0])}` : ''} ORDER BY trips_est DESC LIMIT ${s.n}` };
    if (has(n, /backtrack|circuit|loop|التفاف|رجوع/)) return { intent: 'backtrack', s, sql: `SELECT d.route_id, r.name, d.length_km, d.displacement_km, d.circuity, d.backtrack_km FROM route_diag d JOIN routes r USING(route_id) ORDER BY d.backtrack_km DESC LIMIT ${s.n}` };
    if (has(n, /overlap|duplicat|parallel|تداخل|تكرار/)) return { intent: 'overlap', s, sql: `SELECT route_a, route_b, shared_km, overlap_pct FROM route_overlap ORDER BY overlap_pct DESC LIMIT ${s.n}` };
    const two = s.stops.length >= 2;
    if (has(n, /travel time|duration|how long|how many minutes|journey time|زمن|مده|كم دقيقه/) || (two && has(n, /between|from|بين|من/))) {
      if (two) { const [a, b] = s.stops; for (const rid of s.route ? [s.route] : Object.keys(A.routeStops)) { const seq = A.routeStops[rid], i = seq.indexOf(a), j = seq.indexOf(b);
        if (i >= 0 && j >= 0) return { intent: 'travel_pair', s: { ...s, route: rid }, sql: `SELECT sh.hour, ROUND(SUM(sh.travel_min),1) AS minutes FROM segments sg JOIN segment_hour sh USING(seg_id) WHERE sg.route_id=${q(rid)} AND sg.seq>=${Math.min(i, j) + 1} AND sg.seq<${Math.max(i, j) + 1} GROUP BY sh.hour ORDER BY sh.hour` }; }
        return { intent: 'travel_nopair', s, sql: null }; }
      if (s.route) return { intent: 'travel_route', s, sql: `SELECT sh.hour, ROUND(SUM(sh.travel_min),1) AS minutes FROM segments sg JOIN segment_hour sh USING(seg_id) WHERE sg.route_id=${q(s.route)} GROUP BY sh.hour ORDER BY sh.hour` };
    }
    if (has(n, /slow|delay|congest|speed|bottleneck|بطي|ابطا|تاخير|اختناق|سرعه/))
      return hr == null ? { intent: 'slow_all', s, sql: `SELECT sg.seg_id, sg.route_id, f.name AS from_stop, t.name AS to_stop, sg.slow_hours, sg.free_speed_kmh FROM segments sg JOIN stops f ON f.stop_id=sg.from_stop JOIN stops t ON t.stop_id=sg.to_stop ORDER BY sg.slow_hours DESC, sg.dist_km DESC LIMIT ${s.n}` }
        : { intent: 'slow_hour', s, sql: `SELECT sg.seg_id, sg.route_id, f.name AS from_stop, t.name AS to_stop, sh.speed_kmh, sh.delay_idx FROM segment_hour sh JOIN segments sg USING(seg_id) JOIN stops f ON f.stop_id=sg.from_stop JOIN stops t ON t.stop_id=sg.to_stop WHERE sh.hour=${hr} ORDER BY sh.delay_idx DESC LIMIT ${s.n}` };
    if (has(n, /peak|rush|busiest hour|ذرو/) && !has(n, /stop|محط/)) return { intent: 'peak', s, sql: `SELECT hour, SUM(validations) AS validations FROM route_hour WHERE day_type=${q(dt)}${s.route ? ` AND route_id=${q(s.route)}` : ''} GROUP BY hour ORDER BY validations DESC LIMIT 3` };
    if (has(n, /overload|capacity|crowd|ratio|utiliz|load|ازدحام|اكتظاظ|اشغال|سعه|حموله/)) {
      if (s.route) return { intent: 'route_profile', s, sql: `SELECT hour, trips, validations, load_ratio FROM route_hour WHERE route_id=${q(s.route)} AND day_type=${q(dt)} ORDER BY hour` };
      return hr == null ? { intent: 'overload', s, sql: `SELECT r.route_id, r.name, ROUND(MAX(rh.load_ratio),2) AS peak_load_ratio, rh.hour AS peak_hour FROM route_hour rh JOIN routes r USING(route_id) WHERE rh.day_type=${q(dt)} AND rh.load_ratio IS NOT NULL GROUP BY r.route_id ORDER BY peak_load_ratio DESC LIMIT ${s.n}` }
        : { intent: 'overload_h', s, sql: `SELECT r.route_id, r.name, ROUND(rh.load_ratio,2) AS load_ratio, rh.validations, rh.capacity_total FROM route_hour rh JOIN routes r USING(route_id) WHERE rh.day_type=${q(dt)} AND rh.hour=${hr} AND rh.load_ratio IS NOT NULL ORDER BY rh.load_ratio DESC LIMIT ${s.n}` };
    }
    if (has(n, /stop|station|demand|validation|passenger|busiest|cluster|محط|موقف|طلب|ركاب|تحقق/)) {
      if (s.stops.length === 1 && !has(n, /top|busiest|most|اكثر/)) return { intent: 'stop_profile', s, sql: `SELECT hour, validations FROM stop_hour WHERE stop_id=${q(s.stops[0])} ORDER BY hour` };
      return { intent: 'stops', s, sql: `SELECT s.stop_id, s.name, s.city, SUM(sh.validations) AS validations FROM stop_hour sh JOIN stops s USING(stop_id) WHERE 1=1${hr != null ? ` AND sh.hour=${hr}` : ''}${s.city ? ` AND s.city=${q(s.city)}` : ''} GROUP BY s.stop_id ORDER BY validations DESC LIMIT ${s.n}` };
    }
    if (has(n, /how many|count|number of|list|route|كم|عدد|خطوط/)) return has(n, /stop|محط/) ? { intent: 'count_stops', s, sql: `SELECT city, COUNT(*) AS stops FROM stops GROUP BY city ORDER BY stops DESC` } : { intent: 'count_routes', s, sql: `SELECT city, COUNT(*) AS routes FROM routes GROUP BY city ORDER BY routes DESC` };
    return { intent: 'unknown', s, sql: null };
  }

  /* ------------------------------------------------------ summaries (from aggregated rows only) */
  function summarize(it, cols, rows) {
    const r0 = rows[0], c = (k) => cols.indexOf(k), H = A.hh, at = it.s.hour != null ? L(` at ${H(it.s.hour)}`, ` عند ${H(it.s.hour)}`) : '';
    if (!rows.length) return L('No results for this query.', 'لا توجد نتائج لهذا الاستعلام.');
    switch (it.intent) {
      case 'overload': { const over = rows.filter((r) => r[2] >= 1).length; return L(`Most loaded route: ${r0[1]} (${r0[0]}), peak demand/capacity ${r0[2]} at ${H(r0[3])}. ${over} of the ${rows.length} listed routes exceed 1.0 (demand above capacity).`, `أكثر الخطوط ازدحامًا: ${r0[1]} (${r0[0]}) بنسبة طلب إلى سعة ${r0[2]} عند ${H(r0[3])}. ${over} من ${rows.length} خطوط تتجاوز 1.0 (الطلب أعلى من السعة).`); }
      case 'overload_h': return L(`Most loaded route${at}: ${r0[1]} (${r0[0]}), ratio ${r0[2]}.`, `أكثر الخطوط ازدحامًا${at}: ${r0[1]} (${r0[0]}) بنسبة ${r0[2]}.`);
      case 'stops': return L(`Busiest stop${at}: ${r0[1]} (${r0[2]}) with ${A.fmt(r0[3])} validations.`, `أكثر المحطات طلبًا${at}: ${r0[1]} (${r0[2]}) بعدد ${A.fmt(r0[3])} عملية تحقق.`);
      case 'stop_profile': { const v = rows.map((r) => r[1]), mx = Math.max(...v), id = it.s.stops[0] || it.s.sel?.id, nm = A.stops[id]?.name || ''; return L(`${nm}: ${A.fmt(v.reduce((a, b) => a + b, 0))} validations per day, peaking at ${H(v.indexOf(mx))} (${A.fmt(mx)}).`, `${nm}: ${A.fmt(v.reduce((a, b) => a + b, 0))} عملية تحقق يوميًا بذروة عند ${H(v.indexOf(mx))} (${A.fmt(mx)}).`); }
      case 'route_profile': { const lr = rows.map((r) => r[3] ?? 0), mx = Math.max(...lr), id = it.s.route || it.s.sel?.id; return L(`Route ${id}: peak demand/capacity ${mx.toFixed(2)} at ${H(lr.indexOf(mx))}. ${mx >= 1 ? 'Demand exceeds capacity in the peak.' : 'Capacity holds even in the peak.'}`, `الخط ${id}: أعلى نسبة طلب إلى سعة ${mx.toFixed(2)} عند ${H(lr.indexOf(mx))}. ${mx >= 1 ? 'الطلب يتجاوز السعة وقت الذروة.' : 'السعة كافية حتى وقت الذروة.'}`); }
      case 'seg_profile': { const sp = rows.map((r) => r[1]), mn = Math.min(...sp), h = sp.indexOf(mn); return L(`Slowest on this segment: ${mn} km/h at ${H(h)}, ${rows[h][3]}× slower than free flow.`, `أبطأ سرعة على هذا المقطع: ${mn} كم/س عند ${H(h)} أي ${rows[h][3]} مرة أبطأ من الانسياب الحر.`); }
      case 'slow_all': return L(`Most persistently slow segment: ${r0[2]} → ${r0[3]} (${r0[1]}), below 75% of free-flow speed for ${r0[4]} hours a day.`, `أكثر المقاطع بطئًا باستمرار: ${r0[2]} ← ${r0[3]} (${r0[1]}) بسرعة أقل من 75% من الانسياب الحر لمدة ${r0[4]} ساعات يوميًا.`);
      case 'slow_hour': return L(`Slowest segment${at}: ${r0[2]} → ${r0[3]} (${r0[1]}) at ${r0[4]} km/h (delay index ${r0[5]}).`, `أبطأ مقطع${at}: ${r0[2]} ← ${r0[3]} (${r0[1]}) بسرعة ${r0[4]} كم/س (مؤشر التأخير ${r0[5]}).`);
      case 'travel_pair': case 'travel_route': { const mn = rows.map((r) => r[1]), lo = Math.min(...mn), hi = Math.max(...mn), nm = it.intent === 'travel_pair' ? `${A.stops[it.s.stops[0]].name} → ${A.stops[it.s.stops[1]].name} (${it.s.route})` : it.s.route; return L(`${nm}: travel time ${lo}–${hi} min, longest at ${H(mn.indexOf(hi))}.`, `${nm}: زمن الرحلة ${lo}–${hi} دقيقة، الأطول عند ${H(mn.indexOf(hi))}.`); }
      case 'transfers': return L(`Top transfer hotspot: ${r0[0]} (${r0[1]}), ≈${A.fmt(r0[2])} transfers/day. Network average ${A.D.eda.chaining.avg_transfers} transfers per journey.`, `أكبر نقطة تبديل: ${r0[0]} (${r0[1]}) بنحو ${A.fmt(r0[2])} عملية تبديل يوميًا. المتوسط ${A.D.eda.chaining.avg_transfers} لكل رحلة.`);
      case 'od': return L(`Strongest flow: ${r0[0]} → ${r0[1]}, ≈${A.fmt(r0[2])} trips/day (estimated from each card's next boarding).`, `أقوى حركة: ${r0[0]} ← ${r0[1]} بنحو ${A.fmt(r0[2])} رحلة يوميًا (تقدير من الصعود التالي لكل بطاقة).`);
      case 'overlap': return L(`Most overlapping routes: ${r0[0]} and ${r0[1]} share ${r0[2]} km (${r0[3]}% of the shorter route).`, `أكثر الخطوط تداخلًا: ${r0[0]} و${r0[1]} بمسافة مشتركة ${r0[2]} كم (${r0[3]}% من الخط الأقصر).`);
      case 'backtrack': return L(`Most backtracking route: ${r0[0]} (${r0[1]}), circuity ${r0[4]}, ${r0[5]} km against the main direction.`, `أكثر الخطوط التفافًا: ${r0[0]} (${r0[1]}) بمعامل التواء ${r0[4]} و${r0[5]} كم عكس الاتجاه الرئيسي.`);
      case 'peak': return L(`Peak hour: ${H(r0[0])} (${A.fmt(r0[1])} validations). Next: ${rows.slice(1).map((r) => H(r[0])).join(', ')}.`, `ساعة الذروة: ${H(r0[0])} (${A.fmt(r0[1])} عملية تحقق). التالية: ${rows.slice(1).map((r) => H(r[0])).join('، ')}.`);
      case 'count_stops': case 'count_routes': { const t = rows.reduce((a, r) => a + r[1], 0), w = it.intent === 'count_stops'; return L(`${t} ${w ? 'stops' : 'routes'} in total; most in ${r0[0]} (${r0[1]}).`, `${t} ${w ? 'محطة' : 'خط'} إجمالًا؛ الأكثر في ${r0[0]} (${r0[1]}).`); }
      case 'fleet_mix': { const t = rows.reduce((a, r) => a + r[1], 0), ev = rows.find((r) => r[0] === 'electric'); return L(`Fleet of ${t} vehicles; ${ev ? ev[1] + ' electric (' + Math.round(100 * ev[1] / t) + '%), average SOC ' + ev[2] + '%' : 'no electric vehicles'}.`, `الأسطول ${t} مركبة؛ ${ev ? ev[1] + ' كهربائية (' + Math.round(100 * ev[1] / t) + '%) بمتوسط شحن ' + ev[2] + '%' : 'لا توجد مركبات كهربائية'}.`); }
      case 'fleet_low': return L(`${rows.length} electric vehicle(s) below 25% charge; lowest: ${r0[0]} on ${r0[1]} at ${r0[2]}% (${r0[3]}).`, `${rows.length} مركبة كهربائية بشحن أقل من 25%؛ الأدنى: ${r0[0]} على الخط ${r0[1]} بنسبة ${r0[2]}% (${r0[3]}).`);
      case 'fleet_health': return L(`${rows.length} vehicle(s) with health score below 65; worst: ${r0[0]} (${r0[2]}) on ${r0[1]}. Schedule inspection.`, `${rows.length} مركبة بدرجة صحة أقل من 65؛ الأسوأ: ${r0[0]} (${r0[2]}) على الخط ${r0[1]}. يُنصح بجدولة فحص.`);
      case 'vehicle': return L(`Vehicle ${r0[0]} (${r0[1]}): ${r0[2]}, ${r0[3] != null ? 'SOC ' + r0[3] + '%, ' : ''}health ${r0[4]}, status ${r0[5]}, ${r0[6]} km today.`, `المركبة ${r0[0]} (${r0[1]}): ${r0[2]}، ${r0[3] != null ? 'الشحن ' + r0[3] + '%، ' : ''}الصحة ${r0[4]}، الحالة ${r0[5]}، ${r0[6]} كم اليوم.`);
      case 'chargers': return L(`Busiest depot${at}: ${r0[0]} at ${r0[1]}% average charger utilization (${A.fmt(r0[2])} kWh).`, `أكثر المستودعات استخدامًا${at}: ${r0[0]} بمتوسط استخدام شواحن ${r0[1]}% (${A.fmt(r0[2])} ك.و.س).`);
      case 'charge_peak': return L(`Charging load peaks at ${H(r0[0])} with ${A.fmt(r0[1])} kW; next ${rows.slice(1).map((r) => H(r[0])).join(', ')}. Consider shifting sessions to midday solar hours.`, `يبلغ حمل الشحن ذروته عند ${H(r0[0])} بقيمة ${A.fmt(r0[1])} ك.و؛ ثم ${rows.slice(1).map((r) => H(r[0])).join('، ')}. يُقترح نقل جزء من الجلسات لساعات الظهيرة الشمسية.`);
      case 'events': return L(`Largest surge gap: ${r0[0]} — ${A.fmt(r0[1])} attendees, peak shortfall ${r0[2]} trips/hour.`, `أكبر فجوة ذروة: ${r0[0]} — ${A.fmt(r0[1])} حاضر، نقص أقصى ${r0[2]} رحلة/ساعة.`);
      case 'event_detail': { const g = rows.map((r) => r[3]), mx = Math.max(...g); return L(`Surge runs ${H(rows[0][0])}–${H(rows[rows.length - 1][0])}; worst shortfall ${mx} trips at ${H(rows[g.indexOf(mx)][0])}.`, `تمتد الذروة من ${H(rows[0][0])} إلى ${H(rows[rows.length - 1][0])}؛ أسوأ نقص ${mx} رحلة عند ${H(rows[g.indexOf(mx)][0])}.`); }
      case 'incidents': return L(`${rows.reduce((a, r) => a + r[1], 0)} incidents${at}; most common: ${r0[0].replace(/_/g, ' ')} (${r0[1]}, ${r0[2]} severe, ${r0[3]} open).`, `${rows.reduce((a, r) => a + r[1], 0)} حادثة${at}؛ الأكثر شيوعًا: ${r0[0].replace(/_/g, ' ')} (${r0[1]}، ${r0[2]} خطيرة، ${r0[3]} مفتوحة).`);
      case 'weather': return L(`${it.s.sc.replace('_', ' ')}: peak heat index ${r0[2]}°C at ${H(r0[0])} (air ${r0[1]}°C, visibility ${r0[3]} km).`, `${it.s.sc}: أعلى مؤشر حرارة ${r0[2]}°م عند ${H(r0[0])} (الهواء ${r0[1]}°م، الرؤية ${r0[3]} كم).`);
      case 'heat_stops': return L(`Highest-demand stop without AC shelter${at}: ${r0[0]} (${r0[1]}), ${A.fmt(r0[2])} validations. Prioritise shelter retrofits here.`, `أعلى محطة طلبًا دون مظلة مكيفة${at}: ${r0[0]} (${r0[1]}) بعدد ${A.fmt(r0[2])} عملية تحقق. تُعطى الأولوية لتركيب مظلات.`);
      case 'equity': return L(`Least covered zone: ${r0[0]} — only ${r0[2]}% of ${A.fmt(r0[1])} residents within 400 m of a stop (avg walk ${r0[3]} m, ${r0[4]}% low-income).`, `أقل المناطق تغطية: ${r0[0]} — ${r0[2]}% فقط من ${A.fmt(r0[1])} ساكن ضمن 400 م من محطة (متوسط المشي ${r0[3]} م، ${r0[4]}% دخل منخفض).`);
      case 'zone': return L(`${r0[0]}: ${A.fmt(r0[1])} residents, ${r0[2]}% within 400 m of a stop, average walk ${r0[3]} m.`, `${r0[0]}: ${A.fmt(r0[1])} ساكن، ${r0[2]}% ضمن 400 م من محطة، متوسط المشي ${r0[3]} م.`);
      case 'emis': return L(`Biggest CO₂ saving: route ${r0[0]} (${r0[2]}% EV) saves ${r0[4]} t/day of ${r0[3]} t emitted.`, `أكبر وفر في ثاني أكسيد الكربون: الخط ${r0[0]} (${r0[2]}% كهربائي) يوفر ${r0[4]} طن/يوم من ${r0[3]} طن منبعثة.`);
      case 'emis_total': return L(`Network emits ${r0[0]} t CO₂/day over ${A.fmt(r0[3])} bus-km; electrification already saves ${r0[2]} t/day versus an all-diesel baseline (${r0[1]} t).`, `تنبعث من الشبكة ${r0[0]} طن/يوم على ${A.fmt(r0[3])} كم؛ التحول الكهربائي يوفر ${r0[2]} طن/يوم مقارنةً بالديزل بالكامل (${r0[1]} طن).`);
    }
    return '';
  }

  const EX = {
    en: ['Which 5 routes are most overloaded?', 'Slowest segments at 8am', 'Which electric buses are below 25% charge?', 'When does charging load peak?', 'Which event has the biggest surge gap?', 'Which stops without AC shelter have the most riders?', 'Which zones have the lowest 400 m coverage?', 'How much CO2 does electrification save?', 'Incidents by type', 'Travel time between Marina Mall and Al Wahda Mall', 'Tell me about the selected object'],
    ar: ['ما أكثر 5 خطوط ازدحامًا؟', 'أبطأ المقاطع عند الساعة 8', 'أي الحافلات الكهربائية شحنها أقل من 25%؟', 'متى يبلغ حمل الشحن ذروته؟', 'أي فعالية لديها أكبر فجوة في الذروة؟', 'أي المحطات بلا مظلة مكيفة لديها أكثر الركاب؟', 'أي المناطق الأقل تغطية؟', 'كم يوفر التحول الكهربائي من الانبعاثات؟', 'الحوادث حسب النوع', 'أخبرني عن العنصر المحدد'],
  };

  let busy = false;
  const addMsg = (cls, html) => { const el = document.createElement('div'); el.className = 'm ' + cls; el.innerHTML = html; const b = document.getElementById('msgs'); b.appendChild(el); b.scrollTop = b.scrollHeight; return el; };
  async function ask(text) {
    text = text.trim(); if (!text || busy) return; busy = true; addMsg('u', A.esc(text));
    const it = interpret(text), role = A.user.role; let html, status = 'OK', resp = '';
    try {
      if (!it.sql) {
        status = 'NO_INTENT';
        resp = it.intent === 'travel_nopair' ? L('These two stops are not on one route. Name a route (e.g. T1).', 'المحطتان ليستا على خط واحد. حدد خطًا (مثل T1).') : L('I could not turn that into SQL. Try an example: route load, slow segments, EV charge, chargers, events, incidents, heat, equity, emissions, transfers, O/D.', 'تعذر تحويل السؤال إلى SQL. جرّب مثالًا: ازدحام الخطوط، المقاطع البطيئة، شحن الحافلات، الفعاليات، الحوادث، الحرارة، العدالة، الانبعاثات.');
        html = A.esc(resp);
      } else {
        const res = await A.runSQL(it.sql, role), shown = res.rows.slice(0, 50), mk = A.mask(res.cols, shown, role), summary = summarize(it, res.cols, res.rows); resp = summary;
        const hourly = res.cols[0] === 'hour' && res.cols.length >= 2, vi = res.cols.indexOf('load_ratio') >= 0 ? res.cols.indexOf('load_ratio') : 1;
        const chart = hourly && res.rows.length > 4 ? A.bar(res.rows.map((r) => r[vi]), { labels: res.rows.map((r) => A.pad(r[0])), ref: res.cols[vi] === 'load_ratio' ? 1 : null, refLabel: '1.0', label: res.cols[vi] }) : '';
        html = `<div>${A.esc(summary)}</div>${chart}<details open><summary>${A.t('sql_label')} · ${res.rows.length} ${L('rows', 'صفوف')}</summary><pre>${A.esc(it.sql)}</pre><div class="tw">${A.tableHTML(res.cols, mk.rows)}</div></details>` +
          `<div class="meta">${A.t('rows_to_model')}: ${shown.length} (aggregated)${mk.masked ? ` · ${mk.masked} small cells masked (k=${A.kFor(role)})` : ''} · role: ${role}</div>`;
      }
    } catch (e) { status = e.code || 'ERROR'; resp = e.msg || String(e); html = `<span class="badge bad">${A.t('denied')}</span> ${A.esc(resp)}`; }
    addMsg('a', html); A.audit.append('chat', text, it.sql || '', resp, status); busy = false;
  }
  A.ask = ask;
  function renderSel() { const c = document.getElementById('ctxChip'); c.hidden = !A.sel; if (A.sel) { c.innerHTML = `◎ ${A.t('selected')}: <b>${A.esc(A.selLabel(A.sel))}</b> <button type="button" id="ctxClear">${A.t('clear')}</button>`; document.getElementById('ctxClear').onclick = () => A.select(null); } }
  function renderExamples() { const b = document.getElementById('examples'); b.innerHTML = EX[A.lang].map((x) => `<button type="button">${A.esc(x)}</button>`).join(''); b.querySelectorAll('button').forEach((el) => (el.onclick = () => ask(el.textContent))); }
  A.initAgent = () => {
    document.getElementById('chatForm').onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('chatInput'); ask(i.value); i.value = ''; };
    document.getElementById('schemaBox').innerHTML = Object.entries(A.schema).map(([t, c]) => `<div><b>${t}</b>(${c.join(', ')})</div>`).join('');
    renderExamples(); renderSel(); A.on('select', renderSel); A.on('lang', () => { renderExamples(); renderSel(); });
    addMsg('a', L('Hello! Ask about the network, fleet & EV charging, events, incidents, heat, equity or emissions — in English or Arabic. You can also pick a stop, route, segment or vehicle on the map and press “Ask Copilot”.', 'مرحبًا! اسأل عن الشبكة أو الأسطول وشحن الحافلات أو الفعاليات أو الحوادث أو الحرارة أو العدالة أو الانبعاثات — بالعربية أو الإنجليزية. يمكنك أيضًا اختيار محطة أو خط أو مقطع أو مركبة على الخريطة والضغط على «اسأل المساعد».'));
  };
})();
