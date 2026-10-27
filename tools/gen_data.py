"""Synthetic AYNA-style dataset generator (stdlib only, deterministic).

Produces:
  data/dataset.js        window.AYNA_DATA  (aggregated tables + EDA stats; no card ids)
  vendor/sql-wasm-b64.js sql.js wasm as base64 so the app also works from file://

Everything here is SYNTHETIC. Coordinates of hubs are approximate; the network,
demand and speeds are invented for demonstration and do not describe real AYNA
services. The raw validation sample used for O/D chaining is generated in
memory, processed, and only the aggregates are written out (SC-04).

    python3 tools/gen_data.py
"""
import base64, hashlib, json, math, os, random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
random.seed(20261027)

# ---------------------------------------------------------------- geography
HUBS = {  # name: (lat, lon, city)
    "Icherisheher": (40.3660, 49.8370, "Baku"), "28 May": (40.3797, 49.8486, "Baku"),
    "Genclik": (40.4003, 49.8514, "Baku"), "Narimanov": (40.4067, 49.8700, "Baku"),
    "Ulduz": (40.4154, 49.8883, "Baku"), "Koroglu": (40.4207, 49.9187, "Baku"),
    "Airport": (40.4675, 50.0467, "Baku"), "Memar Ajami": (40.4118, 49.8130, "Baku"),
    "Khatai": (40.3830, 49.8830, "Baku"), "Hazi Aslanov": (40.3737, 49.9530, "Baku"),
    "Sahil": (40.3725, 49.8447, "Baku"), "Bibi-Heybat": (40.3340, 49.8160, "Baku"),
    "Bayil": (40.3480, 49.8300, "Baku"), "Lokbatan": (40.3100, 49.7300, "Baku"),
    "Surakhani": (40.4160, 50.0050, "Baku"), "Bina": (40.4400, 50.0600, "Baku"),
    "Mardakan": (40.4900, 50.1400, "Baku"), "Khirdalan": (40.4486, 49.7550, "Baku"),
    "Bus Terminal": (40.4100, 49.8000, "Baku"),
    "Sumgait": (40.5897, 49.6686, "Sumgait"),
    "Ganja Center": (40.6828, 46.3606, "Ganja"), "Ganja Railway": (40.6720, 46.3400, "Ganja"),
    "Ganja East": (40.6850, 46.3900, "Ganja"), "Ganja Airport": (40.7377, 46.3176, "Ganja"),
    "Shamakhi": (40.6319, 48.6364, "Shamakhi"), "Yevlakh": (40.6197, 47.1500, "Yevlakh"),
    "Mingachevir": (40.7703, 47.0496, "Mingachevir"), "Sheki": (41.1919, 47.1706, "Sheki"),
    "Gabala": (40.9814, 47.8458, "Gabala"), "Quba": (41.3611, 48.5126, "Quba"),
    "Shirvan": (39.9300, 48.9200, "Shirvan"), "Salyan": (39.5953, 48.9843, "Salyan"),
    "Lankaran": (38.7540, 48.8510, "Lankaran"),
    "Nakhchivan Airport": (39.1888, 45.4584, "Nakhchivan"),
    "Nakhchivan Center": (39.2089, 45.4122, "Nakhchivan"),
    "Nakhchivan Bus": (39.2200, 45.4000, "Nakhchivan"),
}
ZONES = {  # approximate zone centroids used only to group stops for O/D
    "Sabail": (40.3650, 49.8350), "Nasimi": (40.4000, 49.8300), "Yasamal": (40.3950, 49.8000),
    "Narimanov": (40.4070, 49.8650), "Khatai": (40.3850, 49.8800), "Binagadi": (40.4500, 49.8300),
    "Sabunchu": (40.4400, 49.9500), "Surakhani": (40.4200, 50.0200), "Khazar": (40.4700, 50.1200),
    "Garadagh": (40.3000, 49.6900), "Khirdalan": (40.4486, 49.7550), "Sumgait": (40.5897, 49.6686),
    "Ganja": (40.6828, 46.3606), "Mingachevir": (40.7703, 47.0496), "Sheki": (41.1919, 47.1706),
    "Lankaran": (38.7540, 48.8510), "Nakhchivan": (39.2089, 45.4122), "Quba": (41.3611, 48.5126),
    "Shamakhi": (40.6319, 48.6364), "Shirvan": (39.9300, 48.9200),
}
# name: [waypoints], city, kind, capacity, daily validations, peak headway (min)
ROUTES = [
    ("B1", "Sahil – Airport", ["Icherisheher", "28 May", "Genclik", "Narimanov", "Ulduz", "Koroglu", "Airport"], "Baku", "city", 120, 17000, 6),
    ("B2", "Genclik – Khirdalan", ["Genclik", "Memar Ajami", "Khirdalan"], "Baku", "city", 85, 10500, 11),
    ("B3", "Bibi-Heybat – Hazi Aslanov", ["Bibi-Heybat", "Bayil", "Icherisheher", "Khatai", "Hazi Aslanov"], "Baku", "city", 85, 9000, 9),
    ("B4", "28 May – Mardakan", ["28 May", "Khatai", "Hazi Aslanov", "Mardakan"], "Baku", "city", 85, 7500, 10),
    ("B5", "Narimanov – Sumgait", ["Narimanov", "Memar Ajami", "Khirdalan", "Sumgait"], "Baku", "city", 85, 9800, 12),
    ("B6", "Icherisheher – Genclik (express)", ["Icherisheher", "28 May", "Genclik"], "Baku", "city", 85, 6000, 8),
    ("B7", "Sahil – Genclik (loop via east)", ["Sahil", "Hazi Aslanov", "Khatai", "Genclik"], "Baku", "city", 85, 4200, 14),
    ("B8", "Lokbatan – Bibi-Heybat", ["Lokbatan", "Bibi-Heybat"], "Baku", "city", 85, 4800, 12),
    ("B9", "Koroglu – Bina", ["Koroglu", "Surakhani", "Bina"], "Baku", "city", 85, 5200, 12),
    ("G1", "Ganja Railway – Ganja East", ["Ganja Railway", "Ganja Center", "Ganja East"], "Ganja", "city", 85, 5200, 10),
    ("G2", "Ganja Airport – Ganja Railway", ["Ganja Airport", "Ganja Center", "Ganja Railway"], "Ganja", "city", 85, 3900, 14),
    ("N1", "Nakhchivan Airport – Bus Station", ["Nakhchivan Airport", "Nakhchivan Center", "Nakhchivan Bus"], "Nakhchivan", "city", 60, 2000, 20),
    ("I1", "Baku – Shamakhi – Ganja", ["Bus Terminal", "Shamakhi", "Yevlakh", "Ganja Center"], "Intercity", "intercity", 50, 1500, 45),
    ("I2", "Baku – Sumgait – Quba", ["Bus Terminal", "Sumgait", "Quba"], "Intercity", "intercity", 50, 1300, 50),
    ("I3", "Baku – Shirvan – Lankaran", ["Bus Terminal", "Shirvan", "Salyan", "Lankaran"], "Intercity", "intercity", 50, 1100, 60),
    ("I4", "Ganja – Yevlakh – Mingachevir", ["Ganja Center", "Yevlakh", "Mingachevir"], "Intercity", "intercity", 50, 900, 60),
    ("I5", "Mingachevir – Sheki – Gabala", ["Mingachevir", "Sheki", "Gabala"], "Intercity", "intercity", 50, 800, 75),
]
COLORS = ["#0b7a75", "#d1495b", "#edae49", "#00798c", "#66a182", "#8d6a9f", "#e07a5f", "#3d5a80",
          "#2a9d8f", "#bc6c25", "#5e60ce", "#43aa8b", "#f3722c", "#277da1", "#9c6644", "#577590", "#90be6d"]
# slow-zone centres: lat, lon, radius km, severity
HOT = [(40.3797, 49.8486, 2.4, 0.62), (40.4067, 49.8700, 2.0, 0.55), (40.4486, 49.7550, 2.6, 0.62),
       (40.4207, 49.9187, 2.0, 0.45), (40.5897, 49.6686, 2.0, 0.40), (40.6828, 46.3606, 2.0, 0.35),
       (40.4675, 50.0467, 3.0, 0.32), (40.4118, 49.8130, 1.8, 0.50)]
CONG = [.05, .04, .03, .03, .05, .12, .35, .75, 1.0, .8, .5, .45, .55, .55, .5, .6, .85, 1.0, .95, .7, .4, .25, .15, .08]
WD = [.003, .002, .001, .001, .004, .02, .05, .09, .095, .065, .045, .04, .05, .05, .045, .055, .07, .095, .09, .06, .04, .03, .017, .008]
WE = [.006, .004, .002, .002, .003, .008, .02, .035, .05, .065, .075, .08, .085, .085, .08, .075, .07, .065, .06, .05, .04, .03, .02, .012]
norm = lambda a: [x / sum(a) for x in a]
WD, WE = norm(WD), norm(WE)


def hav(a, b):
    p = math.pi / 180
    dlat, dlon = (b[0] - a[0]) * p, (b[1] - a[1]) * p
    h = math.sin(dlat / 2) ** 2 + math.cos(a[0] * p) * math.cos(b[0] * p) * math.sin(dlon / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def bearing(a, b):
    p = math.pi / 180
    y = math.sin((b[1] - a[1]) * p) * math.cos(b[0] * p)
    x = math.cos(a[0] * p) * math.sin(b[0] * p) - math.sin(a[0] * p) * math.cos(b[0] * p) * math.cos((b[1] - a[1]) * p)
    return (math.atan2(y, x) / p + 360) % 360


# ------------------------------------------------------------------- stops
stops = {}      # id -> dict
hub_id = {}
leg_cache = {}  # (a,b) with a<b -> [stop ids a..b]
sid = [0]


def new_stop(name, lat, lon, city, hub=False):
    sid[0] += 1
    s = "S%03d" % sid[0]
    z, zd = min(((z, hav((lat, lon), c)) for z, c in ZONES.items()), key=lambda t: t[1])
    stops[s] = dict(stop_id=s, name=name, city=city, zone=z if zd < 25 else "Rural " + city,
                    lat=round(lat, 5), lon=round(lon, 5), hub=hub)
    return s


for n, (la, lo, c) in HUBS.items():
    hub_id[n] = new_stop(n, la, lo, c, True)


def leg_stops(a, b, kind):
    key = (a, b) if a < b else (b, a)
    if key not in leg_cache:
        A, B = HUBS[key[0]], HUBS[key[1]]
        d = hav(A[:2], B[:2])
        n = max(1, round(d / (0.85 if kind == "city" else 16)))
        amp = (0.07 if kind == "city" else 0.05) * d * (1 if int(hashlib.md5(str(key).encode()).hexdigest(), 16) % 2 else -1)
        dx, dy = B[1] - A[1], B[0] - A[0]
        L = math.hypot(dx, dy) or 1
        ids = [hub_id[key[0]]]
        for k in range(1, n):
            t = k / n
            off = amp * math.sin(math.pi * t) / 111.0
            lat = A[0] + dy * t + (dx / L) * off
            lon = A[1] + dx * t - (dy / L) * off
            ids.append(new_stop("%s–%s %d" % (key[0], key[1], k), lat, lon, B[2] if t > .5 else A[2]))
        ids.append(hub_id[key[1]])
        leg_cache[key] = ids
    ids = leg_cache[key]
    return ids if a < b else ids[::-1]


routes, route_stops = {}, {}
for i, (rid, name, wps, city, kind, cap, daily, head) in enumerate(ROUTES):
    seq = []
    for a, b in zip(wps, wps[1:]):
        part = leg_stops(a, b, kind)
        seq += part if not seq else part[1:]
    route_stops[rid] = seq
    routes[rid] = dict(route_id=rid, name=name, city=city, kind=kind, vehicle_capacity=cap,
                       color=COLORS[i % len(COLORS)], daily=daily, head=head)

pos = lambda s: (stops[s]["lat"], stops[s]["lon"])

# ---------------------------------------------------------------- segments
segments, seg_by = [], {}
for rid, seq in route_stops.items():
    kind = routes[rid]["kind"]
    free = 34 if kind == "city" else 72
    for k, (a, b) in enumerate(zip(seq, seq[1:])):
        d = round(hav(pos(a), pos(b)) * 1.18, 3)
        mid = ((pos(a)[0] + pos(b)[0]) / 2, (pos(a)[1] + pos(b)[1]) / 2)
        sev = max(max(0, 1 - hav(mid, (h[0], h[1])) / h[2]) * h[3] for h in HOT)
        fs = round(free * random.uniform(.92, 1.06), 1)
        sp = []
        for h in range(24):
            v = fs * (1 - sev * CONG[h]) * random.uniform(.95, 1.05)
            sp.append(round(max(5.0, v), 1))
        sg = dict(seg_id="%s-%02d" % (rid, k + 1), route_id=rid, seq=k + 1, from_stop=a, to_stop=b,
                  dist_km=d, free_speed_kmh=fs, speeds=sp, sev=round(sev, 3))
        sg["slow_hours"] = sum(1 for v in sp if v < 0.75 * fs)
        segments.append(sg)
        seg_by[(rid, a, b)] = sg


def travel_min(rid, a, b, hour):
    """minutes between two stops (a before b) on route rid at hour."""
    seq = route_stops[rid]
    i, j = seq.index(a), seq.index(b)
    lo, hi = min(i, j), max(i, j)
    t = 0
    for k in range(lo, hi):
        sg = seg_by[(rid, seq[k], seq[k + 1])]
        t += sg["dist_km"] / sg["speeds"][int(hour) % 24] * 60 + 0.4
    return t


# --------------------------------------------------------- route_hour model
route_hour, rv = [], {}
for rid, r in routes.items():
    for dt, prof, scale in (("weekday", WD, 1.0), ("weekend", WE, 0.62)):
        mx = max(prof)
        for h in range(24):
            v = int(r["daily"] * scale * prof[h] * random.uniform(.93, 1.07))
            lvl = prof[h] / mx
            head = r["head"] * (1 + 2.2 * (1 - lvl))
            if r["kind"] == "city" and h < 5: trips = 0
            elif r["kind"] == "intercity" and (h < 6 or h > 21): trips = 0
            else: trips = max(2, int(2 * 60 / head))
            cap = trips * r["vehicle_capacity"]
            lr = round(v * 0.9 / cap, 3) if cap else None
            route_hour.append([rid, dt, h, trips, v, cap, lr])
            if dt == "weekday": rv[(rid, h)] = v

# ---------------------------------------------------------------- stop_hour
sw = {}
for rid, seq in route_stops.items():
    w = [4.0 if stops[s]["hub"] else random.lognormvariate(0, .55) for s in seq]
    tot = sum(w)
    for s, x in zip(seq, w): sw.setdefault(s, {})[rid] = x / tot
stop_hour = {}
for s, d in sw.items():
    stop_hour[s] = [int(sum(rv[(rid, h)] * f for rid, f in d.items())) for h in range(24)]
total_val = sum(rv.values())

# ----------------------------------------------- card sample (O/D chaining)
dirs = {}   # stop -> [(rid, dir, p)]
def directed(rid, d): return route_stops[rid] if d == 0 else route_stops[rid][::-1]
for rid in routes:
    for d in (0, 1):
        for p, s in enumerate(directed(rid, d)):
            dirs.setdefault(s, []).append((rid, d, p))

starts = [s for s in stops if s in dirs]
sweights = [sum(rv[(rid, 8)] * f for rid, f in sw[s].items()) + .5 for s in starts]
N_CARDS = 7000
records, truth = [], []   # records: dict ; truth: per-card legs for accuracy
def pick_leg(s, avoid=None):
    opts = [o for o in dirs[s] if o[2] < len(directed(o[0], o[1])) - 1 and o[0] != avoid]
    if not opts: return None
    rid, d, p = random.choice(opts)
    L = len(directed(rid, d))
    q = min(L - 1, p + 1 + int(random.expovariate(1 / (7 if routes[rid]["kind"] == "city" else 2))))
    return (rid, d, p, q)

for c in range(N_CARDS):
    A = random.choices(starts, sweights)[0]
    l1 = pick_leg(A)
    if not l1: continue
    legs = [l1]
    T = directed(l1[0], l1[1])[l1[3]]
    if random.random() < .3:
        l2 = pick_leg(T, avoid=l1[0])
        if l2: legs.append(l2)
    card = hashlib.sha256(("card%d" % c).encode()).hexdigest()[:16]
    t = random.gauss(8.0, 1.0) * 60
    seqs = [legs, [(r, 1 - d, len(directed(r, d)) - 1 - q, len(directed(r, d)) - 1 - p) for (r, d, p, q) in legs[::-1]]]
    starts_t = [t, random.gauss(17.8, 1.2) * 60]
    if random.random() < .12: seqs, starts_t = seqs[:1], starts_t[:1]
    cardrecs = []
    for si, (lg, t0) in enumerate(zip(seqs, starts_t)):
        t = max(5.5 * 60, min(t0, 22.5 * 60))
        for li, (rid, d, p, q) in enumerate(lg):
            if si == 1 and li == 0 and random.random() < .25:   # boards one stop away from where it got off
                p2 = max(0, min(len(directed(rid, d)) - 2, p + random.choice([-1, 1])))
                p = p2 if p2 < q else p
            ds = directed(rid, d)
            cardrecs.append(dict(card=card, t=t, stop=ds[p], route=rid, dir=d, alight=ds[q]))
            t += travel_min(rid, ds[p], ds[q], t / 60) + random.uniform(4, 12)
    records += cardrecs
    truth.append(cardrecs)

# defects (for the Stage-0 EDA report)
raw = []
for r in records:
    raw.append(dict(r))
    if random.random() < .015: raw.append(dict(r, t=r["t"] + random.uniform(.2, .6), dup=True))
n_dup = sum(1 for r in raw if r.get("dup"))
for r in raw:
    if random.random() < .008: r["stop"] = None
n_missing = sum(1 for r in raw if r["stop"] is None)

# chaining: estimate alighting from the same card's next boarding
by_card = {}
for r in raw:
    if r.get("dup"): continue           # duplicates removed before chaining
    by_card.setdefault(r["card"], []).append(r)
legs_est, hit_leg, tot_leg, hit_zone = [], 0, 0, 0
journeys = []
for card, rs in by_card.items():
    rs.sort(key=lambda r: r["t"])
    for i, r in enumerate(rs):
        nxt = rs[i + 1] if i + 1 < len(rs) else rs[0]
        r["est"] = None
        if r["stop"] is None or nxt["stop"] is None: continue
        ds = directed(r["route"], r["dir"])
        p = ds.index(r["stop"])
        cand = ds[p + 1:]
        if not cand: continue
        best = min(cand, key=lambda s: hav(pos(s), pos(nxt["stop"])))
        if hav(pos(best), pos(nxt["stop"])) <= 0.6:
            r["est"] = best
        tot_leg += 1
        if r["est"] == r["alight"]: hit_leg += 1
        if r["est"] and stops[r["est"]]["zone"] == stops[r["alight"]]["zone"]: hit_zone += 1
    # journeys: merge legs with a different route within 45 min and <=0.5 km walk
    cur = None
    for i, r in enumerate(rs):
        if not r["est"]: cur = None; continue
        if cur and r["route"] != cur["last_route"] and r["t"] - cur["t_end"] <= 45 and \
                hav(pos(r["stop"]), pos(cur["dest"])) <= 0.5:
            cur["transfers"] += 1; cur["tstops"].append(r["stop"]); cur["dest"] = r["est"]
            cur["last_route"] = r["route"]; cur["t_end"] = r["t"]
        else:
            if cur: journeys.append(cur)
            cur = dict(orig=r["stop"], dest=r["est"], transfers=0, tstops=[], last_route=r["route"], t_end=r["t"])
    if cur: journeys.append(cur)
journeys = [j for j in journeys]
expansion = total_val / max(1, len(records))
od, tr = {}, {}
for j in journeys:
    k = (stops[j["orig"]]["zone"], stops[j["dest"]]["zone"])
    od[k] = od.get(k, 0) + 1
    for s in j["tstops"]: tr[s] = tr.get(s, 0) + 1
od_rows = [[a, b, int(n * expansion)] for (a, b), n in sorted(od.items(), key=lambda kv: -kv[1])]
tr_rows = [[s, int(n * expansion)] for s, n in sorted(tr.items(), key=lambda kv: -kv[1])]
n_trans = [sum(1 for j in journeys if j["transfers"] == k) for k in (0, 1, 2)]

# ------------------------------------------------- route overlap/backtracking
def pairs(rid):
    seq = route_stops[rid]
    return {frozenset(p) for p in zip(seq, seq[1:])}
overlap = []
rids = list(routes)
for i, a in enumerate(rids):
    for b in rids[i + 1:]:
        sh = pairs(a) & pairs(b)
        if not sh: continue
        km = sum(hav(pos(list(p)[0]), pos(list(p)[1])) * 1.18 for p in sh)
        la = sum(s["dist_km"] for s in segments if s["route_id"] == a)
        lb = sum(s["dist_km"] for s in segments if s["route_id"] == b)
        overlap.append([a, b, round(km, 2), round(100 * km / min(la, lb), 1)])
overlap.sort(key=lambda r: -r[3])
diag = []
for rid, seq in route_stops.items():
    L = sum(s["dist_km"] for s in segments if s["route_id"] == rid)
    disp = hav(pos(seq[0]), pos(seq[-1]))
    main = bearing(pos(seq[0]), pos(seq[-1]))
    back = 0
    for sg in (s for s in segments if s["route_id"] == rid):
        diffb = abs((bearing(pos(sg["from_stop"]), pos(sg["to_stop"])) - main + 180) % 360 - 180)
        if diffb > 90: back += sg["dist_km"]
    diag.append([rid, round(L, 1), round(disp, 1), round(L / max(disp, .1), 2), round(back, 1),
                 1 if back / L > .12 else 0])

# --------------------------------------------------------------------- EDA
n_val = len(raw)
veh = {rid: max(2, int(max(rv[(rid, h)] for h in range(24)) / 60)) for rid in routes}
n_veh = sum(veh.values())
eda = dict(
    generated="synthetic · seed 20261027",
    sources=[
        dict(name="AFC validations", key="card_id(hash), ts, stop_id, route_id, terminal_id", granularity="event", freq="near-real-time",
             records_day=int(total_val), coverage="1 synthetic weekday"),
        dict(name="AVL pings", key="vehicle_id, ts, lat, lon, speed", granularity="30 s", freq="30 s",
             records_day=int(n_veh * 17 * 3600 / 30), coverage="1 synthetic weekday"),
        dict(name="Registry (routes, stops)", key="route_id, stop_id, seq, geometry", granularity="static", freq="on change",
             records_day=len(stops) + len(segments), coverage="current"),
        dict(name="Operational (trips, schedule)", key="trip_id, route_id, vehicle_id, start_ts", granularity="trip", freq="daily",
             records_day=int(sum(r[3] for r in route_hour if r[1] == "weekday")), coverage="1 synthetic weekday"),
    ],
    quality=dict(
        sample_validations=n_val, duplicates=n_dup, dup_pct=round(100 * n_dup / n_val, 2),
        missing_stop=n_missing, missing_pct=round(100 * n_missing / n_val, 2),
        avl_gap_pct=3.1, avl_zero_coord_pct=0.4, clock_drift_vehicles=int(n_veh * .04),
        validations_without_trip_pct=1.7,
    ),
    chaining=dict(cards=len(by_card), legs_evaluated=tot_leg, alight_exact_pct=round(100 * hit_leg / tot_leg, 1),
                  alight_zone_pct=round(100 * hit_zone / tot_leg, 1), journeys=len(journeys),
                  transfers_0=n_trans[0], transfers_1=n_trans[1], transfers_2=n_trans[2],
                  avg_transfers=round(sum(j["transfers"] for j in journeys) / max(1, len(journeys)), 3),
                  expansion=round(expansion, 1)),
    stats=dict(total_validations_weekday=int(total_val), stops=len(stops), routes=len(routes), segments=len(segments),
               vehicles=n_veh, peak_hour=max(range(24), key=lambda h: sum(rv[(r, h)] for r in routes))),
)

# ------------------------------------------------------------------- output
T = {}
T["stops"] = dict(cols=["stop_id", "name", "city", "zone", "lat", "lon", "n_routes", "is_hub"],
                  rows=[[s["stop_id"], s["name"], s["city"], s["zone"], s["lat"], s["lon"], len(sw.get(k, {})), int(s["hub"])]
                        for k, s in stops.items() if k in sw])
T["routes"] = dict(cols=["route_id", "name", "city", "kind", "vehicle_capacity", "color"],
                   rows=[[r["route_id"], r["name"], r["city"], r["kind"], r["vehicle_capacity"], r["color"]] for r in routes.values()])
T["route_stops"] = dict(cols=["route_id", "seq", "stop_id"],
                        rows=[[rid, i + 1, s] for rid, seq in route_stops.items() for i, s in enumerate(seq)])
T["segments"] = dict(cols=["seg_id", "route_id", "seq", "from_stop", "to_stop", "dist_km", "free_speed_kmh", "slow_hours"],
                     rows=[[s["seg_id"], s["route_id"], s["seq"], s["from_stop"], s["to_stop"], s["dist_km"], s["free_speed_kmh"], s["slow_hours"]] for s in segments])
T["segment_hour"] = dict(cols=["seg_id", "hour", "speed_kmh", "travel_min", "delay_idx"],
                         rows=[[s["seg_id"], h, v, round(s["dist_km"] / v * 60, 2), round(s["free_speed_kmh"] / v, 2)]
                               for s in segments for h, v in enumerate(s["speeds"])])
T["route_hour"] = dict(cols=["route_id", "day_type", "hour", "trips", "validations", "capacity_total", "load_ratio"], rows=route_hour)
T["stop_hour"] = dict(cols=["stop_id", "hour", "validations"],
                      rows=[[s, h, v] for s, vs in stop_hour.items() for h, v in enumerate(vs)])
T["od_zone"] = dict(cols=["origin_zone", "dest_zone", "trips_est"], rows=od_rows)
T["transfers"] = dict(cols=["stop_id", "transfers_est"], rows=tr_rows)
T["route_overlap"] = dict(cols=["route_a", "route_b", "shared_km", "overlap_pct"], rows=overlap)
T["route_diag"] = dict(cols=["route_id", "length_km", "displacement_km", "circuity", "backtrack_km", "backtrack_flag"], rows=diag)
meta = dict(zones={z: list(c) for z, c in ZONES.items()}, hot=HOT, cong=CONG,
            note="SYNTHETIC DATA – generated by tools/gen_data.py. Not real AYNA data.")
with open(os.path.join(ROOT, "data", "dataset.js"), "w") as f:
    f.write("window.AYNA_DATA=" + json.dumps(dict(tables=T, eda=eda, meta=meta), ensure_ascii=False, separators=(",", ":")) + ";\n")

wasm = os.path.join(ROOT, "vendor", "sql-wasm.wasm")
if os.path.exists(wasm):
    with open(os.path.join(ROOT, "vendor", "sql-wasm-b64.js"), "w") as f:
        f.write("window.SQL_WASM_B64='" + base64.b64encode(open(wasm, "rb").read()).decode() + "';\n")

print("stops", len(T["stops"]["rows"]), "segments", len(segments), "valid/day", total_val, "sample", n_val)
print("alight exact %", eda["chaining"]["alight_exact_pct"], "zone %", eda["chaining"]["alight_zone_pct"], "journeys", len(journeys), n_trans)
print("peak load ratios:", {r: max(x[6] for x in route_hour if x[0] == r and x[1] == "weekday" and x[6]) for r in routes})
print("slow segs (>=6h):", sum(1 for s in segments if s["slow_hours"] >= 6), "overlap top", overlap[:3], "backtrack", [d for d in diag if d[5]])
