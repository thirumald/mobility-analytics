// Dataset invariants and audit-hash check. Run: node mobility/tests/data.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data/dataset.js'), 'utf8'), ctx);
const D = ctx.window.SAFAR_DATA, T = D.tables;
const rows = (n) => T[n].rows, col = (n, c) => T[n].cols.indexOf(c);

// 1. every table has consistent row width; no card identifiers anywhere (PII)
for (const [n, t] of Object.entries(T)) { t.rows.forEach((r) => assert.strictEqual(r.length, t.cols.length, `${n} row width`)); assert(!t.cols.some((c) => /card|passenger_id|plate|uuid/i.test(c)), `${n} must not expose identifiers`); }
// 2. referential integrity
const stops = new Set(rows('stops').map((r) => r[0])), routes = new Set(rows('routes').map((r) => r[0]));
rows('route_stops').forEach((r) => { assert(routes.has(r[0])); assert(stops.has(r[2]), 'route_stops → stops ' + r[2]); });
rows('segments').forEach((r) => { assert(routes.has(r[1])); assert(stops.has(r[3]) && stops.has(r[4])); });
rows('fleet').forEach((r) => assert(routes.has(r[1])));
rows('incidents').forEach((r) => assert(stops.has(r[5])));
// 3. load ratios and speeds are sane
rows('route_hour').forEach((r) => { if (r[6] != null) assert(r[6] > 0 && r[6] < 6, 'load_ratio ' + r[6]); });
rows('segment_hour').forEach((r) => assert(r[2] >= 5 && r[2] <= 140, 'speed ' + r[2]));
// 4. everything is inside the UAE bounding box
rows('stops').forEach((r) => { assert(r[4] > 22 && r[4] < 26.5 && r[5] > 51 && r[5] < 57, 'stop outside UAE ' + r[1]); });
// 5. O/D estimation quality on synthetic ground truth
assert(D.eda.chaining.alight_zone_pct > 85, 'zone accuracy');
// 6. audit hash chain uses SHA-256 (known vector)
const src = fs.readFileSync(path.join(root, 'js/audit.js'), 'utf8');
const c2 = { window: {}, A: { emit() {} }, localStorage: { getItem: () => null, setItem() {} }, TextEncoder, console }; c2.window = c2; vm.createContext(c2); vm.runInContext(src, c2);
assert.strictEqual(c2.A.audit.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
console.log('mobility data tests passed:', Object.keys(T).length, 'tables,', rows('stops').length, 'stops');
