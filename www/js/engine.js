/* SandScape engine — viscous falling-sand automaton with arbitrary gravity.
   Pure simulation: no DOM, no canvas. Runs identically in the browser and in
   Node (tests import this file directly).

   Grid cellular hybrid ≈ height-field behavior at settle time.
   Cell = 1 grain cluster. Deterministic under a seeded RNG. */

export const WALL = 255;
export const EMPTY = 0;
export const NTYPES = 5;                    // grain types 1..5
export const DEN = [0, 5, 4, 3, 2, 1];      // DEN[type]: higher = heavier; type 1 settles to the bottom

/* viscosity model (glycerin-filled frame) */
const P_FALL  = 0.52;    // free-fall advance prob per substep (liquid drag)
const P_LOOSE = 0.42;    // unsupported grain starts falling
const P_LEAK  = 0.0045;  // ceiling-clinging grain releases (thin waterfall)
const P_SLIDE = 0.26;    // repose slide
const P_SINK  = 0.018;   // heavier grain sinks through lighter (stratification)

export function hash2(x, y, s) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

export class SandEngine {
  /* size: grid side (256 phone / 448 large screens)
     shape: 'circle' | 'square' glass mask
     seed: RNG seed (defaults to a random one; tests pass a fixed seed) */
  constructor({ size = 256, shape = 'circle', seed } = {}) {
    this.N = size;
    this.C = size / 2;
    this.R = this.C - 3;
    this.shape = shape;
    this.substeps = size >= 448 ? 3 : 2;   // denser grid → more steps for constant flow speed
    this.stepCap  = size >= 448 ? 7 : 6;   // per-frame substep ceiling
    this.disturbRadius = Math.max(6, Math.round(11 * size / 256));
    this.mat   = new Uint8Array(size * size);
    this.shade = new Uint8Array(size * size);   // 0..31 per-grain tint jitter
    this.fall  = new Uint8Array(size * size);   // 1 = currently in free fall
    this.G = { x: 0, y: 1, tx: 0, ty: 1 };      // current + target gravity
    this.framePass = 0;
    this.reseed(seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.initSand();
  }

  /* ---------- seeded RNG (mulberry32) ---------- */
  reseed(s) { this._seed = s >>> 0; }
  rnd() {
    this._seed |= 0; this._seed = (this._seed + 0x6D2B79F5) | 0;
    let t = Math.imul(this._seed ^ (this._seed >>> 15), 1 | this._seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  idx(x, y) { return y * this.N + x; }

  insideFrame(x, y) {
    const { N, C, R } = this;
    if (this.shape === 'square') {
      const m = 3, r = Math.round(N * 0.14);           // rounded-square glass
      if (x < m || y < m || x >= N - m || y >= N - m) return false;
      const cx = x < m + r ? m + r : (x >= N - m - r ? N - m - r - 1 : x);
      const cy = y < m + r ? m + r : (y >= N - m - r ? N - m - r - 1 : y);
      if (cx === x || cy === y) return true;           // not in a corner zone
      const dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy <= r * r;
    }
    const dx = x - C + 0.5, dy = y - C + 0.5;
    return dx * dx + dy * dy <= R * R;
  }

  buildWalls() {
    const { N, mat } = this;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      mat[this.idx(x, y)] = this.insideFrame(x, y) ? EMPTY : WALL;
  }

  setShape(shape) {
    if (shape === this.shape) return;
    this.shape = shape;
    this.initSand();
  }

  initSand() {
    this.buildWalls();
    this.fall.fill(0);
    const { N, C, R, mat, shade } = this;
    // fill the lower ~46% of the glass in density-ordered bands, heaviest at the bottom
    const top = C + R * 0.06;
    const bot = C + R;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = this.idx(x, y);
        if (mat[i] === WALL) continue;
        if (y > top) {
          const f = (y - top) / (bot - top);
          let t = 1 + Math.min(NTYPES - 1, Math.floor((1 - f) * NTYPES)); // heavy low
          if (this.rnd() < 0.10) t = Math.max(1, Math.min(NTYPES, t + (this.rnd() < 0.5 ? -1 : 1)));
          mat[i] = t;
          shade[i] = (this.rnd() * 32) | 0;
        }
      }
    }
  }

  /* ---------- gravity ---------- */
  setTargetGravity(x, y) {
    const m = Math.hypot(x, y);
    if (m < 0.12) return;                     // near-flat: keep last direction
    const G = this.G;
    const nx = x / m, ny = y / m;
    const changed = Math.abs(nx - G.tx) + Math.abs(ny - G.ty) > 0.012;
    G.tx = nx; G.ty = ny;
    return changed;
  }

  smoothGravity() {                           // low-pass: kills hand tremor
    const G = this.G;
    G.x += (G.tx - G.x) * 0.085;
    G.y += (G.ty - G.y) * 0.085;
  }

  /* Spatial permeability — coarse, static, deterministic. Modulates how readily
     a resting grain RELEASES, so sand seeps through in uneven streams and holds
     in others (the visible effect of the real air-bubble barrier), sculpting
     intricate fronts instead of a uniform sheet. Free-fall speed is untouched. */
  permAt(x, y) { return 0.40 + 0.60 * ((hash2(x >> 3, y >> 3, 0x5A17) & 255) * 0.00392157); }

  /* ---------- physics step ---------- */
  step() {
    this.framePass++;
    const { N, G } = this;
    let gx = G.x, gy = G.y;
    const gm = Math.hypot(gx, gy) || 1; gx /= gm; gy /= gm;

    let px, py, tsign;
    if (Math.abs(gy) >= Math.abs(gx)) { py = gy > 0 ? 1 : -1; px = 0; tsign = gx >= 0 ? 1 : -1; }
    else                              { px = gx > 0 ? 1 : -1; py = 0; tsign = gy >= 0 ? 1 : -1; }
    const tmag = px === 0 ? Math.abs(gx) : Math.abs(gy);   // tangential strength 0..~1

    if (py !== 0) {
      const y0 = py > 0 ? N - 2 : 1, y1 = py > 0 ? 0 : N - 1, dy = -py;
      for (let y = y0; y !== y1; y += dy) {
        const ltr = ((y + this.framePass) & 1) === 0;
        if (ltr) for (let x = 1; x < N - 1; x++) this.cellV(x, y, py, tsign, tmag);
        else     for (let x = N - 2; x >= 1; x--) this.cellV(x, y, py, tsign, tmag);
      }
    } else {
      const x0 = px > 0 ? N - 2 : 1, x1 = px > 0 ? 0 : N - 1, dx = -px;
      for (let x = x0; x !== x1; x += dx) {
        const ltr = ((x + this.framePass) & 1) === 0;
        if (ltr) for (let y = 1; y < N - 1; y++) this.cellH(x, y, px, tsign, tmag);
        else     for (let y = N - 2; y >= 1; y--) this.cellH(x, y, px, tsign, tmag);
      }
    }
  }

  cellV(x, y, py, tsign, tmag) {
    const { mat, fall } = this;
    const i = this.idx(x, y), t = mat[i];
    if (t === EMPTY || t === WALL) return;
    const bi = this.idx(x, y + py);           // gravity side
    const ai = this.idx(x, y - py);           // anti-gravity side
    const held = mat[ai] !== EMPTY;           // sand OR wall above → cohesive/clinging
    const b = mat[bi];

    if (b === EMPTY) {
      const p = fall[i] ? P_FALL : (held ? P_LEAK : P_LOOSE) * this.permAt(x, y);
      if (this.rnd() < p) { this.moveGrain(i, bi); fall[bi] = 1; }
      return;                                 // waiting; keep fall state
    }
    if (b !== WALL && DEN[b] < DEN[t] && !fall[i] && this.rnd() < P_SINK) {
      this.swapGrain(i, bi); return;
    }
    // blocked: settle + try repose slide (favor the tangential direction)
    fall[i] = 0;
    const firstDx = (this.rnd() < 0.5 + 0.45 * tmag) ? tsign : -tsign;
    if (!this.trySlide(i, this.idx(x + firstDx, y + py))) this.trySlide(i, this.idx(x - firstDx, y + py));
  }

  cellH(x, y, px, tsign, tmag) {
    const { mat, fall } = this;
    const i = this.idx(x, y), t = mat[i];
    if (t === EMPTY || t === WALL) return;
    const bi = this.idx(x + px, y);
    const ai = this.idx(x - px, y);
    const held = mat[ai] !== EMPTY;
    const b = mat[bi];

    if (b === EMPTY) {
      const p = fall[i] ? P_FALL : (held ? P_LEAK : P_LOOSE) * this.permAt(x, y);
      if (this.rnd() < p) { this.moveGrain(i, bi); fall[bi] = 1; }
      return;
    }
    if (b !== WALL && DEN[b] < DEN[t] && !fall[i] && this.rnd() < P_SINK) {
      this.swapGrain(i, bi); return;
    }
    fall[i] = 0;
    const firstDy = (this.rnd() < 0.5 + 0.45 * tmag) ? tsign : -tsign;
    if (!this.trySlide(i, this.idx(x + px, y + firstDy))) this.trySlide(i, this.idx(x + px, y - firstDy));
  }

  trySlide(i, j) {
    if (this.mat[j] !== EMPTY) return false;
    if (this.rnd() >= P_SLIDE) return false;
    this.moveGrain(i, j); return true;
  }

  moveGrain(i, j) {
    const { mat, shade, fall } = this;
    mat[j] = mat[i]; shade[j] = shade[i]; fall[j] = fall[i];
    mat[i] = EMPTY; fall[i] = 0;
  }

  swapGrain(i, j) {
    const { mat, shade } = this;
    const m = mat[i], s = shade[i];
    mat[i] = mat[j]; shade[i] = shade[j];
    mat[j] = m; shade[j] = s;
  }

  /* ---------- interactions ---------- */
  disturb(cx, cy, rad = this.disturbRadius) {
    const { N, mat, fall } = this;
    for (let y = Math.max(1, cy - rad); y <= Math.min(N - 2, cy + rad); y++) {
      for (let x = Math.max(1, cx - rad); x <= Math.min(N - 2, cx + rad); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > rad * rad) continue;
        const i = this.idx(x, y);
        if (mat[i] === EMPTY || mat[i] === WALL) continue;
        fall[i] = 1;
        // random 1-cell jostle into an empty neighbor
        const ox = x + ((this.rnd() * 3) | 0) - 1, oy = y + ((this.rnd() * 3) | 0) - 1;
        const j = this.idx(ox, oy);
        if (mat[j] === EMPTY && this.rnd() < 0.6) this.moveGrain(i, j);
      }
    }
  }

  flipFrame() {
    const { N, mat, shade } = this;
    const m2 = new Uint8Array(N * N), s2 = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const src = this.idx(x, y), dst = this.idx(N - 1 - x, N - 1 - y);
      if (mat[src] === WALL) { m2[src] = WALL; continue; }   // walls symmetric under 180°
      if (mat[src] !== EMPTY) { m2[dst] = mat[src]; s2[dst] = shade[src]; }
    }
    // restore the wall ring exactly
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if (!this.insideFrame(x, y)) m2[this.idx(x, y)] = WALL;
    this.mat = m2; this.shade = s2; this.fall.fill(0);
  }

  /* ---------- inspection (tests, capture) ---------- */
  grainCount() {
    let c = 0;
    for (let i = 0; i < this.mat.length; i++) { const t = this.mat[i]; if (t >= 1 && t < WALL) c++; }
    return c;
  }

  snapshot() {
    const G = this.G;
    return { m: this.mat.slice(), s: this.shade.slice(), f: this.fall.slice(),
             gx: G.x, gy: G.y, tx: G.tx, ty: G.ty };
  }

  restore(sn) {
    this.mat = sn.m; this.shade = sn.s; this.fall = sn.f;
    const G = this.G;
    G.x = sn.gx; G.y = sn.gy; G.tx = sn.tx; G.ty = sn.ty;
  }
}
