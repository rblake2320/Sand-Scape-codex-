/* SandScape app shell — DOM, sensors, pointer, drawer UI, capture, PWA.
   All simulation logic lives in engine.js; all pixel work in render.js. */

import { SandEngine } from './engine.js';
import { SandRenderer } from './render.js';
import { GROUPS, DIRECT, TEAMS, resolvePalette, paletteName, paletteCount } from './palettes.js';
import { runSelfTests } from './selftests.js';
import { SimulationClock } from './sim-clock.js';

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
let sculpture = null;
let use3D = false;
let orbitMode = false;
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
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- canvas ---------- */
const cv = document.getElementById('sim');
const ctx = cv.getContext('2d', { alpha: false });
const off = document.createElement('canvas'); off.width = N; off.height = N;
const octx = off.getContext('2d', { alpha: false });
const img = octx.createImageData(N, N);
const px32 = new Uint32Array(img.data.buffer);

let indR = 0;
function size() {
  const available = document.querySelector('.exhibit').clientWidth;
  const S = Math.max(180, Math.min(available * 0.86, innerWidth > 800 ? innerHeight * 0.55 : innerWidth * 0.78, 580));
  document.documentElement.style.setProperty('--S', S + 'px');
  indR = S * 0.5 - 14;
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
  if (sculpture) { const wrap = document.getElementById('sculptureWrap'); if (wrap.clientWidth) sculpture.resize(wrap.clientWidth, wrap.clientHeight); }
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
  sculpture?.setPalette(resolvePalette(sel.group, sel.i));
  store.set('sandscape.palette', JSON.stringify(sel));
  document.getElementById('sceneName').textContent = paletteName(sel.group, sel.i);
  document.querySelectorAll('.atmosphere').forEach((b, i) => b.setAttribute('aria-pressed', String(sel.group === 'Exotic' && sel.i === i)));
}

function flipFrame() { sim.flipFrame(); sculpture?.flip(); }

/* ---------- sensors ---------- */
const tiltBtn = document.getElementById('tiltBtn');
let tiltMode = 'finger';          // 'finger' | 'device'
let userChoseMode = false;
let sensorAvailable = false;
let fingerHintShown = false;
let lastGChange = -Infinity;

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
  sim.redistributeAir();
  toast('Air bubbles redistributed');
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
let drawerReturnFocus;
function setDrawer(open) {
  drawer.classList.toggle('open', open);
  drawer.inert = !open;
  if (open) { drawerReturnFocus = document.activeElement; document.getElementById('closeDrawer').focus(); }
  else drawerReturnFocus?.focus();
}

let pDown = null, pMoved = false, lpTimer = null;

function pointerStart(e) {
  pDown = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, t: performance.now(), sculpt: e.currentTarget.id === 'sculpture' };
  e.currentTarget.setPointerCapture?.(e.pointerId);
  pMoved = false;
  lpTimer = setTimeout(() => { if (!pMoved) { setDrawer(true); pDown = null; } }, 550);
}
cv.parentElement.addEventListener('pointerdown', pointerStart);
document.getElementById('sculpture').addEventListener('pointerdown', pointerStart);
addEventListener('pointercancel', () => { clearTimeout(lpTimer); pDown = null; });
addEventListener('pointermove', e => {
  if (!pDown) return;
  const dx = e.clientX - pDown.x, dy = e.clientY - pDown.y;
  if (pDown.sculpt && orbitMode) { pMoved = true; clearTimeout(lpTimer); sculpture.orbit(e.clientX-pDown.lastX, e.clientY-pDown.lastY); pDown.lastX=e.clientX;pDown.lastY=e.clientY;return; }
  if (Math.hypot(dx, dy) > 12) {
    pMoved = true; clearTimeout(lpTimer);
    if (tiltMode === 'finger') {                 // finger steering: drag = gravity
      const r = (pDown?.sculpt ? document.getElementById('sculpture') : cv).getBoundingClientRect();
      noteGravityChange(sim.setTargetGravity(
        e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)));
      if (!fingerHintShown) { fingerHintShown = true; toast('Sand pours toward the glowing marker'); }
    }
  }
});
addEventListener('pointerup', e => {
  clearTimeout(lpTimer);
  if (pDown && !pMoved && performance.now() - pDown.t < 400) {
    const r = (pDown?.sculpt ? document.getElementById('sculpture') : cv).getBoundingClientRect();
    const gx = Math.round((e.clientX - r.left) / r.width * N);
    const gy = Math.round((e.clientY - r.top) / r.height * N);
    const hit = pDown.sculpt ? sculpture.pick((e.clientX-r.left)/r.width*2-1, 1-(e.clientY-r.top)/r.height*2) : {x:gx,y:gy};
    if (hit && !(pDown.sculpt && orbitMode)) sim.disturb(hit.x, hit.y);
  }
  pDown = null;
});
document.addEventListener('pointerdown', e => {
  if (drawer.classList.contains('open') && !drawer.contains(e.target)) setDrawer(false);
}, true);

/* ---------- keyboard (desktop) ---------- */
addEventListener('keydown', e => {
  if (e.key === 'Escape') { setDrawer(false); return; }
  if (e.target.closest('input,textarea,select,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (map[e.key]) { e.preventDefault(); noteGravityChange(sim.setTargetGravity(...map[e.key])); return; }
  const k = e.key.toLowerCase();
  if (k === 'f') { flipFrame(); toast('Flipped'); }
  if (k === 'r') { sim.initSand(); toast('Reset'); }
  if (k === 'p') setDrawer(!drawer.classList.contains('open'));
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

document.getElementById('btnFlip').addEventListener('click', () => { flipFrame(); toast('Flipped'); });
document.getElementById('btnReset').addEventListener('click', () => { sim.initSand(); toast('Reset'); });
document.getElementById('btnCapture').addEventListener('click', () => { setDrawer(false); capture(); });
document.getElementById('btnTest').addEventListener('click', () => {
  setDrawer(false);
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
  sim.setShape(shape);
  sculpture?.setShape(shape);            // rebuilds walls + re-pours the sand
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
  document.getElementById('studioSpeed').value = SPEED;
  document.getElementById('studioSpeedVal').textContent = SPEED + '×';
  speedVal.textContent = (SPEED % 1 === 0 ? SPEED : SPEED.toFixed(2).replace(/0$/, '')) + '×';
}
speedRange.addEventListener('input', () => {
  SPEED = parseFloat(speedRange.value);
  store.set('sandscape.speed', String(SPEED));
  updateSpeedUI();
});

/* ---------- capture: framed PNG snapshot ---------- */
function capture() {
  if (use3D && sculpture?.ready) {
    sculpture.render(sim, px32, paused);
    const a = document.createElement('a'); a.download = `SandScape-sculpture-${Date.now()}.png`;
    a.href = document.getElementById('sculpture').toDataURL('image/png'); a.click(); toast('Sculpture saved'); return;
  }
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
const simulationClock = new SimulationClock();
function loop(now = performance.now()) {
  requestAnimationFrame(loop);
  if (!lastVisible) { simulationClock.advance(now, true, () => {}); return; }
  const t0 = performance.now();
  simulationClock.advance(now, paused, () => {
  sim.smoothGravity();
  const total = Math.min(sim.stepCap, sim.substeps * SPEED);
  const whole = total | 0;
  for (let s = 0; s < whole; s++) sim.step();
  if (sim.rnd() < total - whole) sim.step();
  });
  updateIndicator();
  const renderFrame = renderer.frameNo;
  renderer.render(sim, px32);
  if (paused) renderer.frameNo = renderFrame;
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, cv.width, cv.height);
  if (use3D && sculpture?.ready) sculpture.render(sim, px32, paused);
  if (debugHud) {
    frameMsAvg += (performance.now() - t0 - frameMsAvg) * 0.05;
    const s = (devicePixelRatio || 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10 * s, 10 * s, 150 * s, 26 * s);
    ctx.fillStyle = '#fff'; ctx.font = `${12 * s}px monospace`;
    ctx.fillText(`${N}×${N}  ${frameMsAvg.toFixed(1)}ms`, 16 * s, 28 * s);
  }
}

/* ---------- visible studio controls + optional local scene director ---------- */
const pauseBtn = document.getElementById('pauseBtn');
function syncPause() {
  pauseBtn.innerHTML = paused ? '▷ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
  pauseBtn.setAttribute('aria-pressed', String(paused));
}
pauseBtn.addEventListener('click', () => { paused = !paused; syncPause(); });
syncPause();
document.getElementById('quickFlip').addEventListener('click', () => { flipFrame(); toast('Flipped'); });
document.getElementById('quickCapture').addEventListener('click', capture);
document.getElementById('airRange').addEventListener('input', e => { sim.setAirResistance(Number(e.target.value)); });
document.getElementById('shakeAir').addEventListener('click', () => { sim.redistributeAir(); toast('Air-bubble gaps redistributed'); });
document.getElementById('quickReset').addEventListener('click', () => { sim.initSand(); toast('A fresh landscape'); });
document.getElementById('allPalettes').addEventListener('click', () => setDrawer(true));
document.getElementById('closeDrawer').addEventListener('click', () => setDrawer(false));
document.getElementById('studioSpeed').addEventListener('input', e => {
  SPEED = Number(e.target.value); store.set('sandscape.speed', String(SPEED)); updateSpeedUI();
});
DIRECT.Exotic.forEach((p, i) => {
  const b = document.createElement('button'); b.className = 'atmosphere';
  b.title = p.name; b.setAttribute('aria-label', p.name); b.setAttribute('aria-pressed', 'false');
  b.style.background = `linear-gradient(155deg, ${p.liquid[0]} 25%, ${p.sand[4]} 26%, ${p.sand[3]} 47%, ${p.sand[1]} 48%, ${p.sand[0]} 80%)`;
  b.addEventListener('click', () => { sel = { group: 'Exotic', i }; applyPalette(); buildDrawer(); });
  document.getElementById('quickPalettes').appendChild(b);
});
const modelStatus = document.getElementById('modelStatus');
const suggestBtn = document.getElementById('suggestBtn');
const suggestion = document.getElementById('suggestion');
const directorError = document.getElementById('directorError');
let candidate = null;
async function checkModel() {
  if (!window.SANDSCAPE_LOCAL_LAYA) { modelStatus.textContent = 'Manual studio · start local server for Laya'; return; }
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    modelStatus.textContent = data.status === 'ready' ? 'Laya · on this computer' : data.status === 'loading' ? 'Laya is warming up · retry shortly' : 'Laya unavailable · manual studio ready';
  } catch { modelStatus.textContent = 'Manual studio · start local server for Laya'; }
}
document.getElementById('retryModel').addEventListener('click', checkModel);
document.getElementById('directorForm').addEventListener('submit', async e => {
  e.preventDefault();
  const prompt = document.getElementById('scenePrompt').value.trim();
  suggestion.hidden = true; candidate = null; directorError.hidden = true;
  if (!window.SANDSCAPE_LOCAL_LAYA) { directorError.textContent = 'Start the local Laya server to use scene suggestions. The manual controls are ready.'; directorError.hidden = false; return; }
  if (prompt.length < 3) { directorError.textContent = 'Describe a scene in at least three characters.'; directorError.hidden = false; return; }
  suggestBtn.disabled = true; suggestBtn.textContent = 'Finding your atmosphere…';
  try {
    const response = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(45000) });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Start the local Laya server to use scene suggestions. The manual controls are ready.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Laya could not suggest a scene.');
    const c = data.settings;
    if (data.provider !== 'laya' || c?.group !== 'Exotic' || !Number.isInteger(c.i) || c.i < 0 || c.i >= DIRECT.Exotic.length || ![0.5, 1, 2].includes(c.speed)) throw new Error('Laya returned invalid settings. Please choose a palette manually.');
    candidate = c;
    document.getElementById('suggestionText').textContent = `${paletteName(c.group, c.i)} · ${c.speed}× flow`;
    suggestion.hidden = false; modelStatus.textContent = 'Laya · suggestion ready on this computer';
  } catch (err) { directorError.textContent = err.name === 'TimeoutError' ? 'Laya took too long. Try again shortly or choose a palette below.' : err instanceof TypeError ? 'Cannot reach local Laya. Retry shortly or choose a palette below.' : err.message; directorError.hidden = false; }
  finally { suggestBtn.disabled = false; suggestBtn.innerHTML = 'Find my atmosphere <span>↗</span>'; }
});
document.getElementById('applySuggestion').addEventListener('click', () => {
  if (!candidate) return;
  sel = { group: candidate.group, i: candidate.i }; SPEED = candidate.speed;
  store.set('sandscape.speed', String(SPEED)); applyPalette(); buildDrawer(); updateSpeedUI();
  suggestion.hidden = true; candidate = null; toast('Atmosphere applied');
});
checkModel();

/* Record the actual simulation; no generation service or paid model. */
const recordBtn = document.getElementById('recordBtn');
let recording = null;
let recordingTimer;
recordBtn.addEventListener('click', () => {
  if (recording) { recording.stop(); return; }
  const captureCanvas = use3D ? document.getElementById('sculpture') : cv;
  if (!captureCanvas.captureStream || typeof MediaRecorder === 'undefined') { toast('Video recording is unavailable in this browser. Save a PNG instead.', 3500); return; }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
  if (!mime) { toast('No supported video format. Save a PNG instead.'); return; }
  const stream = captureCanvas.captureStream(30);
  const chunks = [];
  try {
    recording = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    recording.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recording.onstop = () => {
      clearTimeout(recordingTimer); stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: mime });
      if (blob.size) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `SandScape-${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast('Clip saved');
      } else toast('Recording produced no video. Please try again.');
      recording = null; recordBtn.innerHTML = '○ <span>Record clip</span>';
    };
    recording.onerror = () => { toast('Recording failed. Please try again.'); if (recording?.state !== 'inactive') recording.stop(); };
    recording.start(); recordBtn.innerHTML = '■ <span>Stop recording</span>';
    recordingTimer = setTimeout(() => { if (recording?.state === 'recording') recording.stop(); }, 30000);
    toast('Recording the canvas · up to 30 seconds', 3000);
  } catch {
    stream.getTracks().forEach(track => track.stop()); recording = null;
    toast('Could not start recording. Save a PNG instead.');
  }
});

/* ---------- boot ---------- */
window.sandscape = { sim, renderer, runSelfTests, getVisualState: () => ({ use3D, orbitMode, ...sculpture?.stats() }), getSettings: () => ({ ...sel, speed: SPEED, paused, shape }) };   // debugging + smoke-test hook
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
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}); });
}

/* Load 3D progressively: the original renderer stays usable on non-WebGL devices. */
const sculptureWrap = document.getElementById('sculptureWrap');
const visualStatus = document.getElementById('visualStatus');
function show3D(enabled) {
  use3D = enabled && !!sculpture?.ready;
  sculptureWrap.hidden = !use3D; document.getElementById('stage').hidden = use3D;
  document.getElementById('classicMode').setAttribute('aria-pressed', String(!use3D));
  document.getElementById('classicMode').textContent = use3D ? '2D view' : '3D view';
  document.getElementById('orbitMode').disabled = !use3D;
  visualStatus.textContent = use3D ? 'SCULPTURE / LIVE SAND' : 'CLASSIC / LIVE SAND'; size();
}
document.getElementById('classicMode').addEventListener('click', () => show3D(!use3D));
document.getElementById('orbitMode').addEventListener('click', e => { orbitMode=!orbitMode; e.currentTarget.setAttribute('aria-pressed',String(orbitMode)); e.currentTarget.textContent=orbitMode?'Tilt sand':'Orbit view'; toast(orbitMode?'Drag to look around. Sand gravity stays unchanged.':'Drag to tilt the sand picture.'); });
document.querySelectorAll('[data-finish]').forEach(button => button.addEventListener('click', () => {
  sculpture?.setFinish(button.dataset.finish);
  document.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
(async () => {
  try {
    const { Sculpture } = await import('./sculpture.js');
    const canvas = document.getElementById('sculpture');
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!context) throw new Error('WebGL2 is unavailable');
    sculpture = new Sculpture(canvas, N, context);
    await sculpture.load(); sculpture.setShape(shape); sculpture.setPalette(resolvePalette(sel.group,sel.i)); show3D(true);
  } catch (err) {
    sculpture?.dispose(); sculpture=null;show3D(false);
    visualStatus.textContent='CLASSIC VIEW / 3D UNAVAILABLE';
    document.getElementById('classicMode').disabled=true;
    console.warn('3D renderer unavailable:',err.message);
  }
})();
