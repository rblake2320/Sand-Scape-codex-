/* SandScape renderer — turns the engine grid into packed RGBA pixels.
   Writes into a caller-supplied Uint32Array (the ImageData buffer in the
   browser, a plain array in tests). No DOM. */

import { WALL, EMPTY, NTYPES, DEN, hash2 } from './engine.js';
import { hexToRgb } from './palettes.js';

const LE = (() => { const b = new ArrayBuffer(4); new Uint32Array(b)[0] = 1; return new Uint8Array(b)[0] === 1; })();
export function pack(r, g, b) {
  return LE ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

const FRAMECOL = pack(18, 16, 14);
const BUBBLE = pack(236, 232, 222);
const SPARK = pack(255, 252, 244);

export class SandRenderer {
  constructor(N) {
    this.N = N;
    this.LUT = null;      // Uint32 per (type 1..5, light level 0..2, shade 0..31)
    this.BGROW = null;    // Uint32 per y (liquid gradient)
    this.sparkPk = SPARK;
    this.frameNo = 0;
  }

  /* LUT holds 3 brightness levels per (type, shade): 0=buried shadow,
     1=normal, 2=lit crest. Lets the renderer light the dune surface for a
     3D read without any per-pixel color math (just a level pick). */
  setPalette(P) {
    const N = this.N;
    const [lqr, lqg, lqb] = hexToRgb(P.liquid[0]);
    this.LUT = new Uint32Array((NTYPES + 1) * 96);
    const LEVELS = [0.80, 1.0, 1.20];
    for (let t = 1; t <= NTYPES; t++) {
      let [r, g, b] = hexToRgb(P.sand[t - 1]);
      // real frames mix opaque and translucent grains for a 3D effect: let the
      // tinted liquid bleed through the lightest (fine, floating) band slightly
      if (t === NTYPES) { r = r * 0.88 + lqr * 0.12; g = g * 0.88 + lqg * 0.12; b = b * 0.88 + lqb * 0.12; }
      for (let L = 0; L < 3; L++) {
        const lv = LEVELS[L];
        for (let s = 0; s < 32; s++) {
          const v = (0.82 + (s / 31) * 0.32) * lv;   // striation jitter × light level
          this.LUT[t * 96 + L * 32 + s] = pack(
            Math.min(255, (r * v) | 0), Math.min(255, (g * v) | 0), Math.min(255, (b * v) | 0));
        }
      }
    }
    if (P.glitter) {
      const [gr, gg, gb] = hexToRgb(P.glitter);
      this.sparkPk = pack(Math.min(255, gr + 34), Math.min(255, gg + 34), Math.min(255, gb + 34));
    } else this.sparkPk = SPARK;

    this.BGROW = new Uint32Array(N);
    const [r0, g0, b0] = hexToRgb(P.liquid[0]), [r1, g1, b1] = hexToRgb(P.liquid[1]);
    for (let y = 0; y < N; y++) {
      const f = y / (N - 1);
      this.BGROW[y] = pack((r0 + (r1 - r0) * f) | 0, (g0 + (g1 - g0) * f) | 0, (b0 + (b1 - b0) * f) | 0);
    }
  }

  render(engine, px32) {
    this.frameNo++;
    const { N, LUT, BGROW, sparkPk, frameNo } = this;
    const { mat, shade, G } = engine;
    const idx = (x, y) => y * N + x;

    // primary gravity dir for bubble/foam + lighting detection
    let px_ = 0, py_ = 1;
    if (Math.abs(G.y) >= Math.abs(G.x)) { py_ = G.y > 0 ? 1 : -1; px_ = 0; } else { px_ = G.x > 0 ? 1 : -1; py_ = 0; }

    for (let y = 0; y < N; y++) {
      const row = y * N, bg = BGROW[y];
      for (let x = 0; x < N; x++) {
        const i = row + x, t = mat[i];
        if (t === WALL) { px32[i] = FRAMECOL; continue; }
        if (t === EMPTY) {
          // air-bubble barrier: the rising-air foam band under a clinging sand
          // mass is what lets real frames form dunes instead of dropping straight
          // (movingsandart.com science). Two cells deep so the band reads clearly.
          const s1 = mat[idx(x - px_, y - py_)];          // 1 toward the sand
          if (s1 >= 1 && s1 < WALL) {
            if ((hash2(x, y, frameNo >> 4) % 5) < 2) { px32[i] = BUBBLE; continue; }
          } else {
            const s2 = mat[idx(x - 2 * px_, y - 2 * py_)];  // 2 toward the sand → deeper foam
            if (s2 >= 1 && s2 < WALL && (hash2(x, y, frameNo >> 4) % 7) < 2) { px32[i] = BUBBLE; continue; }
          }
          px32[i] = bg; continue;
        }
        // sparkle on the two lightest sand types
        if (DEN[t] <= 2 && (hash2(x, y, frameNo >> 2) % 151) === 0) { px32[i] = sparkPk; continue; }
        // depth/surface lighting: crest grains (liquid toward the surface) catch
        // light; grains buried under ≥2 sand cells sit in shadow → 3D dunes
        const up = mat[idx(x - px_, y - py_)];
        let L = 1;
        if (up === EMPTY) L = 2;
        else { const up2 = mat[idx(x - 2 * px_, y - 2 * py_)]; if (up2 >= 1 && up2 < WALL) L = 0; }
        px32[i] = LUT[t * 96 + L * 32 + shade[i]];
      }
    }
  }
}
