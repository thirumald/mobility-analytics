# AYNA Transit Analytics — static MVP

A working, fully static demo of the AYNA public-transport analytics platform
(AI agent + five diagnostic tools + Stage 0 EDA/sizing + security controls),
built on **synthetic data**. No backend, no build step.

## Run

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

`index.html` also works when opened directly from disk (the SQL engine's WASM is embedded as base64).
The online OpenStreetMap basemap needs internet; without it the app falls back automatically to the
bundled Azerbaijan outline.

## What is in it

| Tab | Requirement IDs | What you get |
| --- | --- | --- |
| Map & Diagnostics | DT-01…DT-05, AG-03 | Azerbaijan map with 17 routes / 214 stops (Baku, Sumgait, Ganja, Nakhchivan and inter-city). Five tools driven by an hour slider: slow zones + stop-to-stop travel time, demand/capacity, demand clusters, overlap/backtracking/transfer hotspots, O/D matrix. Click any stop, route or segment → **Ask the agent**. A live simulation moves vehicles and fires validation events. |
| AI Agent | AG-01, AG-02, SC-02, SC-04 | Azerbaijani/English questions → **real SQL** executed on an in-browser SQLite (sql.js) → summary from aggregated rows only (≤ 50). Role-based table permissions and small-cell masking (k = 10). |
| Live data | — | Three **real video clips** with motion-tracked points replayed in sync with playback, per-clip counters, and a link to the matching network object (model value vs video-derived rate). Video and per-frame points are downloadable. |
| Stage 0 · EDA | DD-01…DD-04 | The seven-section EDA report template filled from the synthetic data, plus an infrastructure sizing calculator and a Markdown technical-justification export. |
| Audit & Security | SC-01…SC-04 | Simulated SSO user switch, RBAC matrix, hash-chained audit log of every question/answer with verify + tamper demo. |
| Requirements | all | Traceability table (working / simulated / open) and the open items to clarify with AYNA. |

## Honest limitations

- **All network and demand data is synthetic** (`tools/gen_data.py`, seed fixed). Hub coordinates are approximate.
- The agent uses a **rule-based parser, not an LLM**. It demonstrates the Text-to-SQL contract and guardrails; swap `interpret()` in `js/agent.js` for an LLM call. Azerbaijani accuracy criteria are an open item.
- SSO, RBAC and the audit log are **simulated in the browser**. Real immutability needs server-side WORM storage.
- O/D accuracy figures are measured against *synthetic* ground truth only.
- The videos are generic open sample footage (a highway clip and a pedestrian clip), **not from Azerbaijan**. Check their licence terms before any public release and replace them with AYNA-owned footage.
- Source requirements UI-01, AG-03, SC-02 are incomplete, so brand, map-parameter and role list are placeholders.

## Regenerate assets

```bash
python3 tools/gen_data.py                       # data/dataset.js + vendor/sql-wasm-b64.js
pip install opencv-python-headless
python3 tools/track_videos.py                   # data/tracks.js from videos/*.mp4
```

## Third-party

Leaflet 1.9.4 (BSD-2) and sql.js 1.10.3 (MIT) are vendored in `vendor/`. Azerbaijan outline from Natural Earth (public domain).
Map tiles (optional) © OpenStreetMap contributors.
