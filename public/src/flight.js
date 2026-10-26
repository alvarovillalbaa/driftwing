// Assisted arcade flight: predictable controls and visible wind response, not
// an aircraft model. All course rules and terrain live here, outside the DOM.
const STEP = 1 / 120;
const MAX_FRAME = 0.1;
const CLEARANCE = 3;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bounded = (value) => clamp(finite(value), -10_000_000, 10_000_000);
const smooth = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}

export const COURSES = freeze([
  {
    id: 'coast', name: 'Coast', subtitle: 'Find the rising air', difficulty: 'Beginner',
    description: 'A forgiving coastal route. Gentle columns of warm air lift the glider between broad rings.',
    colors: { sky: '#A9D3DE', horizon: '#F2DBB3', sea: '#4A9FA9', land: '#8A9D71', accent: '#F1AC67' },
    start: { x: 0, y: 78, z: 0 },
    gates: [
      { x: 8, y: 76, z: 180, radius: 26 },
      { x: 22, y: 74, z: 360, radius: 25 },
      { x: 35, y: 78, z: 550, radius: 26 },
      { x: 24, y: 82, z: 750, radius: 25 },
      { x: 6, y: 80, z: 950, radius: 27 },
      { x: 18, y: 77, z: 1160, radius: 27 },
      { x: 32, y: 75, z: 1380, radius: 28 },
    ],
    thermals: [
      { x: 32, z: 540, radius: 100, strength: 3.3, base: 0, top: 170 },
      { x: 4, z: 990, radius: 110, strength: 3.8, base: 0, top: 180 },
    ],
    wind: { x: 0, z: 0, gust: 0 }, bounds: { halfWidth: 230, ceiling: 220 }, limitSeconds: 120,
  },
  {
    id: 'ridge', name: 'Ridge', subtitle: 'Lean into the crosswind', difficulty: 'Easy',
    description: 'Bank gently against the breeze and follow a broad valley above the rolling ridge.',
    colors: { sky: '#BCCDDD', horizon: '#F4D8B0', sea: '#7CABA9', land: '#7A8B68', accent: '#E5A16B' },
    start: { x: -12, y: 112, z: 0 },
    gates: [
      { x: -20, y: 108, z: 200, radius: 27 },
      { x: -32, y: 112, z: 390, radius: 26 },
      { x: -18, y: 120, z: 590, radius: 26 },
      { x: 6, y: 118, z: 790, radius: 26 },
      { x: 20, y: 112, z: 990, radius: 27 },
      { x: 0, y: 108, z: 1200, radius: 28 },
      { x: -18, y: 110, z: 1430, radius: 29 },
    ],
    thermals: [
      { x: -30, z: 460, radius: 120, strength: 4.1, base: 25, top: 225 },
      { x: 14, z: 1100, radius: 110, strength: 4.5, base: 25, top: 235 },
    ],
    wind: { x: -2.6, z: -1.2, gust: 1.6 }, bounds: { halfWidth: 260, ceiling: 260 }, limitSeconds: 130,
  },
  {
    id: 'cloudline', name: 'Cloudline', subtitle: 'Ride the changing breeze', difficulty: 'Easy+',
    description: 'A higher, roomy course with changing crosswinds and longer stretches of rising air.',
    colors: { sky: '#B8CBE1', horizon: '#F0DFD3', sea: '#719CA9', land: '#8F9C88', accent: '#D99A84' },
    start: { x: 0, y: 145, z: 0 },
    gates: [
      { x: 10, y: 142, z: 220, radius: 29 },
      { x: 30, y: 148, z: 430, radius: 28 },
      { x: 44, y: 157, z: 650, radius: 28 },
      { x: 24, y: 166, z: 870, radius: 29 },
      { x: 0, y: 160, z: 1100, radius: 29 },
      { x: -18, y: 150, z: 1340, radius: 30 },
      { x: 8, y: 146, z: 1580, radius: 31 },
    ],
    thermals: [
      { x: 28, z: 580, radius: 140, strength: 5.2, base: 25, top: 285 },
      { x: -8, z: 1120, radius: 150, strength: 4.2, base: 25, top: 295 },
    ],
    wind: { x: 3.2, z: 0.5, gust: 2 }, bounds: { halfWidth: 280, ceiling: 310 }, limitSeconds: 140,
  },
]);

export function getCourse(id) {
  return COURSES.find(course => course.id === String(id).toLowerCase()) || COURSES[0];
}

export function terrainHeight(course, x, z) {
  const selected = course && typeof course === 'object' ? course : getCourse(course);
  x = bounded(x); z = bounded(z);
  if (selected.id === 'ridge') {
    const ridge = Math.exp(-(((x + 95 + 18 * Math.sin(z * 0.003)) / 75) ** 2));
    return 24 + 8 * (1 + Math.sin(z * 0.005)) + 27 * ridge;
  }
  if (selected.id === 'cloudline') {
    return 12 + 12 * (0.5 + 0.5 * Math.sin(z * 0.004))
      + 8 * (0.5 + 0.5 * Math.sin(x * 0.014 + z * 0.002));
  }
  return smooth(55, 145, x) * (9 + 4 * Math.sin(z * 0.008) + 3 * Math.sin(x * 0.02 + z * 0.003));
}

export function sampleWind(course, x, y, z, time) {
  const selected = course && typeof course === 'object' ? course : getCourse(course);
  x = bounded(x); y = bounded(y); z = bounded(z); time = bounded(time);
  const gust = clamp(finite(selected.wind?.gust), 0, 8);
  const wx = clamp(finite(selected.wind?.x), -12, 12)
    + gust * (Math.sin(time * 0.45 + z * 0.002) + 0.35 * Math.sin(time * 1.3 + x * 0.012));
  const wz = clamp(finite(selected.wind?.z), -8, 8) + gust * 0.35 * Math.sin(time * 0.37 + z * 0.004);
  let wy = 0;
  for (const thermal of selected.thermals || []) {
    const radius = finite(thermal.radius);
    const base = finite(thermal.base); const top = finite(thermal.top);
    if (radius <= 0 || top <= base || y < base || y > top) continue;
    const distanceSquared = (x - finite(thermal.x)) ** 2 + (z - finite(thermal.z)) ** 2;
    const core = Math.max(0, 1 - distanceSquared / (radius * radius));
    const taper = Math.min(18, (top - base) / 3);
    const vertical = smooth(base, base + taper, y) * (1 - smooth(top - taper, top, y));
    wy += core * core * vertical * clamp(finite(thermal.strength), 0, 10);
  }
  wy = clamp(wy, 0, 12);
  const label = wy > 0.5 ? `Rising air +${wy.toFixed(1)} m/s`
    : Math.abs(wx) > 0.5 ? `Crosswind ${wx > 0 ? 'right' : 'left'}`
      : wz > 0.5 ? 'Tailwind' : wz < -0.5 ? 'Headwind' : 'Calm air';
  return { x: wx, y: wy, z: wz, label };
}

export function createFlight(courseId, mode = 'course') {
  const course = getCourse(courseId);
  const wind = sampleWind(course, course.start.x, course.start.y, course.start.z, 0);
  return {
    courseId: course.id, mode: mode === 'free' ? 'free' : 'course', status: 'flying',
    ...course.start, vx: wind.x, vy: -0.55 + wind.y, vz: 34 + wind.z,
    roll: 0, pitch: 0, airspeed: 34, time: 0,
    score: 0, gateIndex: 0, passed: 0, missed: 0, streak: 0, bestStreak: 0, updraftSeconds: 0,
    wind, lastEvent: null, _remainder: 0, _eventId: 0,
  };
}

function event(state, type, text) {
  state._eventId = finite(state._eventId) + 1;
  state.lastEvent = { id: state._eventId, type, text };
}

function crash(state, text) {
  state.status = 'crashed';
  event(state, 'crash', text);
}

function integrate(state, course, bank, pitch) {
  const before = { x: state.x, y: state.y, z: state.z };
  const wind = sampleWind(course, state.x, state.y, state.z, state.time);
  state.roll += (bank * 0.85 - state.roll) * (1 - Math.exp(-4.5 * STEP));
  state.pitch += (pitch * 0.32 - state.pitch) * (1 - Math.exp(-3.8 * STEP));
  const trim = clamp(34 - state.pitch * 13 - Math.abs(state.roll) * 1.8, 23, 43);
  state.airspeed = clamp(state.airspeed + (trim - state.airspeed) * (1 - Math.exp(-0.65 * STEP)), 21, 48);
  const targetX = state.airspeed * Math.sin(state.roll) * 0.36 + wind.x;
  const targetY = state.airspeed * Math.sin(state.pitch) - 0.55 + wind.y;
  const targetZ = state.airspeed * Math.cos(state.pitch) * (1 - 0.08 * Math.abs(Math.sin(state.roll))) + wind.z;
  state.vx += (targetX - state.vx) * (1 - Math.exp(-1.6 * STEP));
  state.vy += (targetY - state.vy) * (1 - Math.exp(-0.95 * STEP));
  state.vz += (targetZ - state.vz) * (1 - Math.exp(-0.9 * STEP));
  state.x += state.vx * STEP; state.y += state.vy * STEP; state.z += state.vz * STEP;
  state.time += STEP;
  if (wind.y > 0.5) state.updraftSeconds += STEP;
  state.wind = sampleWind(course, state.x, state.y, state.z, state.time);

  if (state.y <= terrainHeight(course, state.x, state.z) + CLEARANCE) {
    crash(state, 'Ground contact. Keep a little more height next time.'); return;
  }
  if (Math.abs(state.x) >= course.bounds.halfWidth) {
    crash(state, 'Beyond the flying area. Try a gentler bank.'); return;
  }
  if (state.y >= course.bounds.ceiling) {
    crash(state, 'Above the flying area. Ease the nose down next time.'); return;
  }
  if (state.mode === 'free') return;

  while (state.gateIndex < course.gates.length && state.z >= course.gates[state.gateIndex].z) {
    const gate = course.gates[state.gateIndex];
    const crossed = before.z < gate.z;
    const fraction = crossed ? clamp((gate.z - before.z) / (state.z - before.z), 0, 1) : 0;
    const x = before.x + (state.x - before.x) * fraction;
    const y = before.y + (state.y - before.y) * fraction;
    const distance = Math.hypot(x - gate.x, y - gate.y);
    state.gateIndex++;
    if (crossed && distance <= gate.radius) {
      state.passed++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.score += 100 + Math.round(50 * (1 - distance / gate.radius)) + Math.min(state.streak, 5) * 10;
      event(state, 'pass', `Gate ${state.gateIndex} cleared · ${state.streak} in a row`);
    } else {
      state.missed++; state.streak = 0;
      event(state, 'miss', `Gate ${state.gateIndex} missed. Keep flying to the next ring.`);
    }
  }
  const finishZ = course.gates[course.gates.length - 1].z + 90;
  if (state.gateIndex === course.gates.length && state.z >= finishZ) {
    state.status = 'finished'; state.score += 200 + state.bestStreak * 20;
    event(state, 'finish', `${course.name} complete · ${state.passed} of ${course.gates.length} gates`);
  } else if (state.time >= course.limitSeconds) {
    crash(state, 'Time is up. Restart for another flight.');
  }
}

export function stepFlight(state, controls = {}, dt = 0) {
  if (state.status !== 'flying') return state;
  const elapsed = clamp(finite(dt), 0, MAX_FRAME);
  if (!elapsed) return state;
  const course = getCourse(state.courseId);
  const next = { ...state, wind: { ...state.wind } };
  const bank = clamp(finite(controls?.bank), -1, 1);
  const pitch = clamp(finite(controls?.pitch), -1, 1);
  let remaining = clamp(finite(state._remainder), 0, STEP) + elapsed;
  // A carried fixed-step remainder keeps equal input histories independent of
  // ordinary render-frame partitioning. Excess elapsed time is intentionally dropped.
  while (remaining + 1e-12 >= STEP && next.status === 'flying') {
    integrate(next, course, bank, pitch);
    remaining -= STEP;
  }
  next._remainder = next.status === 'flying' ? Math.max(0, remaining) : 0;
  return next;
}
