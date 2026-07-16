# CLAUDE.md

SandScape — gravity-responsive liquid sand-art simulation. PWA + Capacitor mobile.

## Architecture (v2, modular ESM)
- `www/js/engine.js` — pure physics, **no DOM**. Node imports it directly.
- `www/js/palettes.js` — palette data + team-ramp generator (pure).
- `www/js/render.js` — grid → packed RGBA pixels (pure).
- `www/js/selftests.js` — the 11-invariant contract (browser + Node).
- `www/js/app.js` — the ONLY file that touches the DOM.
- Keep this split: anything testable stays out of `app.js`.

## Run tests before every commit (must be 22/22)
```bash
node tests/run-tests.mjs          # 11 invariants × (256 + 448 grids)
python tests/smoke_test.py        # headless-Chromium boot check (optional locally, runs in CI)
```

## Preview locally
```bash
npm run start                     # http://localhost:4173
```

## Conventions
- Physics constants (`P_FALL`, `P_LEAK`, …) are tuned against the real Exotic
  Sands frames — do not change them without re-checking test 6 (viscous cling)
  and the on-device feel.
- The engine must stay deterministic under a fixed seed (test 8). No
  `Math.random()` inside `engine.js`/`render.js` — use the instance RNG.
- Never commit secrets or fabricated benchmark numbers; label headless timings
  as diagnostics, not device results.
- Related repo: `rblake2320/sandscape` is the single-file predecessor; this repo
  is the modular + mobile successor. Don't sync them automatically.
