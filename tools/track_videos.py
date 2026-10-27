"""Offline motion tracker for the demo footage.

Runs OpenCV background subtraction + a greedy centroid tracker at ~10 fps and
writes data/tracks.js (window.AYNA_TRACKS). The browser replays these points on
top of the <video> element in sync with currentTime, so the "real-time data
points" are derived from the real footage, not drawn at random.

    pip install opencv-python-headless
    python3 tools/track_videos.py
"""
import json, math, os, sys
import cv2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
VIDEOS = {
    "corridor-a":       {"label": "vehicle", "min_area": 220, "max_area": 60000},
    "corridor-b":       {"label": "vehicle", "min_area": 220, "max_area": 60000},
    "stop-pedestrians": {"label": "person",  "min_area": 160, "max_area": 30000},
}
STEP = 3          # analyse every 3rd frame (~10 fps)
MIN_LIFE = 6      # samples a track must live to be kept (drops noise)
MAX_DIST = 70     # px, centroid match radius
MAX_MISS = 4      # samples a track may vanish before it is closed


def track(path, cfg):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    bg = cv2.createBackgroundSubtractorMOG2(history=200, varThreshold=40, detectShadows=True)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    tracks, nxt, frames, i = {}, 1, [], 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        i += 1
        mask = bg.apply(fr)
        if (i - 1) % STEP: continue
        _, mask = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)   # drops shadows (127)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
        mask = cv2.dilate(mask, k, iterations=2)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        dets = []
        for c in cnts:
            a = cv2.contourArea(c)
            if cfg["min_area"] <= a <= cfg["max_area"]:
                x, y, bw, bh = cv2.boundingRect(c)
                dets.append((x + bw / 2, y + bh / 2, x, y, bw, bh))
        used, cur = set(), []
        for tid, t in tracks.items():
            if t["closed"]: continue
            best, bd = None, MAX_DIST
            for j, d in enumerate(dets):
                if j in used: continue
                dist = math.hypot(d[0] - t["cx"], d[1] - t["cy"])
                if dist < bd: best, bd = j, dist
            if best is None:
                t["miss"] += 1
                if t["miss"] > MAX_MISS: t["closed"] = True
                continue
            used.add(best); d = dets[best]
            t.update(cx=d[0], cy=d[1], miss=0, life=t["life"] + 1)
            cur.append((tid, d))
        for j, d in enumerate(dets):
            if j in used: continue
            tracks[nxt] = {"cx": d[0], "cy": d[1], "miss": 0, "life": 1, "closed": False}
            cur.append((nxt, d)); nxt += 1
        frames.append((round((i - 1) / fps, 2), cur))
    cap.release()
    keep = {tid for tid, t in tracks.items() if t["life"] >= MIN_LIFE}
    out = [[t, [[tid, int(d[2]), int(d[3]), int(d[4]), int(d[5])] for tid, d in cur if tid in keep]]
           for t, cur in frames]
    return {"fps": round(fps, 2), "w": w, "h": h, "label": cfg["label"], "frames": out,
            "unique": len(keep)}


def main():
    res = {}
    for name, cfg in VIDEOS.items():
        p = os.path.join(ROOT, "videos", name + ".mp4")
        res[name] = track(p, cfg)
        print(name, "frames", len(res[name]["frames"]), "tracks", res[name]["unique"], file=sys.stderr)
    with open(os.path.join(ROOT, "data", "tracks.js"), "w") as f:
        f.write("window.AYNA_TRACKS=" + json.dumps(res, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
