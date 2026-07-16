/* SandScape invariant self-tests — the physics contract.
   Pure ESM, no DOM: imported by the in-app "Run self-tests" button AND by
   tests/run-tests.mjs in Node/CI. Each test builds its own seeded engine, so
   the suite never touches the live simulation.

   Invariants: mass conservation, wall integrity, no escape, stratification,
   flip integrity, viscous cling, disturb-storm, determinism, palette validity,
   square-frame integrity, renderer coverage. */

import { SandEngine, WALL, NTYPES } from './engine.js';
import { SandRenderer, pack } from './render.js';
import { GROUPS, DIRECT, TEAMS, resolvePalette, paletteName, hexToRgb } from './palettes.js';

export function runSelfTests(size = 256) {
  const results = [];
  const T = (name, fn) => {
    let ok = false, note = '';
    try { const r = fn(); ok = r === true || (r && r.ok); note = (r && r.note) || ''; }
    catch (e) { note = String(e); }
    results.push({ name, ok, note });
  };
  const mk = (seed, opts = {}) => new SandEngine({ size, seed, ...opts });

  const wallErrors = (e) => {
    let bad = 0;
    for (let y = 0; y < e.N; y++) for (let x = 0; x < e.N; x++) {
      const w = !e.insideFrame(x, y);
      if (w && e.mat[e.idx(x, y)] !== WALL) bad++;
      if (!w && e.mat[e.idx(x, y)] === WALL) bad++;
    }
    return bad;
  };
  const escapees = (e) => {
    let esc = 0;
    for (let y = 0; y < e.N; y++) for (let x = 0; x < e.N; x++) {
      const t = e.mat[e.idx(x, y)];
      if (t >= 1 && t < WALL && !e.insideFrame(x, y)) esc++;
    }
    return esc;
  };
  const churn = (e, steps) => {
    for (let k = 0; k < steps; k++) {
      e.setTargetGravity(Math.sin(k / 40), Math.cos(k / 40));
      e.smoothGravity();
      e.step();
    }
  };

  T("1 mass conservation (400 steps, moving gravity)", () => {
    const e = mk(0xC0FFEE);
    const c0 = e.grainCount();
    churn(e, 400);
    const c1 = e.grainCount();
    return { ok: c0 === c1, note: `${c0} → ${c1}` };
  });

  T("2 wall integrity after churn", () => {
    const e = mk(0xC0FFEE);
    churn(e, 400);
    const bad = wallErrors(e);
    return { ok: bad === 0, note: `${bad} corrupted cells` };
  });

  T("3 no sand escapes the frame", () => {
    const e = mk(0xC0FFEE);
    churn(e, 400);
    const esc = escapees(e);
    return { ok: esc === 0, note: `${esc} escapees` };
  });

  T("4 density stratification under settle", () => {
    const e = mk(0xC0FFEE);
    // scramble types, then settle 1500 steps under g=(0,1)
    for (let i = 0; i < e.N * e.N; i++) if (e.mat[i] >= 1 && e.mat[i] < WALL) e.mat[i] = 1 + ((e.rnd() * NTYPES) | 0);
    e.G.x = 0; e.G.y = 1; e.G.tx = 0; e.G.ty = 1;
    for (let k = 0; k < 1500; k++) e.step();
    let hy = 0, hc = 0, ly = 0, lc = 0;
    for (let y = 0; y < e.N; y++) for (let x = 0; x < e.N; x++) {
      const t = e.mat[e.idx(x, y)];
      if (t === 1) { hy += y; hc++; } else if (t === NTYPES) { ly += y; lc++; }
    }
    const mh = hy / Math.max(1, hc), ml = ly / Math.max(1, lc);
    return { ok: mh > ml + 2, note: `heavy ȳ=${mh.toFixed(1)} vs light ȳ=${ml.toFixed(1)}` };
  });

  T("5 flip preserves mass + walls", () => {
    const e = mk(0xC0FFEE);
    churn(e, 100);
    const c0 = e.grainCount();
    e.flipFrame();
    const c1 = e.grainCount();
    const wb = wallErrors(e);
    return { ok: c0 === c1 && wb === 0, note: `${c0}→${c1}, wallErr=${wb}` };
  });

  T("6 viscous cling: mass hangs after flip", () => {
    const e = mk(0xC0FFEE);
    e.flipFrame();                       // sand now on the ceiling
    e.G.x = 0; e.G.y = 1; e.G.tx = 0; e.G.ty = 1;
    for (let k = 0; k < 150; k++) e.step();
    let upper = 0, total = 0;
    for (let y = 0; y < e.N; y++) for (let x = 0; x < e.N; x++) {
      const t = e.mat[e.idx(x, y)];
      if (t >= 1 && t < WALL) { total++; if (y < e.C) upper++; }
    }
    const frac = upper / Math.max(1, total);
    return { ok: frac > 0.5, note: `${(frac * 100).toFixed(0)}% still suspended @150 steps` };
  });

  T("7 disturb storm: 200 taps, invariants hold", () => {
    const e = mk(0xC0FFEE);
    const c0 = e.grainCount();
    for (let k = 0; k < 200; k++) e.disturb(2 + ((e.rnd() * (e.N - 4)) | 0), 2 + ((e.rnd() * (e.N - 4)) | 0), 10);
    for (let k = 0; k < 60; k++) e.step();
    const c1 = e.grainCount();
    const wb = wallErrors(e);
    return { ok: c0 === c1 && wb === 0, note: `${c0}→${c1}, wallErr=${wb}` };
  });

  T("8 determinism under fixed seed", () => {
    const hashRun = () => {
      const e = mk(1234);
      e.G.x = 0; e.G.y = 1; e.G.tx = 0; e.G.ty = 1;
      for (let k = 0; k < 120; k++) e.step();
      let h = 0;
      for (let i = 0; i < e.N * e.N; i++) h = (Math.imul(h, 31) + e.mat[i]) | 0;
      return h;
    };
    const h1 = hashRun(), h2 = hashRun();
    return { ok: h1 === h2, note: `hash ${h1 >>> 0} vs ${h2 >>> 0}` };
  });

  T("9 palette generator: every palette valid", () => {
    let n = 0; const bad = [];
    for (const g of GROUPS) {
      const items = DIRECT[g] ? DIRECT[g] : TEAMS[g];
      items.forEach((it, i) => {
        n++;
        const p = resolvePalette(g, i);
        const name = paletteName(g, i);
        if (p.sand.length !== 5 || p.liquid.length !== 2) { bad.push(name + ":shape"); return; }
        if (![...p.sand, ...p.liquid].every(h => /^#[0-9a-f]{6}$/i.test(h))) { bad.push(name + ":hex"); return; }
        const L = p.sand.map(h => { const c = hexToRgb(h); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; });
        for (let k = 1; k < 5; k++) if (L[k] < L[k - 1] - 0.5) { bad.push(name + ":order"); return; }
        if (L[4] - L[0] < 60) bad.push(name + ":contrast");
      });
    }
    return { ok: bad.length === 0, note: `${n} palettes checked${bad.length ? '; bad: ' + bad.slice(0, 5).join(',') : ''}` };
  });

  T("10 square frame: churn keeps mass + walls", () => {
    const e = mk(0xC0FFEE, { shape: 'square' });
    const c0 = e.grainCount();
    churn(e, 300);
    e.flipFrame();
    for (let k = 0; k < 60; k++) e.step();
    const c1 = e.grainCount();
    const wb = wallErrors(e), esc = escapees(e);
    return { ok: c0 === c1 && wb === 0 && esc === 0, note: `${c0}→${c1}, wallErr=${wb}, esc=${esc}` };
  });

  T("11 renderer: full coverage, opaque, walls framed", () => {
    const e = mk(0xC0FFEE);
    const r = new SandRenderer(e.N);
    const bad = [];
    for (const g of GROUPS) {                       // sample one palette per group
      r.setPalette(resolvePalette(g, 0));
      if (!r.LUT || !r.BGROW) { bad.push(g + ":lut"); continue; }
    }
    r.setPalette(resolvePalette('Exotic', 0));
    const px = new Uint32Array(e.N * e.N);
    for (let k = 0; k < 30; k++) e.step();
    r.render(e, px);
    const frameCol = pack(18, 16, 14);
    let unset = 0, wallBad = 0;
    for (let y = 0; y < e.N; y++) for (let x = 0; x < e.N; x++) {
      const i = e.idx(x, y);
      if (px[i] === 0) unset++;
      if (e.mat[i] === WALL && px[i] !== frameCol) wallBad++;
    }
    if (unset) bad.push(`${unset} unset px`);
    if (wallBad) bad.push(`${wallBad} bad wall px`);
    return { ok: bad.length === 0, note: bad.join('; ') || `${e.N * e.N} px verified` };
  });

  const pass = results.filter(r => r.ok).length;
  return { pass, total: results.length, results };
}
