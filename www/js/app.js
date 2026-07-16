/* SandScape app shell — DOM, sensors, pointer, drawer UI, capture, PWA.
   All simulation logic lives in engine.js; all pixel work in render.js. */

import { SandEngine } from './engine.js';
import { SandRenderer } from './render.js';
import { GROUPS, DIRECT, TEAMS, resolvePalette, paletteName, paletteCount } from './palettes.js';
import { runSelfTests } from './selftests.js';

/* ---------- persistence (storage can be blocked in private/embedded contexts) ---------- */
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
};

/* ---------- state ---------- */
// Adaptive grid: big screens get a finer grid so the rim and sand slopes stop
// stair-stepping. Load-time decision; phones stay at 256.
const N = (typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) >= 700) ? 448 : 256;
let shape = store.get('sandscape.shape') === 'square' ? 'square' : 'circle';
const sim = new SandEngine({ size: N, shape });
const renderer = new SandRenderer(N);

let SPEED = Number(store.get('sandscape.speed')) || 1;
if (!(SPEED >= 0.5 && SPEED <= 3)) SPEED = 1;

let sel = { group: 'Exotic', i: 0 };            // land on authentic Ocean Blue
try {
  const saved = JSON.parse(store.get('sandscape.palette') || 'null');
  if (saved && GROUPS.includes(saved.group) && saved.i >= 0 && saved.i < paletteCount(saved.group)) sel = saved;
} catch { /* ignore */ }
let viewGroup = sel.group;
let debugHud = false;

/* ---------- canvas ---------- */
const cv = document.getElementById('sim');
const ctx = cv.getContext('2d', { alpha: false });
const off = document.createElement('canvas'); off.width = N; off.height = N;
const octx = off.getContext('2d', { alpha: false });
const img = octx.createImageData(N, N);
const px32 = new Uint32Array(img.data.buffer);

let indR = 0;
function size() {
  const S = Math.min(innerWidth, innerHeight) * 0.84;
  document.documentElement.style.setProperty('--S', S + 'px');
  indR = S * 0.5 - 14;
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
}
addEventListener('resize', size);

/* ---------- toast ---------- */
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- palette ---------- */
function applyPalette() {
  renderer.setPalette(resolvePalette(sel.group, sel.i));
  store.set('sandscape.palette', JSON.stringify(sel));
}

/* ---------- sensors ---------- */
const tiltBtn = document.getElementById('tiltBtn');
let tiltMode = 'finger';          // 'finger' | 'device'
let userChoseMode = false;
let sensorAvailable = false;
let fingerHintShown = false;
let lastGChange = 0;

function noteGravityChange(changed) { if (changed) lastGChange = performance.now(); }

function updateModeUI() {
  const d = document.getElementById('modeDevice');
  const f = document.getElementById('modeFinger');
  if (tiltMode === 'device') { d.classList.add('on'); f.classList.remove('on'); }
  else { f.classList.add('on'); d.classList.remove('on'); }
}

function orientationAngle() {
  return (screen.orientation && typeof screen.orientation.angle === 'number')
    ? screen.orientation.angle : (window.orientation || 0);
}

function onOrient(e) {
  if (e.beta == null || e.gamma == null) return;
  if (!sensorAvailable) {
    sensorAvailable = true;
    if (!userChoseMode) { tiltMode = 'device'; updateModeUI(); }
  }
  if (tiltMode !== 'device') return;
  const beta = e.beta * Math.PI / 180, gamma = e.gamma * Math.PI / 180;
  // screen-plane gravity in portrait device coords
  let gx = Math.sin(gamma) * Math.cos(beta);
  let gy = Math.sin(beta);
  // rotate into the current screen orientation
  const a = -orientationAngle() * Math.PI / 180;
  const rx = gx * Math.cos(a) - gy * Math.sin(a);
  const ry = gx * Math.sin(a) + gy * Math.cos(a);
  noteGravityChange(sim.setTargetGravity(rx, ry));
}

let lastFlip = 0;
function shakeFlip() {
  const now = performance.now();
  if (now - lastFlip < 1600) return;
  lastFlip = now;
  sim.flipFrame();
  toast('Flipped');
}
function onMotion(e) {
  const a = e.acceleration;
  if (a && a.x != null) {
    const mag = Math.hypot(a.x, a.y, a.z || 0);
    if (mag > 16) shakeFlip();
  }
}
function hookSensors() {
  addEventListener('deviceorientation', onOrient, true);
  addEventListener('devicemotion', onMotion, true);
}

if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function') {
  tiltBtn.style.display = 'block';
  tiltBtn.addEventListener('click', async () => {
    try {
      const r1 = await DeviceOrientationEvent.requestPermission();
      if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission)
        await DeviceMotionEvent.requestPermission().catch(() => {});
      if (r1 === 'granted') {
        hookSensors(); tiltBtn.style.display = 'none';
        tiltMode = 'device'; userChoseMode = true; updateModeUI();
        toast('Device tilt enabled');
      } else toast('Permission denied — drag to tilt instead');
    } catch { toast('Sensor error — drag to tilt instead'); }
  });
} else {
  hookSensors();
}

/* ---------- pointer: tap / drag-tilt / long-press ---------- */
const drawer = document.getElementById('drawer');
let pDown = null, pMoved = false, lpTimer = null;

cv.parentElement.addEventListener('pointerdown', e => {
  pDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  pMoved = false;
  lpTimer = setTimeout(() => { if (!pMoved) { drawer.classList.add('open'); pDown = null; } }, 550);
});
addEventListener('pointermove', e => {
  if (!pDown) return;
  const dx = e.clientX - pDown.x, dy = e.clientY - pDown.y;
  if (Math.hypot(dx, dy) > 12) {
    pMoved = true; clearTimeout(lpTimer);
    if (tiltMode === 'finger') {                 // finger steering: drag = gravity
      const r = cv.getBoundingClientRect();
      noteGravityChange(sim.setTargetGravity(
        e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)));
      if (!fingerHintShown) { fingerHintShown = true; toast('Sand pours toward the glowing marker'); }
    }
  }
});
addEventListener('pointerup', e => {
  clearTimeout(lpTimer);
  if (pDown && !pMoved && performance.now() - pDown.t < 400) {
    const r = cv.getBoundingClientRect();
    const gx = Math.round((e.clientX - r.left) / r.width * N);
    const gy = Math.round((e.clientY - r.top) / r.height * N);
    sim.disturb(gx, gy);
  }
  pDown = null;
});
document.addEventListener('pointerdown', e => {
  if (drawer.classList.contains('open') && !drawer.contains(e.target)) drawer.classList.remove('open');
}, true);

/* ---------- keyboard (desktop) ---------- */
addEventListener('keydown', e => {
  const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (map[e.key]) { e.preventDefault(); noteGravityChange(sim.setTargetGravity(...map[e.key])); return; }
  const k = e.key.toLowerCase();
  if (k === 'f') { sim.flipFrame(); toast('Flipped'); }
  if (k === 'r') { sim.initSand(); toast('Reset'); }
  if (k === 'p') drawer.classList.toggle('open');
  if (k === 's') capture();
  if (k === 'd') { debugHud = !debugHud; }
});

/* ---------- drawer UI ---------- */
const palList = document.getElementById('palList');
const tabList = document.getElementById('tabList');
function buildDrawer() {
  tabList.innerHTML = '';
  GROUPS.forEach(g => {
    const b = document.createElement('button');
    b.className = 'tab' + (g === viewGroup ? ' active' : '');
    b.textContent = g;
    b.addEventListener('click', () => { viewGroup = g; buildDrawer(); });
    tabList.appendChild(b);
  });
  palList.innerHTML = '';
  const items = DIRECT[viewGroup] ? DIRECT[viewGroup] : TEAMS[viewGroup];
  items.forEach((it, i) => {
    const p = resolvePalette(viewGroup, i);
    const name = paletteName(viewGroup, i);
    const el = document.createElement('button');
    el.className = 'pal' + (viewGroup === sel.group && i === sel.i ? ' active' : '');
    el.innerHTML = `<span class="strip">${p.sand.map(c => `<i style="background:${c}"></i>`).join('')}</span><span>${name}</span>`;
    el.addEventListener('click', () => {
      sel = { group: viewGroup, i }; applyPalette(); buildDrawer(); toast(name);
    });
    palList.appendChild(el);
  });
}

document.getElementById('btnFlip').addEventListener('click', () => { sim.flipFrame(); toast('Flipped'); });
document.getElementById('btnReset').addEventListener('click', () => { sim.initSand(); toast('Reset'); });
document.getElementById('btnCapture').addEventListener('click', () => { drawer.classList.remove('open'); capture(); });
document.getElementById('btnTest').addEventListener('click', () => {
  drawer.classList.remove('open');
  toast('Running self-tests…', 4000);
  setTimeout(() => {
    const { pass, total, results } = runSelfTests(N);
    console.group(`SandScape self-tests: ${pass}/${total} passed`);
    results.forEach(r => console[r.ok ? 'log' : 'error'](`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.note}`));
    console.groupEnd();
    toast(`Self-tests: ${pass}/${total} passed (details in console)`, 3200);
  }, 60);
});

document.getElementById('modeDevice').addEventListener('click', () => {
  if (!sensorAvailable) { toast('No motion sensor detected — tap Enable tilt (phone) or use Finger drag'); return; }
  tiltMode = 'device'; userChoseMode = true; updateModeUI(); toast('Device tilt');
});
document.getElementById('modeFinger').addEventListener('click', () => {
  tiltMode = 'finger'; userChoseMode = true; updateModeUI(); toast('Finger drag — sand pours toward the marker');
});

const shapeCircleBtn = document.getElementById('shapeCircle');
const shapeSquareBtn = document.getElementById('shapeSquare');
function updateShapeUI() {
  document.body.classList.toggle('square', shape === 'square');
  shapeCircleBtn.classList.toggle('on', shape === 'circle');
  shapeSquareBtn.classList.toggle('on', shape === 'square');
}
function setShape(next) {
  if (next === shape) return;
  shape = next;
  sim.setShape(shape);            // rebuilds walls + re-pours the sand
  store.set('sandscape.shape', shape);
  updateShapeUI();
  toast(shape === 'square' ? 'Square glass' : 'Circle glass');
}
shapeCircleBtn.addEventListener('click', () => setShape('circle'));
shapeSquareBtn.addEventListener('click', () => setShape('square'));

const speedRange = document.getElementById('speedRange');
const speedVal = document.getElementById('speedVal');
function updateSpeedUI() {
  speedRange.value = SPEED;
  speedVal.textContent = (SPEED % 1 === 0 ? SPEED : SPEED.toFixed(2).replace(/0$/, '')) + '×';
}
speedRange.addEventListener('input', () => {
  SPEED = parseFloat(speedRange.value);
  store.set('sandscape.speed', String(SPEED));
  updateSpeedUI();
});

/* ---------- capture: framed PNG snapshot ---------- */
function capture() {
  const out = document.createElement('canvas');
  const S = 1400, pad = 55, ring = 38;
  out.width = S; out.height = S;
  const c = out.getContext('2d');
  c.fillStyle = '#15120e'; c.fillRect(0, 0, S, S);
  c.save();
  if (shape === 'circle') {
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - pad, 0, Math.PI * 2); c.clip();
  } else {
    c.beginPath(); c.roundRect(pad, pad, S - pad * 2, S - pad * 2, S * 0.14); c.clip();
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(off, 0, 0, S, S);
  c.restore();
  c.strokeStyle = '#141210'; c.lineWidth = ring;
  if (shape === 'circle') {
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - pad, 0, Math.PI * 2); c.stroke();
  } else {
    c.beginPath(); c.roundRect(pad, pad, S - pad * 2, S - pad * 2, S * 0.14); c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,.78)'; c.font = '600 30px sans-serif';
  c.fillText('SandScape', 72, S - 54);
  const link = document.createElement('a');
  link.download = `SandScape-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
  toast('Scene saved');
}

/* ---------- gravity indicator ---------- */
const gravInd = document.getElementById('gravInd');
const gravDot = document.getElementById('gravDot');
function updateIndicator() {
  const dragging = tiltMode === 'finger' && pDown && pMoved;
  const show = dragging || (performance.now() - lastGChange < 1400);
  gravInd.style.opacity = show ? 1 : 0;
  if (show) {
    gravInd.style.transform = `rotate(${Math.atan2(sim.G.y, sim.G.x)}rad)`;
    gravDot.style.transform = `translate(${indR}px,0)`;
  }
}

/* ---------- main loop ---------- */
let lastVisible = true;
document.addEventListener('visibilitychange', () => { lastVisible = !document.hidden; });

let frameMsAvg = 0;
function loop() {
  requestAnimationFrame(loop);
  if (!lastVisible) return;
  const t0 = performance.now();
  sim.smoothGravity();
  const total = Math.min(sim.stepCap, sim.substeps * SPEED);
  const whole = total | 0;
  for (let s = 0; s < whole; s++) sim.step();
  if (sim.rnd() < total - whole) sim.step();
  updateIndicator();
  renderer.render(sim, px32);
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, cv.width, cv.height);
  if (debugHud) {
    frameMsAvg += (performance.now() - t0 - frameMsAvg) * 0.05;
    const s = (devicePixelRatio || 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10 * s, 10 * s, 150 * s, 26 * s);
    ctx.fillStyle = '#fff'; ctx.font = `${12 * s}px monospace`;
    ctx.fillText(`${N}×${N}  ${frameMsAvg.toFixed(1)}ms`, 16 * s, 28 * s);
  }
}

/* ---------- boot ---------- */
window.sandscape = { sim, renderer, runSelfTests };   // debugging + smoke-test hook
size();
applyPalette();
buildDrawer();
updateModeUI();
updateShapeUI();
updateSpeedUI();
setTimeout(() => { document.getElementById('hint').style.opacity = 0; }, 9000);
loop();

/* PWA: register the offline service worker (best-effort, never blocks the app) */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
