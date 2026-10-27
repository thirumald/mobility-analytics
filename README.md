# SAFAR · Mobility intelligence for Abu Dhabi

A static, build-free web app that fuses transit, fleet, event, safety, weather and population data into one operating
picture for ground transport in **Abu Dhabi and the wider UAE**, with a clean light/dark operations-console design (grouped sidebar, KPI tiles, map-first views).

All network, demand, fleet, event, weather and incident data is **synthetic**. Hub coordinates are approximate and the
routes (T1–T11, AL1, I1–I5) are fictional.

## Run

```bash
python3 -m http.server 8000      # open http://localhost:8000
```

Also works from `file://` (the SQL engine's WASM is embedded as base64). The included GitHub Pages workflow (`.github/workflows/static.yml`) publishes the repo root on every push to `main`.
The basemap uses **Geoapify** tiles (`osm-bright` light / `dark-matter` dark) and the map has a Geoapify **place search** (geocoding, UAE only). A key is required: the Pages workflow writes it into `js/config.js` from the `GEOAPIFY_KEY` repository secret, or save one in your browser (account menu → Map key). Without a key, or if tiles fail, the app shows the bundled emirate outlines.

## Pages (sidebar)

| Group | Page | What it shows |
| --- | --- | --- |
| Situational | Overview | KPI strip, alerts this hour, key findings on a map of the UAE / Abu Dhabi emirate |
| Transit diagnostics | Travel time, Utilization, Demand clusters, Route & transfers, Origin–Destination | Slow zones and stop-to-stop times; demand vs capacity; hot-stop clusters; overlap, backtracking, transfer hotspots; O/D matrix reconstructed from each card's next boarding |
| Fleet & energy | Fleet & EV, Emissions | SOC and health, depot charging load, shifting charging to solar hours; CO₂ per route and an electrification what-if |
| Operations | Event surge, Safety, What-if | F1 / concert / Ramadan / fireworks demand curves and shuttle gap; incident feed; add trips or larger vehicles and see load, cost and CO₂ |
| Resilience & equity | Heat & dust, Access & equity | Rider heat exposure at stops without AC shelters (summer / winter / dust storm); 400 m coverage and low-income gaps by zone |
| Intelligence | Copilot, Vision, Use cases | Arabic/English question → SQL → aggregated answer; seven camera feeds with synced tracked points and event logs; use-case hub with value/feasibility ranking and suggested next use cases |
| Platform | Data & Sizing, Governance, Requirements | Seven-section data discovery and an infrastructure sizing calculator; simulated SSO, RBAC, PII masking, tamper-evident audit log; requirement traceability |

Click any stop, route, segment or vehicle on the map and press **Ask Copilot** to pass it to the chat as a parameter.
The hour slider drives every layer; **Live simulation** moves vehicles and fires validation events.

## What is real and what is sample

| Part | Status |
| --- | --- |
| Copilot SQL | **Real** read-only SQL on an in-browser SQLite (sql.js); role-based table permissions; small cells (<k) masked; every exchange audited. The question → SQL step is a **rule-based parser**, not an LLM (swap `interpret()` in `js/agent.js`) |
| Audit log | Hash-chained (SHA-256) with tamper test, stored in the browser. Production needs server-side WORM storage |
| Camera scenes (4) | **Simulated** top-down scenes rendered by `tools/make_scenes.py`; tracks and events come from the simulation, so they are exact |
| Real clips (3) | Generic real footage (a highway clip and a pedestrian clip) with OpenCV motion tracks from `tools/track_videos.py`. **Not from the UAE.** Check licence terms before public release |
| O/D accuracy | Measured against synthetic ground truth only |
| Everything else | Synthetic (`tools/gen_data.py`, fixed seed) |

## Regenerate

```bash
python3 tools/gen_data.py                  # data/dataset.js + vendor/sql-wasm-b64.js
pip install opencv-python-headless numpy
python3 tools/make_scenes.py               # videos/scene-*.mp4 + data/tracks_syn.js (needs ffmpeg)
python3 tools/track_videos.py              # data/tracks.js from the three real clips
node tests/data.test.js                    # dataset and audit-hash checks
```

## Layout

```
index.html        shell (sidebar, top bar, views)        css/app.css     tokens + components
js/core.js        state, i18n (EN/AR), data access, SQL   js/map.js      map, tool registry, transit diagnostics
js/tools2.js      fleet, emissions, events, safety, what-if, heat, equity
js/agent.js       Copilot (EN/AR rule-based parser)       js/sim.js      live vehicle/validation simulation
js/vision.js      camera feeds, synced overlays           js/docs.js     data & sizing, governance, requirements
js/usecases.js    use-case hub                            js/audit.js    hash-chained audit log
js/app.js         router, theme, language, user switch    data/ videos/ vendor/ tools/ tests/
```

## Third-party

Leaflet 1.9.4 (BSD-2) and sql.js 1.10.3 (MIT) are vendored in `vendor/`. Emirate outlines from Natural Earth (public domain).
Basemap tiles and geocoding: Geoapify, © OpenStreetMap contributors.
