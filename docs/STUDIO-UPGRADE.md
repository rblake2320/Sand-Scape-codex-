# SandScape: visual and behavior upgrade

The preview now renders a Blender-built sand-picture sculpture with a stone base,
metal frame, optical glass material, lighting and shadows. The round and rounded-square
models are editable in `art/sandscape-sculpture.blend` and are exported as GLB assets.
Three.js renders the sculpture and live grain geometry in the browser. Unity and
Unreal were not used or required for this browser delivery.

## What changed

- Live 3D sand grains: 70,540 grain clusters on the large-screen profile, inside a
  shallow glass chamber. These are rendered from the current simulation cells,
  not a generated image, prerecorded loop, or fake progress animation.
- Camera orbit is separate from tilting the sand picture. Orbiting cannot change
  gravity. Flipping rotates the ring/chamber while the stone base stays upright.
- Champagne, graphite and silver finishes; round and rounded-square frames.
- Persistent air-gap release channels produce streams. The air-resistance control
  affects release rate; redistribute-bubbles changes the gaps without teleporting
  the grains. A physical shake now redistributes gaps instead of flipping.
- Heavier grains fall faster through the simulated liquid and can settle below
  lighter grains. Mass, containment and deterministic-seed tests still pass.
- Fixed simulation ticks prevent 30/60/144 Hz displays from changing the pour rate.
- Visible controls, pause/resume, 193 palettes, full sculpture PNG capture and
  up-to-30-second video recording. The 2D view remains available.
- Local Laya 0.3.11 suggests one of five atmospheres and a flow speed from English
  text. You review and apply it. No paid service, image generator, or command
  execution is attached to the model.
- Offline manual studio, a loopback-only model service, bounded requests,
  Host/Origin checks, model-output validation and network-first offline caching.

## Observed results

| Scenario | Outcome |
|---|---|
| Blender authoring, export and source reopen | Worked: Blender 5.1.2; 25 source objects; no missing image dependencies |
| GLB runtime integration | Worked: both frames loaded and rendered; about 414 KB per GLB |
| Live grain geometry | Worked: point count equals simulation grain count |
| Camera orbit while paused | Worked: camera changed; gravity and sand state unchanged |
| Frame shape and metal finishes | Worked: round/square and silver/champagne captured in browser |
| Original physics invariants | Worked: 22/22 across 256 and 448 grids |
| Heavy versus light free fall | Worked: average 30.5 vs 21.125 cells over 60 steps, eight seeded trials each |
| Air resistance | Worked: after 600 steps, 19.48% retained above at 0.5 resistance vs 31.10% at 2 |
| Long settling cycle | Worked: 22,540 grains conserved through 12,000 steps; upper fraction declined from 97.94% at step 150 to 0.035% |
| Display-rate independence | Worked: 600 simulation ticks per 10 seconds at 30/60/144 Hz |
| Real Laya inference | Worked: 10/10 agent-authored descriptive cases matched palette and flow; 445–531 ms on CPU |
| Browser suggestion/apply, pause, text input, persistence | Worked |
| Invalid inputs, foreign origins/hosts, hostile model settings | Worked: rejected without applying invalid state |
| PNG and video export | Worked: actual file downloads; recorded video decoded and played |
| Offline reload and disconnected-model controls | Worked |
| 390x844 mobile emulation and reduced motion | Worked: no horizontal overflow, paused startup and accessible controls |
| Static-host smoke test | Worked: 11/11 in-browser invariants and no console errors |

The Laya cases are integration checks written by the implementing agent, not a
human-labelled calibration set or proof of superiority over keyword rules. Raw
model confidence is deliberately not presented as an accuracy guarantee.
The installed checkpoint snapshot was `aa8c91ca088ec597df95a0d1c76b3063cb2ae5e8`.

The simulation is a cellular granular model with an air-resistance approximation.
It is not a full multiphase fluid solver; the individual rendered points represent
clusters of sand. Mobile checks used browser emulation, not a native phone build.
No native-store deployment or Unity/Unreal build was performed.

## Next worthwhile improvements

1. Compare the flow and dunes against owner-selected real sand-picture recordings,
   including tilted, over-aerated and under-aerated examples. Tune against those
   references instead of assuming more particles makes the behavior more accurate.
2. Improve the moving air model so bubbles merge, migrate upward and exchange places
   with grains. The present persistent gap field is deterministic and controllable.
3. Add reproducible saved scenes and gesture replay, plus composition presets for
   longer exports. Current PNG/video export captures the live selected renderer.
4. Evaluate Laya on owner-reviewed paraphrases, negations and ambiguous prompts
   against a keyword baseline before expanding automatic decisions or languages.
5. Profile on target phones before raising particle density or adopting a GPU
   solver. Retain the manual/offline experience and deterministic acceptance tests.

## Reproduce

```powershell
pwsh scripts/Start-Studio.ps1 -Install   # first setup; downloads public model weights
# Subsequent runs:
pwsh scripts/Start-Studio.ps1
# Open http://127.0.0.1:4187
node tests/run-tests.mjs
node tests/physical-behavior.mjs artifacts/physical-behavior.json
python tests/studio_acceptance.py --output artifacts
python tests/sculpture_acceptance.py --output artifacts
```

Run `npm ci` then `node scripts/vendor-three.mjs` to reproduce the checked-in
browser modules. Build art with Blender's background CLI and
`scripts/build_sculpture.py`. Test scripts requiring a browser use Playwright.
Machine-readable receipts and preserved initial failures are in `docs/evidence/`.

## Sources and asset rights

- [Exotic Sands: air barriers and density separation](https://exoticsands.com/pages/q-and-a)
- [Sandman: air regulation and slow flow](https://sandpicture.com/too-slow/?lang=en)
- [Official Laya model card, licensing and limitations](https://huggingface.co/convaiinnovations/laya)
- [Three.js documentation](https://threejs.org/docs/)

Sculpture and travertine material: original work under this project's MIT license.
Three.js 0.186.0 is vendored with its MIT license. Laya weights use Apache 2.0.
No third-party artwork or paid asset was used.
