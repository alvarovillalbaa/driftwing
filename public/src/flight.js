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

export const MAPS = freeze([
  { id: 'coast', name: 'Coast', sky: '#A9D3DE', horizon: '#F2DBB3', land: '#8A9D71', altitude: 112 },
  { id: 'ridge', name: 'High Ridge', sky: '#BCCDDD', horizon: '#F4D8B0', land: '#7A8B68', altitude: 140 },
  { id: 'cloudline', name: 'Cloudline', sky: '#B8CBE1', horizon: '#F0DFD3', land: '#8F9C88', altitude: 155 },
  { id: 'canyon', name: 'Red Canyon', sky: '#B9CED7', horizon: '#EFC2A0', land: '#B67B60', altitude: 140 },
  { id: 'islands', name: 'Emerald Isles', sky: '#9BD5D5', horizon: '#DFEBC5', land: '#659B77', altitude: 112 },
  { id: 'aurora', name: 'Afterglow', sky: '#A7ADC9', horizon: '#E4BFCF', land: '#777C99', altitude: 155 },
]);
const generated = new Map();
function random(index, seed) {
  let hash = Math.imul((index | 0) ^ seed, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
export function levelId(map, seed, level) {
  return MAPS.some(item => item.id === map) && Number.isInteger(seed) && seed >= 1 && seed <= 0xffffffff
    && Number.isInteger(level) && level >= 1 && level <= 50 ? `v2-${map}-${seed}-${level}` : null;
}
export function parseLevel(id) {
  const match = typeof id === 'string' && /^v2-([a-z]+)-(\d{1,10})-(\d{1,2})$/.exec(id);
  return match && levelId(match[1], Number(match[2]), Number(match[3])) === id
    ? { map: match[1], seed: Number(match[2]), level: Number(match[3]) } : null;
}
function generateCourse(map, seed, level, id) {
  const biome = MAPS.find(item => item.id === map), difficulty = (level - 1) / 49;
  const phase = random(seed, 71 + MAPS.findIndex(item => item.id === map) * 37) * Math.PI * 2;
  const spacing = 205 - difficulty * 45, count = 8 + Math.floor(difficulty * 8);
  const gates = Array.from({ length: count }, (_, index) => {
    const z = 250 + index * spacing;
    return { x: Math.sin(z / 250 + phase) * (25 + difficulty * 10),
      y: biome.altitude + Math.sin(z / 310 + phase) * 14, z, radius: 25 - difficulty * 10 };
  });
  const line = z => {
    const next = gates.find(gate => gate.z >= z);
    if (!next) return gates.at(-1).x;
    const previous = gates[gates.indexOf(next) - 1] || { x: 0, z: 0 };
    return previous.x + (next.x - previous.x) * (z - previous.z) / (next.z - previous.z);
  };
  const course = { id, map, seed, level, phase, name: biome.name, subtitle: 'A new sky every seed', difficulty: `Level ${level}`,
    colors: { sky: biome.sky, horizon: biome.horizon, sea: '#4A9FA9', land: biome.land, accent: '#F1AC67' },
    start: { x: 0, y: biome.altitude, z: 0 }, startSpeed: 48 + difficulty * 22,
    gates, thermals: [], obstacles: [], wind: { x: map === 'ridge' ? -2.6 : 1.2, z: -0.5, gust: 2 + difficulty * 3.5 },
    bounds: { halfWidth: map === 'canyon' ? 190 : 240, ceiling: biome.altitude + 150 }, limitSeconds: 120 };
  const density = 3 + Math.floor(difficulty * 3);
  for (let chunk = 1; chunk * 150 < gates.at(-1).z - 65; chunk++) {
    for (let index = 0; index < density; index++) {
      const z = chunk * 150 + random(chunk * 13 + index, seed) * 55;
      const radius = 5 + random(chunk * 17 + index, seed + 1) * 4;
      let x = (random(chunk * 19 + index, seed + 2) - 0.5) * course.bounds.halfWidth * 1.6;
      const clearance = 28 + radius;
      if (Math.abs(x - line(z)) < clearance) x = line(z) + (x < line(z) ? -1 : 1) * clearance;
      course.obstacles.push({ id: `${id}-spire-${chunk}-${index}`, x, z, radius,
        base: terrainHeight(course, x, z), height: biome.altitude + 15 + random(chunk, seed + index) * 60 });
    }
  }
  for (let index = 1; index < gates.length; index += 2) {
    const gate = gates[index];
    course.thermals.push({ x: gate.x + 22, z: gate.z - 55, radius: 110, strength: 3.5 + difficulty * 2.5, base: 0, top: course.bounds.ceiling });
  }
  course.description = `${count} rings · ${course.obstacles.length} rock spires · ${(course.startSpeed).toFixed(0)} m/s launch · changing gusts`;
  return freeze(course);
}
export const COURSES = freeze(MAPS.map((map, index) => generateCourse(map.id, index + 1, 1, map.id)));
export function getCourse(id) {
  const base = COURSES.find(course => course.id === String(id).toLowerCase());
  if (base) return base;
  const parts = parseLevel(id);
  if (!parts) return COURSES[0];
  if (!generated.has(id)) {
    if (generated.size >= 64) generated.delete(generated.keys().next().value);
    generated.set(id, generateCourse(parts.map, parts.seed, parts.level, id));
  }
  return generated.get(id);
}

export function terrainHeight(course, x, z) {
  const selected = course && typeof course === 'object' ? course : getCourse(course);
  x = bounded(x); z = bounded(z);
  const phase = finite(selected.phase);
  if (selected.map === 'ridge' || selected.map === 'canyon') {
    const ridge = Math.exp(-(((x + 95 + 18 * Math.sin(z * 0.003 + phase)) / 75) ** 2));
    return 24 + 8 * (1 + Math.sin(z * 0.005 + phase)) + 27 * ridge;
  }
  if (selected.map === 'cloudline' || selected.map === 'aurora') {
    return 12 + 12 * (0.5 + 0.5 * Math.sin(z * 0.004 + phase))
      + 8 * (0.5 + 0.5 * Math.sin(x * 0.014 + z * 0.002 + phase));
  }
  return smooth(55, 145, x) * (9 + 4 * Math.sin(z * 0.008 + phase) + 3 * Math.sin(x * 0.02 + z * 0.003 + phase));
}

export function getWorld(course, zMin, zMax, mode = 'course') {
  let low = bounded(zMin), high = bounded(zMax);
  if (high < low) [low, high] = [high, low];
  high = Math.min(high, low + 4000);
  if (mode !== 'free') return {
    obstacles: course.obstacles.filter(item => item.z + item.radius >= low && item.z - item.radius <= high),
    thermals: course.thermals.filter(item => item.z + item.radius >= low && item.z - item.radius <= high),
  };
  const obstacles = [], thermals = [];
  for (let chunk = Math.max(1, Math.floor((low - 120) / 240)); chunk <= Math.floor((high + 120) / 240); chunk++) {
    const density = 3 + Math.min(4, Math.floor(course.level / 12) + Math.floor(chunk / 15));
    for (let index = 0; index < density; index++) {
      const z = chunk * 240 + random(chunk * 13 + index, course.seed) * 100;
      const x = (random(chunk * 17 + index, course.seed + 1) - 0.5) * course.bounds.halfWidth * 1.5;
      const radius = 5 + random(chunk, course.seed + index) * 4;
      if (z + radius >= low && z - radius <= high) obstacles.push({ id: `${course.id}-free-${chunk}-${index}`, x, z, radius,
        base: terrainHeight(course, x, z), height: course.start.y + 25 + random(chunk, course.seed + index + 3) * 55 });
    }
    const z = chunk * 240 + 160;
    if (z + 110 >= low && z - 110 <= high) thermals.push({ x: (random(chunk, course.seed + 41) - 0.5) * 120,
      z, radius: 110, strength: 4, base: 0, top: course.bounds.ceiling });
  }
  return { obstacles, thermals };
}

export function sampleWind(course, x, y, z, time, mode = 'course') {
  const selected = course && typeof course === 'object' ? course : getCourse(course);
  x = bounded(x); y = bounded(y); z = bounded(z); time = bounded(time);
  const gust = clamp(finite(selected.wind?.gust) + (mode === 'free' ? Math.max(0, z) / 5000 : 0), 0, 8);
  const wx = clamp(finite(selected.wind?.x), -12, 12)
    + gust * (Math.sin(time * 0.7 + z * 0.004 + finite(selected.phase)) + 0.35 * Math.sin(time * 1.8 + x * 0.012));
  const wz = clamp(finite(selected.wind?.z), -8, 8) + gust * 0.35 * Math.sin(time * 0.37 + z * 0.004);
  let wy = 0;
  for (const thermal of getWorld(selected, z - 120, z + 120, mode).thermals) {
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
  const wind = sampleWind(course, course.start.x, course.start.y, course.start.z, 0, mode);
  return {
    courseId: course.id, mode: mode === 'free' ? 'free' : 'course', status: 'flying',
    ...course.start, vx: wind.x, vy: -0.55 + wind.y, vz: course.startSpeed + wind.z,
    roll: 0, pitch: 0, airspeed: course.startSpeed, time: 0,
    score: 0, gateIndex: 0, passed: 0, missed: 0, streak: 0, bestStreak: 0, updraftSeconds: 0,
    tricks: 0, trickAngle: 0, trickActive: false, nextTrickZ: 180, _trickHeld: false,
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

function integrate(state, course, bank, pitch, trick) {
  const before = { x: state.x, y: state.y, z: state.z, time: state.time, updraftSeconds: state.updraftSeconds };
  const wind = sampleWind(course, state.x, state.y, state.z, state.time, state.mode);
  if (trick && !state._trickHeld && !state.trickActive && state.z >= state.nextTrickZ
    && state.y - terrainHeight(course, state.x, state.z) > 35 && state.y < course.bounds.ceiling - 25) {
    state.trickActive = true; state.trickAngle = 0; state.nextTrickZ = state.z + 200;
  }
  state._trickHeld = trick;
  state.roll += (bank * 0.85 - state.roll) * (1 - Math.exp(-4.5 * STEP));
  state.pitch += (pitch * 0.32 - state.pitch) * (1 - Math.exp(-3.8 * STEP));
  const freeSpeed = state.mode === 'free' ? Math.min(12, Math.max(0, state.z) / 1500) : 0;
  const trim = clamp(course.startSpeed + freeSpeed - state.pitch * 13 - Math.abs(state.roll) * 1.8 - (state.trickActive ? 8 : 0), 30, 86);
  state.airspeed = clamp(state.airspeed + (trim - state.airspeed) * (1 - Math.exp(-0.65 * STEP)), 25, 90);
  const targetX = state.airspeed * Math.sin(state.roll) * 0.36 + wind.x;
  const targetY = state.airspeed * Math.sin(state.pitch) - 0.55 + wind.y;
  const targetZ = state.airspeed * Math.cos(state.pitch) * (1 - 0.08 * Math.abs(Math.sin(state.roll))) + wind.z;
  state.vx += (targetX - state.vx) * (1 - Math.exp(-1.6 * STEP));
  state.vy += (targetY - state.vy) * (1 - Math.exp(-0.95 * STEP));
  state.vz += (targetZ - state.vz) * (1 - Math.exp(-0.9 * STEP));
  state.x += state.vx * STEP; state.y += state.vy * STEP; state.z += state.vz * STEP;
  state.time += STEP;
  if (wind.y > 0.5) state.updraftSeconds += STEP;
  state.wind = sampleWind(course, state.x, state.y, state.z, state.time, state.mode);

  let impact = 2;
  for (const object of getWorld(course, before.z - 15, state.z + 15, state.mode).obstacles) {
    const dx = state.x - before.x, dz = state.z - before.z, dy = state.y - before.y;
    const ox = before.x - object.x, oz = before.z - object.z, radius = object.radius + CLEARANCE;
    const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - radius * radius;
    let entry = 0, exit = 1;
    if (a < 1e-15) { if (c > 0) continue; }
    else {
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;
      entry = Math.max(0, (-b - Math.sqrt(discriminant)) / (2 * a));
      exit = Math.min(1, (-b + Math.sqrt(discriminant)) / (2 * a));
    }
    const bottom = object.base - CLEARANCE, top = object.base + object.height + CLEARANCE;
    if (Math.abs(dy) < 1e-15) { if (before.y < bottom || before.y > top) continue; }
    else {
      const first = (bottom - before.y) / dy, last = (top - before.y) / dy;
      entry = Math.max(entry, Math.min(first, last)); exit = Math.min(exit, Math.max(first, last));
    }
    if (entry <= exit) impact = Math.min(impact, entry);
  }
  if (impact <= 1) {
    for (const key of ['x', 'y', 'z', 'time']) state[key] = before[key] + (state[key] - before[key]) * impact;
    state.updraftSeconds = before.updraftSeconds + (state.updraftSeconds - before.updraftSeconds) * impact;
    state.wind = sampleWind(course, state.x, state.y, state.z, state.time, state.mode);
    crash(state, 'Rock spire contact. Bank around it or climb above the summit.'); return;
  }

  if (state.y <= terrainHeight(course, state.x, state.z) + CLEARANCE) {
    crash(state, 'Ground contact. Keep a little more height next time.'); return;
  }
  if (Math.abs(state.x) >= course.bounds.halfWidth) {
    crash(state, 'Beyond the flying area. Try a gentler bank.'); return;
  }
  if (state.y >= course.bounds.ceiling) {
    crash(state, 'Above the flying area. Ease the nose down next time.'); return;
  }
  if (state.trickActive) {
    state.trickAngle += Math.PI * 2 * STEP / 1.05;
    if (state.trickAngle + 1e-9 >= Math.PI * 2) {
      state.trickActive = false; state.trickAngle = 0; state.tricks++; state.score += 250;
      event(state, 'trick', 'Barrel roll complete · +250 points');
    }
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
    integrate(next, course, bank, pitch, controls?.trick === true);
    remaining -= STEP;
  }
  next._remainder = next.status === 'flying' ? Math.max(0, remaining) : 0;
  return next;
}
