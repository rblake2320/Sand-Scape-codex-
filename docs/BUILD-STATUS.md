# Build status — 2026-07-16 (v2.0.0)

## Completed

- Repository converted from zip archives to a real source tree
- v5 "Exotic Sands" physics engine: viscous cling, spatial-permeability seepage,
  repose slides, five-type density stratification, deterministic seeded RNG
- Modular ESM architecture: DOM-free `engine.js` / `palettes.js` / `render.js` /
  `selftests.js` + `app.js` DOM shell
- 193 palettes (Exotic Sands, Classic, NFL, NBA, MLB, NHL, NCAA, Soccer) with a
  validated 5-band density-ramp generator
- 3-level LUT dune lighting, two-deep air-bubble foam band, glitter, PNG capture
- Circle and square glass shapes, flow-speed control, adaptive 256/448 grid
- Offline PWA (service worker cache v2, maskable icons)
- Capacitor 8 Android and iOS native projects (carried over from v1)
- GitHub Actions CI: syntax checks + invariant tests + Playwright smoke test

## Validation performed (2026-07-16, Windows 11 / Node 22 / Python 3.12)

- `node --check` on every module: PASS
- `node tests/run-tests.mjs`: **11/11 @ 256² and 11/11 @ 448²**
  (mass conservation, wall integrity, no escape, stratification, flip integrity,
  viscous cling, disturb storm, determinism, 193-palette validity, square-frame
  integrity, renderer coverage)
- `python tests/smoke_test.py` (headless Chromium): PASS — app boots, 22,540
  grains seeded, 11/11 in-page self-tests, zero console/page errors
- JSON validation for package, Capacitor configuration and web manifest: PASS

## Pending / external steps

- `npx cap sync` must be re-run before the next native build (web assets changed
  in v2; requires `npm ci` first)
- A signed iOS `.ipa` requires macOS, Xcode, an Apple Developer team and signing
  profile
- Physical-device acceptance run (`docs/ACCEPTANCE-TESTS.md`) on iPhone / Pixel
  class hardware — headless timings are diagnostics, not device certification
