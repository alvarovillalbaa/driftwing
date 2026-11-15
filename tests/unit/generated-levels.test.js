// T2: authored seeds/controls and in-memory storage. No browser or service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, levelId, parseLevel, getCourse, createFlight, stepFlight, getWorld, terrainHeight, sampleWind } from '../../public/src/flight.js';
import { normalizeSave, rememberLevel, keepRecord, loadSave, writeSave } from '../../public/src/records.js';

function fly(state, seconds, controls = {}) {
  for (let frame = 0; frame < seconds * 60; frame++) state = stepFlight(state, controls, 1 / 60);
  return state;
}
function completed(id) {
  const course = getCourse(id);
  return { ...createFlight(id), status: 'finished', time: 80, score: 2000, passed: course.gates.length,
    missed: 0, gateIndex: course.gates.length };
}

test('versioned seeds reconstruct exact worlds after cache eviction and generate different maps', () => {
  for (const map of MAPS) {
    const id = levelId(map.id, 42, 12), snapshot = structuredClone(getCourse(id));
    for (let seed = 100; seed < 170; seed++) getCourse(levelId(map.id, seed, 1));
    assert.deepEqual(getCourse(id), snapshot);
    assert.notDeepEqual(getCourse(levelId(map.id, 43, 12)).gates, snapshot.gates);
    assert.notDeepEqual(getCourse(levelId(map.id, 43, 12)).obstacles, snapshot.obstacles);
  }
  assert.notDeepEqual(getCourse(levelId('coast', 42, 1)).gates, getCourse(levelId('islands', 42, 1)).gates);
});

test('identifiers reject invalid, noncanonical and unbounded map seeds and levels', () => {
  for (const id of [null, {}, 'v2-coast-0-1', 'v2-coast-01-1', 'v2-other-1-1', 'v2-coast-4294967296-1', 'v2-coast-1-51', 'v2-coast-1-0', 'v2-coast-1-1x']) assert.equal(parseLevel(id), null);
  assert.deepEqual(parseLevel(levelId('ridge', 0xffffffff, 50)), { map: 'ridge', seed: 0xffffffff, level: 50 });
  assert.equal(levelId('coast', Infinity, 1), null);
});

test('higher levels launch faster with stronger gusts, narrower rings and denser obstacles', () => {
  for (const map of MAPS) {
    const first = getCourse(levelId(map.id, 123, 1)), later = getCourse(levelId(map.id, 123, 50));
    assert.equal(first.startSpeed, 48); assert.equal(later.startSpeed, 70);
    assert.ok(later.wind.gust > first.wind.gust && later.gates[0].radius < first.gates[0].radius);
    assert.ok(later.obstacles.length > first.obstacles.length && first.obstacles.length >= 24);
    assert.ok(first.gates[0].z / first.startSpeed > 5, 'Preserve time to react to the first gate.');
    assert.ok(first.start.y > terrainHeight(first, 0, 0) + 35);
    for (const gate of later.gates) {
      assert.ok(gate.y - gate.radius > terrainHeight(later, gate.x, gate.z) + 3);
      assert.ok(gate.y + gate.radius < later.bounds.ceiling);
    }
  }
});

test('range queries stay deterministic and bounded beyond the generated course finish', () => {
  const course = getCourse(levelId('canyon', 42, 50));
  const world = getWorld(course, 5000, 6000, 'free');
  assert.deepEqual(world, getWorld(course, 5000, 6000, 'free'));
  assert.ok(world.obstacles.length > 0 && world.thermals.length > 0);
  assert.equal(new Set(world.obstacles.map(item => item.id)).size, world.obstacles.length);
  const huge = getWorld(course, 0, 1e7, 'free');
  assert.ok(huge.obstacles.length <= 140 && huge.thermals.length <= 20);
  assert.ok(huge.obstacles.every(item => item.z - item.radius <= 4000));
  assert.ok(Math.abs(sampleWind(course, 0, 100, 500, 3, 'free').x) > 0);
});

test('spire collisions stop at swept contact, freeze terminal state and permit sufficient vertical clearance', () => {
  const id = levelId('coast', 42, 1), course = getCourse(id), object = course.obstacles[0];
  const start = { ...createFlight(id), x: object.x, z: object.z - object.radius - 3.2,
    y: object.base + object.height / 2, vz: 90, vx: 0, vy: 0,
    trickActive: true, trickAngle: Math.PI * 2 - 0.001 };
  const snapshot = structuredClone(start), crashed = stepFlight(start, {}, 0.1);
  assert.deepEqual(start, snapshot);
  assert.equal(crashed.status, 'crashed'); assert.match(crashed.lastEvent.text, /spire/);
  assert.ok(crashed.z < object.z - object.radius && crashed.time < 0.1);
  assert.equal(crashed.tricks, 0); assert.equal(crashed.score, 0, 'No points for a roll interrupted by impact.');
  assert.equal(stepFlight(crashed, { bank: 1, trick: true }, 0.1), crashed);
  const overFirst = fly({ ...start, y: object.base + object.height + 8, trickActive: false, vz: 48 }, 1);
  assert.equal(overFirst.status, 'crashed', 'This seed has a taller adjacent spire; clearing only the first is insufficient.');
  const clearAltitude = Math.max(...course.obstacles.map(item => item.base + item.height)) + 8;
  assert.ok(clearAltitude < course.bounds.ceiling - 10);
  const cleared = fly({ ...start, y: clearAltitude, trickActive: false, vz: 48 }, 1);
  assert.equal(cleared.status, 'flying'); assert.ok(cleared.z > object.z + object.radius);
});

test('barrel rolls finish before scoring, cost speed, latch held input and require height and distance', () => {
  const course = getCourse('coast');
  const start = { ...createFlight('coast', 'free'), z: 181, y: course.bounds.ceiling - 35 };
  const partial = fly(start, 0.5, { trick: true }), neutral = fly(start, 0.5);
  assert.equal(partial.trickActive, true); assert.ok(partial.trickAngle > 0);
  assert.equal(partial.score, 0); assert.equal(partial.tricks, 0);
  assert.ok(partial.airspeed < neutral.airspeed, 'A roll trades speed for points.');
  const complete = fly(start, 1.2, { trick: true });
  assert.equal(complete.trickActive, false); assert.equal(complete.tricks, 1); assert.equal(complete.score, 250);
  const held = fly(start, 5.5, { trick: true });
  assert.equal(held.status, 'flying'); assert.equal(held.tricks, 1, 'Holding the key cannot farm rolls.');
  assert.equal(fly({ ...start, z: 0 }, 1.2, { trick: true }).tricks, 0);
  const low = stepFlight({ ...start, y: terrainHeight(course, start.x, start.z) + 25 }, { trick: true }, 1 / 120);
  assert.equal(low.trickActive, false);
});

test('saved identities, exact map reconstruction and first-completion progression survive serialization', () => {
  const values = new Map([['unrelated', 'keep']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const id = levelId('islands', 12345, 1);
  let save = rememberLevel(normalizeSave(null), id);
  save = keepRecord(save, completed(id)).value;
  assert.equal(save.progress.level, 2); assert.equal(writeSave(storage, save), true);
  const restored = loadSave(storage).value;
  assert.deepEqual(restored, save); assert.deepEqual(restored.progress.levels, [id]);
  assert.deepEqual(getCourse(restored.course), getCourse(id));
  assert.equal(keepRecord(restored, { ...completed(id), score: 2100 }).value.progress.level, 2);
  assert.equal(values.get('unrelated'), 'keep');
});

test('crashes, free flight and invalid or incomplete finishes cannot produce campaign records', () => {
  const id = levelId('aurora', 7, 1), save = rememberLevel(normalizeSave(null), id);
  for (const change of [{ status: 'crashed' }, { mode: 'free' }, { passed: 0 }, { gateIndex: 0 }, { time: 0 }, { score: NaN }]) {
    assert.deepEqual(keepRecord(save, { ...completed(id), ...change }), { value: save, improved: false });
  }
  let many = normalizeSave(null);
  for (let seed = 1; seed < 100; seed++) many = rememberLevel(many, levelId('coast', seed, 1));
  assert.equal(many.progress.levels.length, 80);
  assert.deepEqual(normalizeSave({ progress: { level: Infinity, levels: ['invalid'], completed: [null] } }).progress,
    { level: 1, levels: [], completed: [] });
  const terminal = rememberLevel(normalizeSave({ progress: { level: 50 } }), levelId('ridge', 1, 50));
  assert.equal(keepRecord(terminal, completed(terminal.course)).value.progress.level, 50);
  assert.equal(writeSave({ setItem() {}, getItem() { return null; } }, save), false);
});

test('ordinary controls finish varied generated levels through every ring without bypassing spires', () => {
  const limit = (value, bound) => Math.max(-bound, Math.min(bound, value));
  for (const map of MAPS) for (const seed of [13, 42]) for (const level of [1, 12, 25, 50]) {
    const id = levelId(map.id, seed, level), course = getCourse(id);
    let state = createFlight(id);
    for (let frame = 0; frame < 120 * 60 && state.status === 'flying'; frame++) {
      const gate = course.gates[state.gateIndex] || course.gates.at(-1);
      const seconds = Math.max(1, (gate.z - state.z) / Math.max(1, state.vz));
      const targetX = limit((gate.x - state.x) / seconds * 1.1, 12);
      const targetY = limit((gate.y - state.y) / seconds * 1.1, 7);
      const bank = Math.asin(limit((targetX - state.wind.x) / (state.airspeed * 0.36), 0.75)) / 0.85;
      const pitch = Math.asin(limit((targetY - state.wind.y + 0.55) / state.airspeed, 0.3)) / 0.32;
      state = stepFlight(state, { bank: limit(bank + (targetX - state.vx) * 0.08, 1), pitch: limit(pitch + (targetY - state.vy) * 0.05, 0.9) }, 1 / 60);
    }
    assert.equal(state.status, 'finished', `${id}: ${state.lastEvent?.text}`);
    assert.equal(state.passed, course.gates.length, `${id}: every ring must remain reachable`);
  }
});
