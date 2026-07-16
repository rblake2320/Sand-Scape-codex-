# Changelog

## 2.0.0 — 2026-07-16

Repository rebuilt from zip archives into a real source tree, and the simulation
upgraded to the v5 "Exotic Sands" physics engine.

- **Physics engine replaced** — viscous falling-sand automaton with arbitrary
  gravity, ceiling cling, spatial-permeability seepage, repose slides, and
  five-type density stratification. Deterministic under a seeded RNG (mulberry32).
- **193 palettes** — authentic Exotic Sands variants (tinted liquid, black→white
  banding, per-variant glitter), hand-tuned classics, and generated NFL / NBA /
  MLB / NHL / NCAA / Soccer team palettes with a validated 5-band density ramp.
- **Rendering** — 3-level LUT dune lighting (crest / normal / buried), two-deep
  air-bubble foam band, sparkle, liquid gradient.
- **Modular ESM architecture** — `engine.js` / `palettes.js` / `render.js` /
  `selftests.js` are DOM-free and Node-importable; `app.js` holds all DOM glue.
- **Tests** — 11 invariant self-tests run natively in Node (`npm test`, both
  256/448 profiles), in-app via the drawer button, and in GitHub Actions CI,
  plus a Playwright browser smoke test.
- **Features** — circle/square glass, flow-speed control, framed PNG capture,
  keyboard controls, palette/speed/shape persistence, gravity indicator,
  adaptive 256/448 grid.
- Removed the source zip archives from the repository root (content now lives
  in the tree; archives remain in git history).

## 1.0.0 — 2026-07-13

- Initial functional SandScape release
- Live four-material sand and trapped-air simulation
- Tilt, shake, touch and drag interactions
- Four palettes and two frame shapes
- Adaptive performance tiering
- Offline PWA support
- Capacitor 8.4.1 Android and iOS native projects
- Native app icons, splash screens, tests and build scripts
