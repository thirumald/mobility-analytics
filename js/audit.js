/* SC-03 audit log: append-only, hash-chained, stored in localStorage.
   A static page cannot make the log truly immutable – production needs server-side WORM storage;
   this demonstrates the record format and tamper detection. */
(function () {
  const KEY = 'ayna_audit_v1';

  function sha256(str) {
    const K = new Uint32Array(64), H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    for (let i = 0, n = 2, p = 0; p < 64; n++) { let pr = true; for (let j = 2; j * j <= n; j++) if (n % j === 0) { pr = false; break; } if (pr) { K[p++] = (Math.cbrt(n) % 1) * 4294967296; } }
    const b = new TextEncoder().encode(str), l = b.length, pad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    pad.set(b); pad[l] = 0x80;
    new DataView(pad.buffer).setUint32(pad.length - 4, l * 8, false);
    new DataView(pad.buffer).setUint32(pad.length - 8, Math.floor((l * 8) / 4294967296), false);
    const w = new Uint32Array(64), rr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < pad.length; o += 64) {
      const dv = new DataView(pad.buffer, o, 64);
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(i * 4, false);
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, b2, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
      }
      [a, b2, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return mem; } };
  let mem = [];
  const save = (l) => { mem = l; try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* storage blocked: keep in memory */ } };
  const body = (e) => JSON.stringify([e.seq, e.ts, e.user_id, e.role, e.kind, e.question, e.sql, e.response, e.status, e.prev]);

  A.audit = {
    append(kind, question, sql, response, status) {
      const log = load(), prev = log.length ? log[log.length - 1].hash : '0'.repeat(64);
      const e = { seq: log.length + 1, ts: new Date().toISOString(), user_id: A.user.id, role: A.user.role, kind, question, sql: sql || '', response: response || '', status, prev };
      e.hash = sha256(body(e));
      log.push(e); save(log); A.emit('audit', e);
      return e;
    },
    all: load,
    verify() {
      const log = load();
      let prev = '0'.repeat(64);
      for (const e of log) {
        if (e.prev !== prev || sha256(body(e)) !== e.hash) return { ok: false, at: e.seq, total: log.length };
        prev = e.hash;
      }
      return { ok: true, total: log.length };
    },
    tamper() { const l = load(); if (l.length) { l[Math.floor(l.length / 2)].question += ' (edited)'; save(l); } return l.length; },
    clear() { save([]); },
    sha256,
  };
})();
