/* Node runner for the SandScape invariant self-tests.
   The engine/renderer/palettes are pure ESM with no DOM, so this imports them
   directly — no stubbing. Runs both device profiles unless SIZE is set.

   Usage:  node tests/run-tests.mjs           # 256 + 448 grids
           SIZE=256 node tests/run-tests.mjs  # single profile */

import { runSelfTests } from '../www/js/selftests.js';

const sizes = process.env.SIZE ? [Number(process.env.SIZE)] : [256, 448];
let failed = 0;

for (const size of sizes) {
  const t0 = Date.now();
  const { pass, total, results } = runSelfTests(size);
  console.log(`\nSandScape self-tests @ ${size}×${size}: ${pass}/${total} passed (${Date.now() - t0}ms)`);
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.note}`);
  }
  if (pass !== total) failed++;
}

process.exit(failed ? 1 : 0);
