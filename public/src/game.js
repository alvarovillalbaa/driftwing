import { COURSES, getCourse, createFlight, stepFlight, sampleWind, terrainHeight } from './flight.js';
import { createRenderer } from './renderer.js';
import { createFlightAudio } from './audio.js';
import { loadSave, writeSave, keepRecord } from './records.js';

const byId = id => document.getElementById(id);
const canvas = byId('sky');
const deck = byId('flight-deck');
const audio = createFlightAudio();
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let { value: save, available: storageAvailable } = loadSave(storage, motionPreference.matches);
let course = getCourse(save.course);
let flight = createFlight(course.id);
let mode = 'menu';
let renderer;
let lastFrame = 0;
let lastHud = 0;
let lastEventId = 0;
let eventUntil = 0;
let previewTime = 0;
let runNumber = 0;
const keys = new Set();
const stick = { bank: 0, pitch: 0, pointer: null };
const courseButtons = new Map();
const formatTime = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;

function storageNotice() {
  byId('storage-notice').hidden = storageAvailable;
  byId('storage-notice').textContent = 'Your browser could not save game preferences or records. You can still play; this visit’s results may not be kept.';
}
function persist() { storageAvailable = writeSave(storage, save); storageNotice(); }
function clearInput() {
  keys.clear(); stick.bank = 0; stick.pitch = 0;
  if (stick.pointer !== null) {
    try { byId('stick-area').releasePointerCapture(stick.pointer); } catch { /* Capture may already be gone. */ }
  }
  stick.pointer = null; byId('stick-knob').style.transform = 'translate(0px, 0px)';
}
function announce(text, milliseconds = 2400) {
  byId('flight-event').textContent = text;
  byId('flight-event').classList.add('visible');
  eventUntil = performance.now() + milliseconds;
}
function showMode(next) {
  mode = next; document.body.dataset.mode = next;
  byId('menu-overlay').hidden = next !== 'menu';
  byId('pause-overlay').hidden = next !== 'paused';
  byId('result-overlay').hidden = next !== 'result';
  byId('flight-toolbar').hidden = next !== 'flying';
  byId('flight-hud').hidden = next === 'menu' || next === 'error';
  byId('touch-controls').hidden = next !== 'flying';
  byId('flight-warning').hidden = true;
  clearInput(); lastFrame = 0;
  audio.update(flight.airspeed, Math.hypot(flight.wind.x, flight.wind.y, flight.wind.z), next === 'flying');
}
function updateMenu() {
  courseButtons.forEach((button, id) => button.setAttribute('aria-pressed', String(id === course.id)));
  byId('course-position').textContent = `0${COURSES.findIndex(item => item.id === course.id) + 1} / 0${COURSES.length}`;
  byId('course-description').textContent = course.description;
  const best = save.records[course.id];
  byId('record-note').textContent = best ? `${storageAvailable ? 'Your best completed flight' : 'Your best this visit'}: ${best.score.toLocaleString()} points · ${formatTime(best.time)}` : 'No account. Just you and the air.';
  byId('course-tag').textContent = course.name;
}
function selectCourse(id) {
  course = getCourse(id); flight = createFlight(course.id); save.course = course.id; persist(); updateMenu(); lastHud = 0;
}
async function start(free = false) {
  runNumber++; flight = createFlight(course.id, free ? 'free' : 'course'); lastEventId = 0; eventUntil = 0;
  byId('flight-event').classList.remove('visible');
  byId('help-dialog').close(); showMode('flying'); canvas.focus({ preventScroll: true });
  deck.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  updateHud();
  if (save.sound) {
    const forRun = runNumber;
    const ok = await audio.setEnabled(true);
    if (!ok) { save.sound = false; updatePreferences(); persist(); announce('Sound could not start. You can still fly.'); }
    else if (forRun === runNumber) audio.update(flight.airspeed, Math.hypot(flight.wind.x, flight.wind.y, flight.wind.z), mode === 'flying');
  }
}
function pause(reason = 'Your flight is paused. The sky can wait.', focus = true) {
  if (mode !== 'flying') return;
  byId('pause-reason').textContent = reason; showMode('paused');
  if (focus && !document.hidden) byId('resume-button').focus({ preventScroll: true });
}
function resume() {
  if (mode !== 'paused' || document.hidden || byId('help-dialog').open) return;
  showMode('flying'); canvas.focus({ preventScroll: true });
}
function menu() {
  runNumber++; showMode('menu'); flight = createFlight(course.id); updateMenu();
  byId('flight-event').classList.remove('visible'); eventUntil = 0;
  byId('start-button').focus({ preventScroll: true });
}
function endFlight() {
  if (mode !== 'flying') return;
  const finished = flight.status === 'finished';
  if (finished) audio.chime('finish');
  const next = keepRecord(save, flight); save = next.value;
  if (next.improved) persist();
  byId('result-eyebrow').textContent = flight.mode === 'free' ? 'FREE-FLIGHT LOG' : 'FLIGHT LOG';
  byId('result-title').textContent = finished ? 'A flight to remember.' : 'Every flight teaches you.';
  byId('result-message').textContent = finished ? `You found your way through ${course.name}. There’s always another line to try.` : flight.lastEvent?.text || 'The flight ended. Try a gentler turn and watch your altitude.';
  byId('result-score').textContent = flight.score.toLocaleString();
  byId('result-gates').textContent = flight.mode === 'free' ? 'Free flight' : `${flight.passed} / ${course.gates.length}`;
  byId('result-time').textContent = formatTime(flight.time);
  byId('result-lift').textContent = `${Math.round(flight.updraftSeconds)}s`;
  byId('record-message').textContent = next.improved ? storageAvailable ? 'A new personal best. Saved on this device.' : 'A new personal best for this visit.' : flight.mode === 'free' ? 'Free-flight runs don’t replace course records.' : finished ? storageAvailable ? 'Your best completed course score stays on this device.' : 'Your best completed score is kept for this visit.' : 'Only completed courses become course records.';
  showMode('result'); byId('again-button').focus({ preventScroll: true }); updateMenu();
}
function writeNumber(id, value, unit) {
  const element = byId(id);
  element.firstChild.textContent = `${value} `;
  if (unit !== undefined) element.querySelector('small').textContent = unit;
}
function updateWind(state) {
  const wind = state.wind;
  byId('wind-label').textContent = wind.label;
  byId('wind-detail').textContent = `${Math.hypot(wind.x, wind.z).toFixed(1)} m/s horizontal · ${wind.y >= 0 ? '+' : '−'}${Math.abs(wind.y).toFixed(1)} m/s lift`;
  const angle = wind.x || wind.z ? Math.atan2(wind.x, wind.z) * 180 / Math.PI - 45 : -45;
  byId('wind-arrow').style.transform = `rotate(${angle}deg)`;
}
function updateHud() {
  const ground = terrainHeight(course, flight.x, flight.z);
  const warning = mode !== 'flying' ? '' : flight.y - ground < 16 ? 'Low altitude. Ease the nose up.'
    : Math.abs(flight.x) > course.bounds.halfWidth - 45 ? `Flying area edge. Bank ${flight.x > 0 ? 'left' : 'right'} gently.`
      : flight.y > course.bounds.ceiling - 28 ? 'Near the ceiling. Ease the nose down.' : '';
  byId('flight-warning').textContent = warning;
  byId('flight-warning').hidden = !warning;
  writeNumber('altitude', Math.max(0, Math.round(flight.y)), 'm');
  writeNumber('airspeed', Math.round(flight.airspeed), 'm/s');
  byId('clearance').textContent = `${Math.max(0, Math.round(flight.y - ground))} m above terrain`;
  byId('progress-label').textContent = flight.mode === 'free' ? 'DISTANCE' : 'GATES';
  writeNumber('gate-progress', flight.mode === 'free' ? (Math.max(0, flight.z - course.start.z) / 1000).toFixed(1) : flight.passed, flight.mode === 'free' ? 'km' : `/ ${course.gates.length}`);
  const next = course.gates[flight.gateIndex];
  byId('next-gate').textContent = flight.mode === 'free' ? 'Find your own line' : next ? `Next ring ${Math.max(0, Math.round(next.z - flight.z))} m` : 'Keep flying to the finish';
  byId('score').textContent = flight.score.toLocaleString(); byId('flight-time').textContent = `${formatTime(flight.time)} in the air`;
  updateWind(flight);
}
function updatePreferences() {
  byId('steady-camera').checked = save.steady;
  byId('sound-button').setAttribute('aria-pressed', String(save.sound));
  byId('sound-label').textContent = save.sound ? 'Sound on' : 'Sound off';
}
async function toggleSound() {
  const next = !save.sound;
  const ok = await audio.setEnabled(next);
  save.sound = next && ok; updatePreferences(); persist();
  audio.update(flight.airspeed, Math.hypot(flight.wind.x, flight.wind.y, flight.wind.z), mode === 'flying');
  if (!ok) announce('Sound is unavailable in this browser. You can still fly.');
}

for (const [index, item] of COURSES.entries()) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'course-option';
  const label = document.createElement('span'); label.textContent = `0${index + 1} · ${item.difficulty}`;
  const title = document.createElement('strong'); title.textContent = item.name;
  button.append(label, title); button.setAttribute('aria-label', `${item.name}: ${item.subtitle}`);
  button.addEventListener('click', () => selectCourse(item.id)); byId('course-options').append(button); courseButtons.set(item.id, button);
}
byId('start-button').addEventListener('click', () => void start());
byId('free-button').addEventListener('click', () => void start(true));
byId('pause-button').addEventListener('click', () => pause());
byId('resume-button').addEventListener('click', resume);
byId('restart-button').addEventListener('click', () => void start(flight.mode === 'free'));
byId('again-button').addEventListener('click', () => void start(flight.mode === 'free'));
byId('pause-menu-button').addEventListener('click', menu); byId('result-menu-button').addEventListener('click', menu);
byId('sound-button').addEventListener('click', () => void toggleSound());
byId('steady-camera').addEventListener('change', event => { save.steady = event.target.checked; persist(); });
byId('help-button').addEventListener('click', () => { pause('Flight paused while you read the guide.', false); byId('help-dialog').showModal(); });
byId('close-help').addEventListener('click', () => byId('help-dialog').close());
byId('guide-done').addEventListener('click', () => byId('help-dialog').close());
byId('reload-button').addEventListener('click', () => window.location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause('Flight paused while this tab was away.', false); clearInput(); audio.update(0, 0, false); } });
window.addEventListener('blur', () => { pause('Flight paused when the window lost focus.', false); clearInput(); });
window.addEventListener('pagehide', event => {
  pause('Flight paused while this page was away.', false); clearInput(); audio.update(0, 0, false);
  if (!event.persisted) { audio.destroy(); renderer?.destroy(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) { lastFrame = 0; resize(); } });

const flightKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
window.addEventListener('keydown', event => {
  if (byId('help-dialog').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
  if ((event.code === 'KeyP' || event.code === 'Escape') && (mode === 'flying' || mode === 'paused')) {
    event.preventDefault(); if (!event.repeat) { if (mode === 'flying') pause(); else resume(); } return;
  }
  if (mode !== 'flying') return;
  if (event.code === 'KeyR') { event.preventDefault(); if (!event.repeat) void start(flight.mode === 'free'); return; }
  if (flightKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); }
});
window.addEventListener('keyup', event => keys.delete(event.code));
const stickArea = byId('stick-area');
function moveStick(event) {
  const rect = stickArea.getBoundingClientRect(); const radius = rect.width * 0.34;
  let x = (event.clientX - rect.left - rect.width / 2) / radius;
  let y = (event.clientY - rect.top - rect.height / 2) / radius;
  const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
  stick.bank = x; stick.pitch = -y;
  byId('stick-knob').style.transform = `translate(${x * radius}px, ${y * radius}px)`;
}
stickArea.addEventListener('pointerdown', event => {
  if (mode !== 'flying' || stick.pointer !== null) return;
  event.preventDefault(); stick.pointer = event.pointerId; stickArea.setPointerCapture(event.pointerId); moveStick(event);
});
stickArea.addEventListener('pointermove', event => { if (event.pointerId === stick.pointer) { event.preventDefault(); moveStick(event); } });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stickArea.addEventListener(type, event => { if (event.pointerId === stick.pointer) clearInput(); });

function resize() {
  if (!renderer) return;
  const rect = canvas.getBoundingClientRect(); renderer.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
}
function fail(error) {
  showMode('error'); byId('error-overlay').hidden = false;
  byId('canvas-error').textContent = 'The flight view could not start. Reload the game, or try another browser with Canvas support.';
  console.error('Driftwing flight view failed:', error instanceof Error ? error.message : 'Unknown rendering error');
}
function frame(timestamp) {
  if (!renderer || mode === 'error') return;
  const dt = lastFrame ? Math.min(0.1, Math.max(0, (timestamp - lastFrame) / 1000)) : 0;
  lastFrame = timestamp;
  try {
    if (mode === 'flying') {
      const bank = stick.pointer !== null ? stick.bank : Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      const pitch = stick.pointer !== null ? stick.pitch : Number(keys.has('ArrowUp') || keys.has('KeyW')) - Number(keys.has('ArrowDown') || keys.has('KeyS'));
      flight = stepFlight(flight, { bank, pitch }, dt);
      if (flight.lastEvent && flight.lastEvent.id !== lastEventId) {
        lastEventId = flight.lastEvent.id; announce(flight.lastEvent.text);
        if (flight.lastEvent.type === 'pass') audio.chime('pass');
      }
      audio.update(flight.airspeed, Math.hypot(flight.wind.x, flight.wind.y, flight.wind.z), true);
      if (flight.status !== 'flying') endFlight();
    }
    if (mode === 'menu') {
      if (!save.steady && !document.hidden) previewTime += dt;
      const preview = { ...flight, time: previewTime, wind: sampleWind(course, flight.x, flight.y, flight.z, previewTime) };
      renderer.render(preview, course, { steadyCamera: save.steady, preview: true });
      if (timestamp - lastHud > 100) updateWind(preview);
    } else renderer.render(flight, course, { steadyCamera: save.steady });
    if (timestamp - lastHud > 100) { if (mode !== 'menu') updateHud(); lastHud = timestamp; }
    if (eventUntil && timestamp > eventUntil) { byId('flight-event').classList.remove('visible'); eventUntil = 0; }
    requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
updatePreferences(); updateMenu(); storageNotice(); showMode('menu');
try {
  renderer = createRenderer(canvas); resize();
  new ResizeObserver(resize).observe(deck);
  window.addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(frame);
} catch (error) { fail(error); }
