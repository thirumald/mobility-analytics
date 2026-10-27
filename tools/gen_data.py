"""Synthetic SAFAR dataset generator – Abu Dhabi / UAE (stdlib only, deterministic).

Produces data/dataset.js (window.SAFAR_DATA) with aggregated tables only, and
vendor/sql-wasm-b64.js (sql.js wasm as base64 so the app works from file://).

Everything is SYNTHETIC. Hub coordinates are approximate; routes, demand, fleet,
chargers, events and incidents are invented for demonstration and do not describe
any real operator. Raw card-level records exist only in memory (O/D chaining) and
are never written out.

    python3 tools/gen_data.py
"""
import base64, hashlib, json, math, os, random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
random.seed(20261027)

# ---------------------------------------------------------------- geography
HUBS = {  # name: (lat, lon, city)
    "Marina Mall": (24.4764, 54.3228, "Abu Dhabi"), "Corniche": (24.4745, 54.3396, "Abu Dhabi"),
    "Tourist Club": (24.4930, 54.3640, "Abu Dhabi"), "Al Wahda Mall": (24.4688, 54.3704, "Abu Dhabi"),
    "Central Bus Station": (24.4700, 54.3800, "Abu Dhabi"), "Zayed Port": (24.5167, 54.3690, "Abu Dhabi"),
    "Al Maryah Island": (24.5026, 54.3916, "Abu Dhabi"), "Al Reem Island": (24.4960, 54.4010, "Abu Dhabi"),
    "Louvre Abu Dhabi": (24.5336, 54.3983, "Abu Dhabi"), "Saadiyat Beach": (24.5380, 54.4340, "Abu Dhabi"),
    "ADNEC": (24.4211, 54.4025, "Abu Dhabi"), "Zayed Sports City": (24.4170, 54.4560, "Abu Dhabi"),
    "Grand Mosque": (24.4128, 54.4750, "Abu Dhabi"), "Khalifa City": (24.4220, 54.5750, "Abu Dhabi"),
    "Al Raha Beach": (24.4650, 54.5900, "Abu Dhabi"), "Yas Island": (24.4885, 54.6070, "Abu Dhabi"),
    "Yas Marina Circuit": (24.4672, 54.6031, "Abu Dhabi"), "Masdar City": (24.4270, 54.6170, "Abu Dhabi"),
    "Zayed Intl Airport": (24.4330, 54.6511, "Abu Dhabi"), "Shakhbout City": (24.3660, 54.6130, "Abu Dhabi"),
    "MBZ City": (24.3330, 54.5430, "Abu Dhabi"), "Mussafah": (24.3470, 54.4760, "Abu Dhabi"),
    "Al Shamkha": (24.3700, 54.7060, "Abu Dhabi"),
    "Al Ain Bus Station": (24.2150, 55.7500, "Al Ain"), "Al Ain Center": (24.2075, 55.7447, "Al Ain"),
    "Al Ain Airport": (24.2617, 55.6092, "Al Ain"), "Jebel Hafeet": (24.0640, 55.7790, "Al Ain"),
    "Madinat Zayed": (23.6580, 53.7060, "Madinat Zayed"), "Ruwais": (24.1100, 52.7300, "Ruwais"),
    "Liwa": (23.1300, 53.7800, "Liwa"),
    "Jebel Ali": (25.0050, 55.0600, "Dubai"), "Dubai Downtown": (25.1972, 55.2744, "Dubai"),
    "Dubai Airport DXB": (25.2528, 55.3644, "Dubai"),
}
ZONES = {  # approximate zone centroids used only to group stops (lat, lon, population, sigma_km)
    "Corniche": (24.4745, 54.3396, 62000, 1.3), "Al Khalidiyah": (24.4640, 54.3500, 54000, 1.2),
    "Tourist Club": (24.4930, 54.3640, 48000, 1.2), "Al Wahda": (24.4688, 54.3704, 66000, 1.4),
    "Al Maryah–Reem": (24.4990, 54.3960, 58000, 1.5), "Saadiyat": (24.5350, 54.4200, 26000, 2.2),
    "Grand Mosque": (24.4128, 54.4750, 21000, 2.5), "Khalifa City": (24.4220, 54.5750, 95000, 3.0),
    "Al Raha": (24.4650, 54.5900, 61000, 2.2), "Yas Island": (24.4780, 54.6070, 38000, 2.2),
    "Masdar–Airport": (24.4300, 54.6350, 23000, 2.5), "Shakhbout City": (24.3660, 54.6130, 82000, 3.0),
    "MBZ City": (24.3330, 54.5430, 110000, 3.4), "Mussafah": (24.3470, 54.4760, 168000, 3.0),
    "Al Shamkha": (24.3700, 54.7060, 70000, 3.4),
    "Al Ain": (24.2075, 55.7447, 290000, 4.0), "Madinat Zayed": (23.6580, 53.7060, 21000, 2.5),
    "Ruwais": (24.1100, 52.7300, 28000, 2.5), "Liwa": (23.1300, 53.7800, 12000, 2.0),
    "Dubai": (25.1972, 55.2744, 400000, 4.0),
}
# name: [waypoints], city, kind, vehicle capacity, daily validations (weekday), peak headway (min), EV share
ROUTES = [
    ("T1", "Marina Mall – Corniche – Al Wahda", ["Marina Mall", "Corniche", "Tourist Club", "Al Wahda Mall"], "Abu Dhabi", "city", 80, 21000, 6, .7),
    ("T2", "Central Station – Al Maryah – Saadiyat", ["Central Bus Station", "Al Maryah Island", "Al Reem Island", "Louvre Abu Dhabi"], "Abu Dhabi", "city", 110, 24000, 7, .6),
    ("T3", "Central Station – Khalifa City – Airport", ["Central Bus Station", "Khalifa City", "Zayed Intl Airport"], "Abu Dhabi", "city", 80, 15500, 12, .3),
    ("T4", "Central Station – Al Raha – Yas", ["Central Bus Station", "Al Raha Beach", "Yas Island"], "Abu Dhabi", "city", 110, 17000, 11, .5),
    ("T5", "Mussafah – MBZ City – Central Station", ["Mussafah", "MBZ City", "Central Bus Station"], "Abu Dhabi", "city", 80, 17500, 13, .1),
    ("T6", "Yas – Masdar – Airport", ["Yas Island", "Masdar City", "Zayed Intl Airport"], "Abu Dhabi", "city", 80, 8500, 12, .8),
    ("T7", "Grand Mosque – Al Wahda – Corniche", ["Grand Mosque", "Al Wahda Mall", "Corniche"], "Abu Dhabi", "city", 80, 9800, 10, .4),
    ("T8", "Corniche – Yas (via Al Maryah)", ["Corniche", "Yas Island", "Al Maryah Island", "Central Bus Station"], "Abu Dhabi", "city", 80, 5200, 16, .2),
    ("T9", "Central Station – Al Reem (express)", ["Central Bus Station", "Al Maryah Island", "Al Reem Island"], "Abu Dhabi", "city", 80, 6500, 8, .6),
    ("T10", "Shakhbout – MBZ City – Mussafah", ["Shakhbout City", "MBZ City", "Mussafah"], "Abu Dhabi", "city", 80, 11000, 15, .1),
    ("T11", "Al Shamkha – Yas – Airport", ["Al Shamkha", "Yas Marina Circuit", "Zayed Intl Airport"], "Abu Dhabi", "city", 80, 6000, 18, .3),
    ("AL1", "Al Ain Airport – Center – Jebel Hafeet", ["Al Ain Airport", "Al Ain Center", "Jebel Hafeet"], "Al Ain", "city", 60, 5200, 20, .0),
    ("I1", "Abu Dhabi – Dubai Downtown", ["Central Bus Station", "Jebel Ali", "Dubai Downtown"], "Intercity", "intercity", 50, 7500, 20, .0),
    ("I2", "Abu Dhabi – Al Ain", ["Central Bus Station", "Shakhbout City", "Al Ain Bus Station"], "Intercity", "intercity", 50, 5200, 30, .0),
    ("I3", "Abu Dhabi – Madinat Zayed – Ruwais", ["Central Bus Station", "Madinat Zayed", "Ruwais"], "Intercity", "intercity", 50, 1700, 60, .0),
    ("I4", "Airport – Dubai DXB", ["Zayed Intl Airport", "Dubai Airport DXB"], "Intercity", "intercity", 50, 3800, 35, .0),
    ("I5", "Madinat Zayed – Liwa", ["Madinat Zayed", "Liwa"], "Intercity", "intercity", 50, 700, 90, .0),
]
COLORS = ["#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#a78bfa", "#fb923c", "#60a5fa", "#f87171", "#2dd4bf", "#c084fc",
          "#facc15", "#4ade80", "#38bdf8", "#e879f9", "#fda4af", "#86efac", "#fcd34d"]
HOT = [(24.4745, 54.3500, 2.8, 0.60), (24.5026, 54.3916, 2.0, 0.50), (24.4220, 54.5750, 2.6, 0.45),
       (24.3470, 54.4760, 2.8, 0.52), (24.4885, 54.6070, 2.4, 0.40), (24.4330, 54.6511, 2.0, 0.30),
       (25.1972, 55.2744, 3.5, 0.55), (25.0050, 55.0600, 3.0, 0.42), (24.2075, 55.7447, 2.5, 0.35), (24.4128, 54.4750, 2.0, 0.38)]
CONG = [.05, .04, .03, .03, .05, .12, .4, .85, 1.0, .75, .5, .45, .55, .6, .5, .6, .85, 1.0, .9, .65, .4, .25, .15, .08]
WD = [.003, .002, .001, .001, .004, .02, .055, .095, .09, .06, .045, .04, .05, .052, .045, .055, .07, .095, .085, .055, .04, .03, .017, .008]
WE = [.007, .005, .003, .002, .003, .008, .02, .035, .05, .065, .075, .08, .085, .085, .08, .075, .07, .065, .06, .05, .04, .03, .02, .012]
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
stops, hub_id, leg_cache, sid = {}, {}, {}, [0]


def new_stop(name, lat, lon, city, hub=False):
    sid[0] += 1
    s = "S%03d" % sid[0]
    z, zd = min(((z, hav((lat, lon), (c[0], c[1]))) for z, c in ZONES.items()), key=lambda t: t[1])
    stops[s] = dict(stop_id=s, name=name, city=city, zone=z if zd < 18 else "Rural " + city, lat=round(lat, 5), lon=round(lon, 5),
                    hub=hub, ac=1 if random.random() < (.9 if hub else .28) else 0)
    return s


for n, (la, lo, c) in HUBS.items():
    hub_id[n] = new_stop(n, la, lo, c, True)


def leg_stops(a, b, kind):
    key = (a, b) if a < b else (b, a)
    if key not in leg_cache:
        A, B = HUBS[key[0]], HUBS[key[1]]
        d = hav(A[:2], B[:2])
        n = max(1, round(d / (0.8 if kind == "city" else 22)))
        amp = (0.06 if kind == "city" else 0.03) * d * (1 if int(hashlib.md5(str(key).encode()).hexdigest(), 16) % 2 else -1)
        dx, dy = B[1] - A[1], B[0] - A[0]
        L = math.hypot(dx, dy) or 1
        ids = [hub_id[key[0]]]
        for k in range(1, n):
            t = k / n
            off = amp * math.sin(math.pi * t) / 111.0
            ids.append(new_stop("%s–%s %d" % (key[0], key[1], k), A[0] + dy * t + (dx / L) * off, A[1] + dx * t - (dy / L) * off, B[2] if t > .5 else A[2]))
        ids.append(hub_id[key[1]])
        leg_cache[key] = ids
    ids = leg_cache[key]
    return ids if a < b else ids[::-1]


routes, route_stops = {}, {}
for i, (rid, name, wps, city, kind, cap, daily, head, ev) in enumerate(ROUTES):
    seq = []
    for a, b in zip(wps, wps[1:]):
        part = leg_stops(a, b, kind)
        seq += part if not seq else part[1:]
    route_stops[rid] = seq
    routes[rid] = dict(route_id=rid, name=name, city=city, kind=kind, vehicle_capacity=cap, color=COLORS[i % len(COLORS)], daily=daily, head=head, ev=ev)
pos = lambda s: (stops[s]["lat"], stops[s]["lon"])

# ---------------------------------------------------------------- segments
segments, seg_by = [], {}
for rid, seq in route_stops.items():
    kind = routes[rid]["kind"]
    free = 36 if kind == "city" else 88
    for k, (a, b) in enumerate(zip(seq, seq[1:])):
        d = round(hav(pos(a), pos(b)) * 1.18, 3)
        mid = ((pos(a)[0] + pos(b)[0]) / 2, (pos(a)[1] + pos(b)[1]) / 2)
        sev = max(max(0, 1 - hav(mid, (h[0], h[1])) / h[2]) * h[3] for h in HOT)
        fs = round(free * random.uniform(.93, 1.06), 1)
        sp = [round(max(6.0, fs * (1 - sev * CONG[h]) * random.uniform(.95, 1.05)), 1) for h in range(24)]
        sg = dict(seg_id="%s-%02d" % (rid, k + 1), route_id=rid, seq=k + 1, from_stop=a, to_stop=b, dist_km=d, free_speed_kmh=fs, speeds=sp)
        sg["slow_hours"] = sum(1 for v in sp if v < 0.75 * fs)
        segments.append(sg); seg_by[(rid, a, b)] = sg


def travel_min(rid, a, b, hour):
    seq = route_stops[rid]; i, j = seq.index(a), seq.index(b); t = 0
    for k in range(min(i, j), max(i, j)):
        sg = seg_by[(rid, seq[k], seq[k + 1])]
        t += sg["dist_km"] / sg["speeds"][int(hour) % 24] * 60 + 0.4
    return t


# --------------------------------------------------------- route_hour model
TARGET = {"T1": 1.15, "T2": .95, "T3": .8, "T4": 1.2, "T5": 1.25, "T6": .7, "T7": .85, "T8": .6, "T9": .55, "T10": 1.0, "T11": .65,
          "AL1": .75, "I1": 1.1, "I2": .9, "I3": .7, "I4": 1.05, "I5": .5}


def build_route_hour():
    rh, rvv = [], {}
    for rid, r in routes.items():
        for dt, prof, scale in (("weekday", WD, 1.0), ("weekend", WE, 0.6)):
            mx = max(prof)
            for h in range(24):
                v = int(r["daily"] * scale * prof[h] * random.uniform(.93, 1.07))
                head = r["head"] * (1 + 2.0 * (1 - prof[h] / mx))
                if r["kind"] == "city" and h < 5: trips = 0
                elif r["kind"] == "intercity" and (h < 5 or h > 23): trips = 0
                else: trips = max(2, int(2 * 60 / head))
                cap = trips * r["vehicle_capacity"]
                rh.append([rid, dt, h, trips, v, cap, round(v * 0.9 / cap, 3) if cap else None])
                if dt == "weekday": rvv[(rid, h)] = v
    return rh, rvv


route_hour, rv = build_route_hour()
for rid, r in routes.items():   # calibrate demand so peak demand/capacity lands near the scenario target
    pk = max(x[6] for x in route_hour if x[0] == rid and x[1] == "weekday" and x[6])
    r["daily"] = int(r["daily"] * TARGET[rid] / pk)
route_hour, rv = build_route_hour()
peak_lr = {rid: max(x[6] for x in route_hour if x[0] == rid and x[1] == "weekday" and x[6]) for rid in routes}

sw = {}
for rid, seq in route_stops.items():
    w = [4.0 if stops[s]["hub"] else random.lognormvariate(0, .55) for s in seq]
    tot = sum(w)
    for s, x in zip(seq, w): sw.setdefault(s, {})[rid] = x / tot
stop_hour = {s: [int(sum(rv[(rid, h)] * f for rid, f in d.items())) for h in range(24)] for s, d in sw.items()}
total_val = sum(rv.values())

# ----------------------------------------------- card sample (O/D chaining)
dirs = {}
def directed(rid, d): return route_stops[rid] if d == 0 else route_stops[rid][::-1]
for rid in routes:
    for d in (0, 1):
        for p, s in enumerate(directed(rid, d)): dirs.setdefault(s, []).append((rid, d, p))
starts = [s for s in stops if s in dirs]
sweights = [sum(rv[(rid, 8)] * f for rid, f in sw[s].items()) + .5 for s in starts]
records = []


def pick_leg(s, avoid=None):
    opts = [o for o in dirs[s] if o[2] < len(directed(o[0], o[1])) - 1 and o[0] != avoid]
    if not opts: return None
    rid, d, p = random.choice(opts)
    L = len(directed(rid, d))
    q = min(L - 1, p + 1 + int(random.expovariate(1 / (7 if routes[rid]["kind"] == "city" else 1.5))))
    return (rid, d, p, q)


for c in range(7000):
    A = random.choices(starts, sweights)[0]
    l1 = pick_leg(A)
    if not l1: continue
    legs = [l1]
    T = directed(l1[0], l1[1])[l1[3]]
    if random.random() < .3:
        l2 = pick_leg(T, avoid=l1[0])
        if l2: legs.append(l2)
    card = hashlib.sha256(("card%d" % c).encode()).hexdigest()[:16]
    seqs = [legs, [(r, 1 - d, len(directed(r, d)) - 1 - q, len(directed(r, d)) - 1 - p) for (r, d, p, q) in legs[::-1]]]
    starts_t = [random.gauss(7.6, 1.0) * 60, random.gauss(17.6, 1.2) * 60]
    if random.random() < .12: seqs, starts_t = seqs[:1], starts_t[:1]
    for si, (lg, t0) in enumerate(zip(seqs, starts_t)):
        t = max(5.5 * 60, min(t0, 22.5 * 60))
        for li, (rid, d, p, q) in enumerate(lg):
            if si == 1 and li == 0 and random.random() < .25:
                p2 = max(0, min(len(directed(rid, d)) - 2, p + random.choice([-1, 1])))
                p = p2 if p2 < q else p
            ds = directed(rid, d)
            records.append(dict(card=card, t=t, stop=ds[p], route=rid, dir=d, alight=ds[q]))
            t += travel_min(rid, ds[p], ds[q], t / 60) + random.uniform(4, 12)

raw = []
for r in records:
    raw.append(dict(r))
    if random.random() < .015: raw.append(dict(r, t=r["t"] + random.uniform(.2, .6), dup=True))
n_dup = sum(1 for r in raw if r.get("dup"))
for r in raw:
    if random.random() < .008: r["stop"] = None
n_missing = sum(1 for r in raw if r["stop"] is None)

by_card = {}
for r in raw:
    if not r.get("dup"): by_card.setdefault(r["card"], []).append(r)
hit_leg = tot_leg = hit_zone = 0
journeys = []
for card, rs in by_card.items():
    rs.sort(key=lambda r: r["t"])
    for i, r in enumerate(rs):
        nxt = rs[i + 1] if i + 1 < len(rs) else rs[0]
        r["est"] = None
        if r["stop"] is None or nxt["stop"] is None: continue
        ds = directed(r["route"], r["dir"]); cand = ds[ds.index(r["stop"]) + 1:]
        if not cand: continue
        best = min(cand, key=lambda s: hav(pos(s), pos(nxt["stop"])))
        if hav(pos(best), pos(nxt["stop"])) <= 0.6: r["est"] = best
        tot_leg += 1
        if r["est"] == r["alight"]: hit_leg += 1
        if r["est"] and stops[r["est"]]["zone"] == stops[r["alight"]]["zone"]: hit_zone += 1
    cur = None
    for r in rs:
        if not r["est"]: cur = None; continue
        if cur and r["route"] != cur["last_route"] and r["t"] - cur["t_end"] <= 45 and hav(pos(r["stop"]), pos(cur["dest"])) <= 0.5:
            cur["transfers"] += 1; cur["tstops"].append(r["stop"]); cur["dest"] = r["est"]; cur["last_route"] = r["route"]; cur["t_end"] = r["t"]
        else:
            if cur: journeys.append(cur)
            cur = dict(orig=r["stop"], dest=r["est"], transfers=0, tstops=[], last_route=r["route"], t_end=r["t"])
    if cur: journeys.append(cur)
expansion = total_val / max(1, len(records))
od, tr = {}, {}
for j in journeys:
    k = (stops[j["orig"]]["zone"], stops[j["dest"]]["zone"]); od[k] = od.get(k, 0) + 1
    for s in j["tstops"]: tr[s] = tr.get(s, 0) + 1
od_rows = [[a, b, int(n * expansion)] for (a, b), n in sorted(od.items(), key=lambda kv: -kv[1])]
tr_rows = [[s, int(n * expansion)] for s, n in sorted(tr.items(), key=lambda kv: -kv[1])]
n_trans = [sum(1 for j in journeys if j["transfers"] == k) for k in (0, 1, 2)]

# ------------------------------------------------- route overlap/backtracking
pairs = lambda rid: {frozenset(p) for p in zip(route_stops[rid], route_stops[rid][1:])}
overlap = []
rids = list(routes)
for i, a in enumerate(rids):
    for b in rids[i + 1:]:
        sh = pairs(a) & pairs(b)
        if not sh: continue
        km = sum(hav(pos(list(p)[0]), pos(list(p)[1])) * 1.18 for p in sh)
        la = sum(s["dist_km"] for s in segments if s["route_id"] == a); lb = sum(s["dist_km"] for s in segments if s["route_id"] == b)
        overlap.append([a, b, round(km, 2), round(100 * km / min(la, lb), 1)])
overlap.sort(key=lambda r: -r[3])
diag, rlen = [], {}
for rid, seq in route_stops.items():
    L = sum(s["dist_km"] for s in segments if s["route_id"] == rid); rlen[rid] = L
    disp = hav(pos(seq[0]), pos(seq[-1])); main = bearing(pos(seq[0]), pos(seq[-1])); back = 0
    for sg in (s for s in segments if s["route_id"] == rid):
        if abs((bearing(pos(sg["from_stop"]), pos(sg["to_stop"])) - main + 180) % 360 - 180) > 100: back += sg["dist_km"]
    diag.append([rid, round(L, 1), round(disp, 1), round(L / max(disp, .1), 2), round(back, 1), 1 if back / L > .22 else 0])

# ======================= NEW SOLUTION MODULES =============================
# ---- fleet & EV charging
fleet = []
for rid, r in routes.items():
    n = max(3, min(16, int(max(rv[(rid, h)] for h in range(24)) / (r["vehicle_capacity"] * 5.5)) + 2))
    for k in range(n):
        ev = random.random() < r["ev"]
        typ = "electric" if ev else ("cng" if r["city"] == "Al Ain" else "diesel")
        status = random.choices(["in_service", "charging", "depot", "maintenance"], [78, 10 if ev else 3, 8, 4])[0]
        health = int(max(35, min(99, random.gauss(86, 10))))
        fleet.append(["%s-%02d" % (rid, k + 1), rid, typ, r["vehicle_capacity"], random.randint(14, 98) if ev else None, health,
                      random.randint(80, 360), round(random.uniform(.5, 9), 1), status])
DEPOTS = [("Mussafah Depot", 24.3420, 54.4700, 8, 150), ("Khalifa City Depot", 24.4180, 54.5600, 6, 150),
          ("Yas Depot", 24.4780, 54.6250, 6, 150), ("Saadiyat Terminal", 24.5300, 54.4200, 2, 300), ("Al Ain Depot", 24.2300, 55.7300, 2, 100)]
chargers, charger_hour = [], []
CH = [.9, .92, .93, .9, .85, .6, .35, .22, .18, .2, .28, .35, .4, .38, .3, .28, .25, .3, .38, .5, .62, .72, .8, .86]
for dname, la, lo, n, kw in DEPOTS:
    for k in range(n):
        cid = "%s-C%d" % (dname.split()[0][:3].upper(), k + 1)
        chargers.append([cid, dname, la, lo, kw])
        scale = 1.0 if dname != "Saadiyat Terminal" else 0
        for h in range(24):
            if dname == "Saadiyat Terminal": u = max(5, min(95, 20 + 70 * CONG[h])) * random.uniform(.8, 1.1)   # opportunity charging follows the service
            else: u = CH[h] * 100 * random.uniform(.8, 1.1)
            u = max(0, min(100, u))
            charger_hour.append([cid, h, round(u, 1), round(kw * u / 100, 1)])

# ---- events (surge planning)
EVENTS = [
    ("EV1", "Abu Dhabi Grand Prix (race day)", "Yas Marina Circuit", "2026-12-06", 60000, 14, 23, .25),
    ("EV2", "Concert – Etihad Arena", "Yas Island", "2026-11-13", 18000, 20, 23, .3),
    ("EV3", "Abu Dhabi Book Fair", "ADNEC", "2027-04-27", 30000, 10, 21, .2),
    ("EV4", "Taraweeh peak night (Ramadan)", "Grand Mosque", "2027-02-20", 55000, 20, 23, .18),
    ("EV5", "National Day fireworks", "Corniche", "2026-12-02", 80000, 19, 22, .3),
    ("EV6", "Louvre Abu Dhabi – late opening", "Louvre Abu Dhabi", "2026-11-20", 6000, 17, 22, .22),
]
event_demand = []
for eid, name, hub, date, att, st, en, share in EVENTS:
    hs = hub_id[hub]
    serve = [r for r in routes if hs in route_stops[r]] or [r for r in routes if any(hav(pos(hs), pos(s)) < 1.5 for s in route_stops[r])]
    for h in range(24):
        w = 0.0
        if st - 4 <= h < st: w += .6 * (1 - (st - h - 1) / 4 * .6) / 2.2      # ingress ramp
        if en <= h <= en + 2: w += .9 * (.55 if h == en else .3 if h == en + 1 else .15) / 1.0   # egress spike
        extra = int(att * share * w * (1 if w else 0))
        spare = sum(max(0, 1 - (next(x[6] for x in route_hour if x[0] == r and x[1] == "weekday" and x[2] == h) or 0)) * next(x[3] for x in route_hour if x[0] == r and x[1] == "weekday" and x[2] == h) for r in serve)
        need = math.ceil(extra / (80 * 0.85)) if extra else 0
        event_demand.append([eid, h, extra, need, round(spare, 1), max(0, int(need - spare)), ",".join(serve)])
events_rows = [[e[0], e[1], e[2], hub_id[e[2]], e[3], e[4], e[5], e[6], e[7]] for e in EVENTS]

# ---- weather (heat / dust resilience)
def hi(t, rh):
    return round(t + 0.33 * (rh / 100 * 6.105 * math.exp(17.27 * t / (237.7 + t))) - 4.0, 1)
weather = []
for scen, temps, hums, vis in (
    ("summer", [33, 33, 32, 32, 32, 33, 34, 36, 38, 40, 42, 43, 44, 45, 45, 44, 43, 41, 39, 37, 36, 35, 34, 34], [70, 72, 74, 75, 75, 72, 68, 60, 52, 46, 42, 38, 36, 34, 34, 36, 40, 46, 52, 58, 62, 65, 67, 69], 10),
    ("winter", [17, 16, 16, 15, 15, 15, 16, 18, 21, 23, 25, 26, 27, 27, 27, 26, 24, 22, 20, 19, 18, 18, 17, 17], [78, 80, 82, 84, 85, 85, 82, 74, 64, 56, 50, 46, 44, 44, 46, 50, 56, 62, 68, 72, 74, 76, 77, 78], 8),
    ("dust_storm", [34, 34, 33, 33, 33, 34, 35, 37, 39, 41, 42, 43, 43, 42, 41, 40, 39, 38, 37, 36, 35, 35, 34, 34], [55] * 24, 1.5)):
    for h in range(24):
        weather.append([scen, h, temps[h], hums[h], hi(temps[h], hums[h]), vis if scen != "dust_storm" else (1.2 if 9 <= h <= 18 else 3.0)])

# ---- accessibility / equity: share of residents within 400 m of a stop (Monte-Carlo, 500 pts / zone)
zone_pop = []
all_stops = [pos(s) for s in sw]
for z, (la, lo, pop, sg) in [kv for kv in ZONES.items() if kv[0] not in ('Dubai', 'Madinat Zayed', 'Ruwais', 'Liwa')]:
    sg *= 0.5
    cov = 0; walk = []
    for _ in range(500):
        p = (la + random.gauss(0, sg / 111), lo + random.gauss(0, sg / 100))
        d = min(hav(p, q) for q in all_stops)
        walk.append(d * 1000)
        if d <= .4: cov += 1
    low = round(random.uniform(8, 48) if z in ("Mussafah", "MBZ City", "Al Shamkha", "Shakhbout City") else random.uniform(3, 22), 1)
    zone_pop.append([z, pop, round(100 * cov / 500, 1), int(sum(walk) / len(walk)), low, round(random.uniform(2, 9), 1), int(pop * random.uniform(.3, .6))])

# ---- incidents
INC = [("harsh_braking", "telematics", 1), ("bus_lane_violation", "vision", 1), ("stopped_vehicle", "vision", 2), ("near_miss", "vision", 3),
       ("overcrowding", "afc", 2), ("door_fault", "telematics", 2), ("breakdown", "telematics", 3), ("charger_fault", "depot", 2),
       ("heat_alert", "iot", 2), ("passenger_assist", "driver_app", 1)]
incidents = []
for i in range(140):
    t, src, sev = random.choice(INC)
    h = random.choices(range(24), [max(.02, c) for c in CONG])[0] if t != "charger_fault" else random.choice([0, 1, 2, 3, 4, 22, 23])
    rid = random.choice(list(routes)); s = random.choice(route_stops[rid])
    incidents.append(["INC%03d" % (i + 1), h, t, min(3, sev + (1 if random.random() < .15 else 0)), rid, s, src, random.choices(["open", "acknowledged", "resolved"], [18, 22, 60])[0]])

# ---- emissions & cost
EF = dict(diesel=1.05, cng=0.85, electric=0.45)   # kg CO2 per km (electric = grid mix incl. generation)
emis = []
for rid in routes:
    km = sum(x[3] for x in route_hour if x[0] == rid and x[1] == "weekday") * rlen[rid]
    veh = [f for f in fleet if f[1] == rid]
    evs = sum(1 for f in veh if f[2] == "electric") / len(veh)
    other = EF["cng"] if routes[rid]["city"] == "Al Ain" else EF["diesel"]
    co2 = km * (evs * EF["electric"] + (1 - evs) * other) / 1000
    base = km * other / 1000
    emis.append([rid, round(km), round(evs, 2), round(co2, 2), round(base, 2), round(base - co2, 2)])

# --------------------------------------------------------------------- EDA
n_val = len(raw); n_veh = len(fleet)
eda = dict(
    generated="synthetic · seed 20261027",
    sources=[
        dict(name="AFC validations", key="card_id(hash), ts, stop_id, route_id, terminal_id", granularity="event", freq="near-real-time", records_day=int(total_val), coverage="1 synthetic weekday"),
        dict(name="AVL / telematics pings", key="vehicle_id, ts, lat, lon, speed, soc", granularity="30 s", freq="30 s", records_day=int(n_veh * 17 * 3600 / 30), coverage="1 synthetic weekday"),
        dict(name="Registry (routes, stops)", key="route_id, stop_id, seq, geometry", granularity="static", freq="on change", records_day=len(stops) + len(segments), coverage="current"),
        dict(name="Operational (trips, schedule)", key="trip_id, route_id, vehicle_id, start_ts", granularity="trip", freq="daily", records_day=int(sum(r[3] for r in route_hour if r[1] == "weekday")), coverage="1 synthetic weekday"),
        dict(name="Depot / charger telemetry", key="charger_id, ts, kw, soc", granularity="1 min", freq="1 min", records_day=len(chargers) * 1440, coverage="1 synthetic weekday"),
        dict(name="Camera / vision events", key="camera_id, ts, class, track_id, zone", granularity="event", freq="real-time", records_day=48000, coverage="pilot cameras"),
    ],
    quality=dict(sample_validations=n_val, duplicates=n_dup, dup_pct=round(100 * n_dup / n_val, 2), missing_stop=n_missing, missing_pct=round(100 * n_missing / n_val, 2),
                 avl_gap_pct=3.1, avl_zero_coord_pct=0.4, clock_drift_vehicles=int(n_veh * .04), validations_without_trip_pct=1.7),
    chaining=dict(cards=len(by_card), legs_evaluated=tot_leg, alight_exact_pct=round(100 * hit_leg / tot_leg, 1), alight_zone_pct=round(100 * hit_zone / tot_leg, 1),
                  journeys=len(journeys), transfers_0=n_trans[0], transfers_1=n_trans[1], transfers_2=n_trans[2],
                  avg_transfers=round(sum(j["transfers"] for j in journeys) / max(1, len(journeys)), 3), expansion=round(expansion, 1)),
    stats=dict(total_validations_weekday=int(total_val), stops=len([s for s in stops if s in sw]), routes=len(routes), segments=len(segments), vehicles=n_veh,
               peak_hour=max(range(24), key=lambda h: sum(rv[(r, h)] for r in routes))),
)

# ------------------------------------------------------------------- output
T = {}
T["stops"] = dict(cols=["stop_id", "name", "city", "zone", "lat", "lon", "n_routes", "is_hub", "shelter_ac"],
                  rows=[[s["stop_id"], s["name"], s["city"], s["zone"], s["lat"], s["lon"], len(sw.get(k, {})), int(s["hub"]), s["ac"]] for k, s in stops.items() if k in sw])
T["routes"] = dict(cols=["route_id", "name", "city", "kind", "vehicle_capacity", "color"], rows=[[r["route_id"], r["name"], r["city"], r["kind"], r["vehicle_capacity"], r["color"]] for r in routes.values()])
T["route_stops"] = dict(cols=["route_id", "seq", "stop_id"], rows=[[rid, i + 1, s] for rid, seq in route_stops.items() for i, s in enumerate(seq)])
T["segments"] = dict(cols=["seg_id", "route_id", "seq", "from_stop", "to_stop", "dist_km", "free_speed_kmh", "slow_hours"],
                     rows=[[s["seg_id"], s["route_id"], s["seq"], s["from_stop"], s["to_stop"], s["dist_km"], s["free_speed_kmh"], s["slow_hours"]] for s in segments])
T["segment_hour"] = dict(cols=["seg_id", "hour", "speed_kmh", "travel_min", "delay_idx"],
                         rows=[[s["seg_id"], h, v, round(s["dist_km"] / v * 60, 2), round(s["free_speed_kmh"] / v, 2)] for s in segments for h, v in enumerate(s["speeds"])])
T["route_hour"] = dict(cols=["route_id", "day_type", "hour", "trips", "validations", "capacity_total", "load_ratio"], rows=route_hour)
T["stop_hour"] = dict(cols=["stop_id", "hour", "validations"], rows=[[s, h, v] for s, vs in stop_hour.items() for h, v in enumerate(vs)])
T["od_zone"] = dict(cols=["origin_zone", "dest_zone", "trips_est"], rows=od_rows)
T["transfers"] = dict(cols=["stop_id", "transfers_est"], rows=tr_rows)
T["route_overlap"] = dict(cols=["route_a", "route_b", "shared_km", "overlap_pct"], rows=overlap)
T["route_diag"] = dict(cols=["route_id", "length_km", "displacement_km", "circuity", "backtrack_km", "backtrack_flag"], rows=diag)
T["fleet"] = dict(cols=["vehicle_id", "route_id", "fuel_type", "capacity", "soc_pct", "health_score", "km_today", "age_years", "status"], rows=fleet)
T["chargers"] = dict(cols=["charger_id", "depot", "lat", "lon", "kw"], rows=chargers)
T["charger_hour"] = dict(cols=["charger_id", "hour", "utilization_pct", "kwh"], rows=charger_hour)
T["events"] = dict(cols=["event_id", "name", "venue", "venue_stop", "event_date", "attendance", "start_hour", "end_hour", "transit_share"], rows=events_rows)
T["event_demand"] = dict(cols=["event_id", "hour", "extra_validations", "trips_needed", "spare_trips", "gap_trips", "routes"], rows=event_demand)
T["weather_hour"] = dict(cols=["scenario", "hour", "temp_c", "humidity_pct", "heat_index_c", "visibility_km"], rows=weather)
T["zone_pop"] = dict(cols=["zone", "population", "coverage_400m_pct", "avg_walk_m", "low_income_pct", "senior_pct", "jobs"], rows=zone_pop)
T["incidents"] = dict(cols=["incident_id", "hour", "type", "severity", "route_id", "stop_id", "source", "status"], rows=incidents)
T["route_emissions"] = dict(cols=["route_id", "km_day", "ev_share", "co2_t_day", "co2_baseline_t_day", "co2_saved_t_day"], rows=emis)
meta = dict(zones={z: [c[0], c[1]] for z, c in ZONES.items()}, hot=HOT, cong=CONG, ef=EF,
            note="SYNTHETIC DATA – generated by tools/gen_data.py. Not real operator data.")
with open(os.path.join(ROOT, "data", "dataset.js"), "w") as f:
    f.write("window.SAFAR_DATA=" + json.dumps(dict(tables=T, eda=eda, meta=meta), ensure_ascii=False, separators=(",", ":")) + ";\n")
wasm = os.path.join(ROOT, "vendor", "sql-wasm.wasm")
if os.path.exists(wasm):
    with open(os.path.join(ROOT, "vendor", "sql-wasm-b64.js"), "w") as f:
        f.write("window.SQL_WASM_B64='" + base64.b64encode(open(wasm, "rb").read()).decode() + "';\n")

print("stops", len(T["stops"]["rows"]), "segments", len(segments), "valid/day", total_val, "vehicles", n_veh)
print("alight exact %", eda["chaining"]["alight_exact_pct"], "zone %", eda["chaining"]["alight_zone_pct"], "journeys", len(journeys))
print("peak load:", {r: round(v, 2) for r, v in peak_lr.items()})
print("slow segs (>=6h):", sum(1 for s in segments if s["slow_hours"] >= 6), "backtrack", [d[0] for d in diag if d[5]], "overlap", overlap[:2])
print("coverage:", [(z[0], z[2]) for z in zone_pop])
print("event gaps:", {e[0]: max(x[5] for x in event_demand if x[0] == e[0]) for e in EVENTS})
print("ev count", sum(1 for f in fleet if f[2] == "electric"), "co2 saved", round(sum(e[5] for e in emis), 1))
