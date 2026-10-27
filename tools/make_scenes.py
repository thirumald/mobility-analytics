"""Render synthetic top-down 'camera' scenes + exact object tracks for the Vision tab.

Each scene is a small agent simulation drawn with OpenCV and piped to ffmpeg (H.264).
Because we know every object's true position, the tracks are exact and the event log
(violations, dwell, charging, crowding) is generated from the simulation itself.

    pip install opencv-python-headless numpy ; ffmpeg must be on PATH
    python3 tools/make_scenes.py       # writes videos/scene-*.mp4 and data/tracks_syn.js
"""
import json, math, os, random, subprocess, sys
import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
W, H, FPS, DUR = 768, 432, 20, 26
SAMPLE = 2  # keep every 2nd frame in the track file (10 fps)


def writer(path):
    return subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                             "-an", "-c:v", "libx264", "-crf", "29", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path], stdin=subprocess.PIPE)


def rrect(img, x, y, w, h, col, r=4):
    x, y, w, h = int(x), int(y), int(w), int(h)
    cv2.rectangle(img, (x + r, y), (x + w - r, y + h), col, -1); cv2.rectangle(img, (x, y + r), (x + w, y + h - r), col, -1)
    for cx, cy in ((x + r, y + r), (x + w - r, y + r), (x + r, y + h - r), (x + w - r, y + h - r)): cv2.circle(img, (cx, cy), r, col, -1)


def noise(img, rng):
    n = rng.integers(-5, 6, img.shape, dtype=np.int16)
    return np.clip(img.astype(np.int16) + n, 0, 255).astype(np.uint8)


class Scene:
    name = ""; title = ""
    def __init__(s, seed):
        s.rng = random.Random(seed); s.np = np.random.default_rng(seed); s.t = 0.0; s.events = []; s.objs = {}; s.nid = 0; s.stats = {}
    def ev(s, text, sev=1): s.events.append([round(s.t, 1), text, sev])
    def new(s, **k): s.nid += 1; s.objs[s.nid] = dict(id=s.nid, **k); return s.objs[s.nid]


# ------------------------------------------------------------------ 1 bus lane
class BusLane(Scene):
    name, title = "scene-buslane", "Sheikh Zayed Rd – bus-lane enforcement"
    lanes = [(110, 'bus'), (165, 'gen'), (220, 'gen'), (275, 'gen')]
    def __init__(s, seed=1):
        super().__init__(seed); s.cd = [0, 0, 0, 0]; s.bus_cd = 2.0; s.viol = 0; s.buses = 0
        s.plan = [(5.5, 2), (12.0, 1), (19.5, 3)]  # (time, lane) of planned violations
    def step(s, dt):
        s.t += dt
        for i in (1, 2, 3):
            s.cd[i] -= dt
            if s.cd[i] <= 0 and s.rng.random() < .08:
                if any(o['lane'] == i and o['x'] < 80 for o in s.objs.values()): continue
                s.new(cls='car', lane=i, x=-40, w=36, h=18, v=s.rng.uniform(120, 190), col=s.rng.choice([(200, 200, 205), (60, 60, 70), (140, 60, 50), (50, 90, 150), (180, 170, 150)]), flag=0, lane_y=s.lanes[i][0])
                s.cd[i] = s.rng.uniform(.5, 1.2)
        s.bus_cd -= dt
        if s.bus_cd <= 0:
            s.new(cls='bus', lane=0, x=-70, w=70, h=22, v=110, col=(180, 160, 30), flag=0, lane_y=s.lanes[0][0]); s.bus_cd = s.rng.uniform(4.5, 6.5); s.buses += 1
        for t0, ln in list(s.plan):
            if s.t >= t0:
                s.plan.remove((t0, ln))
                c = s.new(cls='car', lane=ln, x=-40, w=36, h=18, v=150, col=(40, 40, 200), flag=0, lane_y=s.lanes[ln][0], plan_viol=True, phase=0)
        for o in list(s.objs.values()):
            o['x'] += o['v'] * dt
            if o.get('plan_viol'):
                if o['phase'] == 0 and o['x'] > 160: o['phase'] = 1
                if o['phase'] == 1:        # drift into bus lane
                    o['lane_y'] += (s.lanes[0][0] - o['lane_y']) * min(1, dt * 3)
                    if abs(o['lane_y'] - s.lanes[0][0]) < 3 and not o['flag']:
                        o['flag'] = 1; s.viol += 1; s.ev(f"Bus-lane violation #{s.viol} · camera BL-03 · plate ••••", 2); o['t_in'] = s.t
                    if o['flag'] and s.t - o['t_in'] > 2.4: o['phase'] = 2
                if o['phase'] == 2: o['lane_y'] += (s.lanes[2][0] - o['lane_y']) * min(1, dt * 3)
            if o['x'] > W + 80: del s.objs[o['id']]
        if abs(s.t - 9.0) < dt / 2: s.ev("Bus T1-02 headway 4.8 min (target 6.0) – on schedule", 1)
        if abs(s.t - 16.0) < dt / 2: s.ev("Mean bus-lane speed 31 km/h · general lanes 24 km/h", 1)
    def draw(s):
        img = np.full((H, W, 3), (38, 34, 30), np.uint8)
        cv2.rectangle(img, (0, 90), (W, 305), (52, 48, 44), -1)
        cv2.rectangle(img, (0, 92), (W, 138), (60, 92, 38), -1)           # bus lane tint (BGR)
        cv2.putText(img, "BUS", (30, 122), cv2.FONT_HERSHEY_SIMPLEX, .6, (200, 220, 190), 2)
        cv2.putText(img, "BUS", (400, 122), cv2.FONT_HERSHEY_SIMPLEX, .6, (200, 220, 190), 2)
        for y in (138, 193, 248):
            for x in range(0, W, 40): cv2.line(img, (x, y), (x + 22, y), (200, 200, 200), 2)
        cv2.line(img, (0, 90), (W, 90), (210, 210, 210), 3); cv2.line(img, (0, 305), (W, 305), (210, 210, 210), 3)
        cv2.rectangle(img, (0, 0), (W, 88), (70, 78, 70), -1); cv2.rectangle(img, (0, 308), (W, H), (70, 78, 70), -1)
        for o in sorted(s.objs.values(), key=lambda o: o['lane_y']):
            y = o['lane_y'] - o['h'] / 2
            rrect(img, o['x'] - o['w'] / 2, y, o['w'], o['h'], o['col'], 5)
            rrect(img, o['x'] - o['w'] / 4, y + 3, o['w'] / 2, o['h'] - 6, (30, 30, 36), 3)
        return noise(img, s.np)
    def tracks(s):
        return [[o['id'], int(o['x'] - o['w'] / 2), int(o['lane_y'] - o['h'] / 2), o['w'], o['h'], o['cls'], o['flag'], 0] for o in s.objs.values()]


# ------------------------------------------------------------------ 2 bus stop
class BusStop(Scene):
    name, title = "scene-busstop", "Corniche bus stop – boarding & dwell"
    def __init__(s, seed=2):
        super().__init__(seed); s.bus = None; s.next_bus = 3.0; s.spawn = 0; s.boarded = 0; s.alerted = False; s.bn = 0
    def step(s, dt):
        s.t += dt; s.spawn -= dt
        if s.spawn <= 0:
            s.new(cls='person', x=-10, y=s.rng.uniform(345, 385), state='walk', wait_t=0, flag=0, tx=s.rng.uniform(250, 420), ty=s.rng.uniform(338, 372))
            s.spawn = s.rng.uniform(.25, .7)
        s.next_bus -= dt
        if s.next_bus <= 0 and s.bus is None:
            s.bn += 1; s.bus = dict(x=-120, state='in', t=0, id=s.nid + 1000); s.next_bus = 99
        if s.bus:
            b = s.bus
            if b['state'] == 'in':
                b['x'] += 190 * dt
                if b['x'] >= 330: b['x'] = 330; b['state'] = 'dwell'; b['t'] = 0; s.ev(f"Bus T1-0{s.bn} arrived at stop · {sum(1 for o in s.objs.values() if o['state']=='wait')} waiting", 1)
            elif b['state'] == 'dwell':
                b['t'] += dt
                if b['t'] > 5.0:
                    b['state'] = 'out'; s.ev(f"Bus T1-0{s.bn} departed · {s.boarded} boarded in total", 1)
            else:
                b['x'] += 190 * dt
                if b['x'] > W + 140: s.bus = None; s.next_bus = 7.0
        for o in list(s.objs.values()):
            if o['state'] == 'walk':
                dx, dy = o['tx'] - o['x'], o['ty'] - o['y']; d = math.hypot(dx, dy) or 1
                o['x'] += 55 * dt * dx / d; o['y'] += 55 * dt * dy / d
                if d < 4: o['state'] = 'wait'
            elif o['state'] == 'wait':
                o['wait_t'] += dt
                if o['wait_t'] > 8 and not o['flag']: o['flag'] = 1       # long wait in heat
                if s.bus and s.bus['state'] == 'dwell' and s.bus['t'] > .6: o['state'] = 'board'
            elif o['state'] == 'board':
                dx, dy = s.bus['x'] + 30 - o['x'] if s.bus else 0, 320 - o['y']; d = math.hypot(dx, dy) or 1
                o['x'] += 85 * dt * dx / d; o['y'] += 85 * dt * dy / d
                if d < 6 or not s.bus: s.boarded += 1; del s.objs[o['id']]
        q = sum(1 for o in s.objs.values() if o['state'] == 'wait')
        if q >= 14 and not s.alerted: s.alerted = True; s.ev(f"Crowding alert: {q} passengers waiting · shelter AC capacity 12", 2)
        if q < 8: s.alerted = False
    def draw(s):
        img = np.full((H, W, 3), (46, 42, 38), np.uint8)
        cv2.rectangle(img, (0, 0), (W, 230), (40, 36, 32), -1)
        for x in range(0, W, 46): cv2.line(img, (x, 120), (x + 24, 120), (190, 190, 190), 2)
        cv2.rectangle(img, (0, 232), (W, 302), (50, 46, 42), -1); cv2.line(img, (0, 232), (W, 232), (210, 210, 210), 2)  # curb lane
        cv2.rectangle(img, (0, 305), (W, H), (92, 96, 90), -1)                       # sidewalk
        for x in range(0, W, 48): cv2.line(img, (x, 305), (x, H), (84, 88, 82), 1)
        rrect(img, 250, 392, 190, 30, (150, 120, 60), 6); cv2.putText(img, "AC SHELTER", (282, 413), cv2.FONT_HERSHEY_SIMPLEX, .45, (240, 230, 200), 1)
        if s.bus:
            rrect(img, s.bus['x'] - 120 + 120, 245, 140, 50, (170, 150, 40), 8)
            for k in range(6): rrect(img, s.bus['x'] + 12 + k * 20, 252, 14, 12, (40, 40, 50), 2)
            cv2.putText(img, "T1", (int(s.bus['x'] + 60), 285), cv2.FONT_HERSHEY_SIMPLEX, .6, (255, 255, 255), 2)
        for o in s.objs.values():
            cv2.circle(img, (int(o['x']), int(o['y'])), 6, (60, 170, 230) if o['flag'] else (230, 230, 235), -1)
        return noise(img, s.np)
    def tracks(s):
        out = [[o['id'], int(o['x'] - 8), int(o['y'] - 8), 16, 16, 'person', o['flag'], 0] for o in s.objs.values()]
        if s.bus: out.append([s.bus['id'], int(s.bus['x']), 245, 140, 50, 'bus', 0, 0])
        return out


# ------------------------------------------------------------------ 3 EV depot
class Depot(Scene):
    name, title = "scene-evdepot", "Mussafah depot – EV charging bays"
    bays = [(70, 300), (225, 300), (380, 300), (535, 300)]
    def __init__(s, seed=3):
        super().__init__(seed); s.bay = [None] * 4; s.arr = 1.0; s.fault_done = False; s.k = 0; s.fault_bay = None
    def step(s, dt):
        s.t += dt; s.arr -= dt
        free = [i for i in range(4) if s.bay[i] is None and i != s.fault_bay and not any(o.get('target') == i for o in s.objs.values())]
        if s.arr <= 0 and free:
            s.k += 1; i = s.rng.choice(free)
            s.new(cls='ev_bus', x=-80, y=60, target=i, state='in', soc=s.rng.randint(14, 40), flag=0, name=f"T{s.rng.choice([1,2,4,6])}-{s.k:02d}")
            s.arr = s.rng.uniform(2.5, 4.5)
        for o in list(s.objs.values()):
            bx, by = s.bays[o['target']]
            if o['state'] == 'in':
                if o['x'] < bx + 10: o['x'] += 160 * dt
                else:
                    o['y'] += 120 * dt
                    if o['y'] >= by - 105: o['y'] = by - 105; o['state'] = 'charge'; s.bay[o['target']] = o['id']; s.ev(f"{o['name']} plugged in at bay {o['target']+1} · SOC {o['soc']}% · 150 kW", 1)
            elif o['state'] == 'charge':
                o['soc'] = min(100, o['soc'] + 6.5 * dt)
                if o['target'] == 1 and s.t > 14 and not s.fault_done:
                    s.fault_done = True; o['flag'] = 1; s.fault_bay = 1; o['state'] = 'fault'; s.ev(f"Charger MUS-C2 fault · {o['name']} SOC {int(o['soc'])}% · rerouted to bay 4", 3)
                elif o['soc'] >= 92: o['state'] = 'out'; s.bay[o['target']] = None; s.ev(f"{o['name']} released at SOC {int(o['soc'])}% · ready for service", 1)
            elif o['state'] == 'fault':
                if s.t > 17: o['state'] = 'out'; s.bay[o['target']] = None; s.ev(f"{o['name']} moved to standby – fault ticket opened", 2)
            elif o['state'] == 'out':
                o['y'] -= 130 * dt
                if o['y'] < -60: del s.objs[o['id']]
    def draw(s):
        img = np.full((H, W, 3), (44, 40, 36), np.uint8)
        cv2.rectangle(img, (0, 30), (W, 90), (56, 52, 48), -1)
        for x in range(0, W, 50): cv2.line(img, (x, 60), (x + 26, 60), (150, 150, 150), 2)
        for i, (bx, by) in enumerate(s.bays):
            rrect(img, bx - 10, by - 125, 120, 200, (58, 54, 50), 4)
            cv2.rectangle(img, (bx + 38, by + 62), (bx + 62, by + 82), (90, 200, 90) if s.bay[i] else (120, 120, 120), -1)
            if i == s.fault_bay and s.t < 17.5: cv2.rectangle(img, (bx + 38, by + 62), (bx + 62, by + 82), (50, 50, 230), -1)
            cv2.putText(img, f"C{i+1} 150kW", (bx + 6, by + 110), cv2.FONT_HERSHEY_SIMPLEX, .42, (200, 200, 200), 1)
        for o in s.objs.values():
            horizontal = o['state'] == 'in' and o['x'] < s.bays[o['target']][0] + 10
            w, h = (96, 40) if horizontal else (44, 100)
            x = o['x'] if horizontal else s.bays[o['target']][0] + 20
            rrect(img, x, o['y'] if horizontal else o['y'], w, h, (200, 190, 40) if o['flag'] == 0 else (60, 60, 210), 6)
            if not horizontal:
                cv2.rectangle(img, (int(x + 6), int(o['y'] + h + 6)), (int(x + 38), int(o['y'] + h + 14)), (70, 70, 70), -1)
                cv2.rectangle(img, (int(x + 6), int(o['y'] + h + 6)), (int(x + 6 + 32 * o['soc'] / 100), int(o['y'] + h + 14)), (90, 210, 90), -1)
        return noise(img, s.np)
    def tracks(s):
        out = []
        for o in s.objs.values():
            horizontal = o['state'] == 'in' and o['x'] < s.bays[o['target']][0] + 10
            if horizontal: out.append([o['id'], int(o['x']), int(o['y']), 96, 40, 'ev_bus', o['flag'], int(o['soc'])])
            else: out.append([o['id'], int(s.bays[o['target']][0] + 20), int(o['y']), 44, 100, 'ev_bus', o['flag'], int(o['soc'])])
        return out


# ------------------------------------------------------------------ 4 event egress
class Egress(Scene):
    name, title = "scene-egress", "Yas Island – event egress to shuttle zone"
    def __init__(s, seed=4):
        super().__init__(seed); s.spawn = 0; s.buses = []; s.next_bus = 4; s.loaded = 0; s.bn = 0; s.warn = False
    def step(s, dt):
        s.t += dt; s.spawn -= dt
        rate = 0.16 if s.t < 4 else 0.13
        while s.spawn <= 0:
            s.new(cls='person', x=-8, y=s.rng.uniform(70, 360), spd=s.rng.uniform(34, 62), flag=0, tx=640, ty=s.rng.uniform(80, 340), state='go')
            s.spawn += rate
        s.next_bus -= dt
        if s.next_bus <= 0 and len(s.buses) < 4:
            s.bn += 1; s.buses.append(dict(id=2000 + s.bn, x=700, y=-60, ty=40 + 85 * ((s.bn - 1) % 4), state='in', t=0)); s.next_bus = 4.0
            if s.bn % 3 == 0: s.ev(f"Shuttle surge: dispatching bus #{s.bn} from standby pool", 2)
        for b in list(s.buses):
            if b['state'] == 'in': b['y'] += 150 * dt; b['state'] = 'in' if b['y'] < b['ty'] else 'load'
            elif b['state'] == 'load':
                b['t'] += dt
                if b['t'] > 5.5: b['state'] = 'out'
            else:
                b['y'] -= 0  # leave sideways
                b['x'] = b.get('x', 700) + 170 * dt
                if b['x'] > W + 80: s.buses.remove(b)
        dens = {}
        for o in list(s.objs.values()):
            dx, dy = o['tx'] - o['x'], o['ty'] - o['y']; d = math.hypot(dx, dy) or 1
            near = [b for b in s.buses if b['state'] == 'load' and abs(b['ty'] + 40 - o['y']) < 110]
            if o['x'] > 540 and near:
                s.loaded += 1; del s.objs[o['id']]; continue
            sp = o['spd'] * (1 if o['x'] < 520 else .55)
            o['x'] += sp * dt * dx / d; o['y'] += sp * dt * dy / d
            c = (int(o['x'] // 96), int(o['y'] // 108)); dens[c] = dens.get(c, 0) + 1
        s.dens = dens
        mx = max(dens.values()) if dens else 0
        for o in s.objs.values(): o['flag'] = 1 if dens.get((int(o['x'] // 96), int(o['y'] // 108)), 0) >= 9 else 0
        if mx >= 9 and not s.warn: s.warn = True; s.ev(f"High crowd density at Gate 3 · {mx} per cell · open overflow lane", 2)
        if mx < 6: s.warn = False
        if abs(s.t - 20.0) < dt / 2: s.ev(f"{s.loaded} passengers loaded so far · queue clearing", 1)
    def draw(s):
        img = np.full((H, W, 3), (60, 56, 52), np.uint8)
        cv2.rectangle(img, (0, 0), (60, H), (80, 84, 120), -1); cv2.putText(img, "ARENA", (4, 215), cv2.FONT_HERSHEY_SIMPLEX, .45, (230, 230, 240), 1)
        cv2.rectangle(img, (690, 0), (W, H), (44, 40, 36), -1)
        for y in range(0, H, 108): cv2.line(img, (690, y), (W, y), (150, 150, 150), 1)
        hm = np.zeros((H, W), np.float32)
        for (cx, cy), n in s.dens.items(): cv2.circle(hm, (cx * 96 + 48, cy * 108 + 54), 60, min(1, n / 12), -1)
        hm = cv2.GaussianBlur(hm, (0, 0), 25); img = cv2.addWeighted(img, 1, cv2.applyColorMap((hm * 255).astype(np.uint8), cv2.COLORMAP_INFERNO), .22, 0)
        for b in s.buses:
            x = 700 if b['state'] != 'out' else int(b['x']); rrect(img, x, b['y'], 60, 82, (170, 150, 40), 8)
        for o in s.objs.values(): cv2.circle(img, (int(o['x']), int(o['y'])), 3, (60, 170, 230) if o['flag'] else (235, 235, 240), -1)
        return noise(img, s.np)
    def tracks(s):
        out = [[o['id'], int(o['x'] - 4), int(o['y'] - 4), 8, 8, 'person', o['flag'], 0] for o in s.objs.values()]
        out += [[b['id'], 700 if b['state'] != 'out' else int(b['x']), int(b['y']), 60, 82, 'shuttle', 0, 0] for b in s.buses]
        return out


def render(S):
    sc = S(); path = os.path.join(ROOT, "videos", sc.name + ".mp4"); p = writer(path); frames = []
    for i in range(FPS * DUR):
        sc.step(1 / FPS)
        p.stdin.write(sc.draw().tobytes())
        if i % SAMPLE == 0: frames.append([round(i / FPS, 2), sc.tracks()])
    p.stdin.close(); p.wait()
    ids = {t[0] for f in frames for t in f[1]}
    return dict(fps=FPS, w=W, h=H, title=sc.title, frames=frames, events=sc.events, unique=len(ids), synthetic=True)


if __name__ == "__main__":
    out = {}
    for S in (BusLane, BusStop, Depot, Egress):
        out[S.name] = render(S); print(S.name, len(out[S.name]["frames"]), "events", len(out[S.name]["events"]), file=sys.stderr)
    with open(os.path.join(ROOT, "data", "tracks_syn.js"), "w") as f:
        f.write("window.SAFAR_TRACKS_SYN=" + json.dumps(out, separators=(",", ":")) + ";\n")
