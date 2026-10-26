import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, getCourse, createFlight, stepFlight, sampleWind, terrainHeight } from '../public/src/flight.js';

function fly(state, seconds, controls = {}) {
  let next = state;
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) next = stepFlight(next, controls, 1 / 60);
  return next;
}
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);

test('three authored beginner routes have ordered, reachable rings and safe starts', () => {
  assert.deepEqual(COURSES.map(course => course.id), ['coast', 'ridge', 'cloudline']);
  for (const course of COURSES) {
    assert.ok(course.gates.length >= 6 && course.gates.length <= 8);
    assert.ok(course.start.y > terrainHeight(course, course.start.x, course.start.z) + 20);
    let z = course.start.z;
    for (const gate of course.gates) {
      assert.ok(gate.z > z); z = gate.z;
      assert.ok(Math.abs(gate.x) + gate.radius < course.bounds.halfWidth);
      assert.ok(gate.y - gate.radius > terrainHeight(course, gate.x, gate.z) + 3);
      assert.ok(gate.y + gate.radius < course.bounds.ceiling);
    }
  }
  assert.equal(getCourse('missing'), COURSES[0]);
  assert.equal(getCourse('COAST'), COURSES[0]);
});

test('crosswind changes the actual unsteered trajectory compared with calm air', () => {
  const start = createFlight('coast');
  const calm = fly(start, 8);
  const windy = fly({ ...createFlight('ridge'), ...start, courseId: 'ridge' }, 8);
  assert.equal(calm.status, 'flying'); assert.equal(windy.status, 'flying');
  near(calm.x, 0);
  assert.ok(windy.x < calm.x - 10, 'Crosswind should carry the aircraft left, rather than just change the HUD.');
  assert.ok(Math.abs(windy.vx) > 1);
  assert.ok(windy.z < calm.z, 'The ridge headwind should also alter forward travel.');
});

test('thermal lift changes altitude and accumulated updraft time', () => {
  const course = getCourse('coast'); const thermal = course.thermals[0];
  const start = { ...createFlight('coast', 'free'), x: thermal.x, z: thermal.z - 25, y: 85, vx: 0, vy: -0.55 };
  const rising = fly(start, 2);
  const outside = fly({ ...start, x: -180 }, 2);
  assert.equal(rising.status, 'flying'); assert.equal(outside.status, 'flying');
  assert.ok(rising.y > outside.y + 2, 'Passing through rising air should gain real height.');
  assert.ok(rising.updraftSeconds > 1); near(outside.updraftSeconds, 0);
  assert.equal(sampleWind(course, -180, 85, thermal.z, 0).y, 0);
  assert.equal(sampleWind(course, thermal.x, thermal.top + 1, thermal.z, 0).y, 0);
});

test('bank direction steers and pitch changes climb and airspeed', () => {
  const start = createFlight('coast', 'free');
  const right = fly(start, 4, { bank: 0.8 }); const left = fly(start, 4, { bank: -0.8 });
  assert.ok(right.x > 12 && left.x < -12);
  near(right.x, -left.x);
  assert.ok(right.roll > 0 && left.roll < 0);
  const climbing = fly(start, 4, { pitch: 0.6 }); const diving = fly(start, 4, { pitch: -0.6 });
  assert.ok(climbing.y > start.y + 8); assert.ok(diving.y < start.y - 8);
  assert.ok(climbing.airspeed < diving.airspeed, 'Climbing should trade speed for height.');
});

test('a ring crossing between frames awards once and leaves the supplied state unchanged', () => {
  const gate = getCourse('coast').gates[0];
  const start = { ...createFlight('coast'), x: gate.x, y: gate.y, z: gate.z - 0.05, vx: 0, vy: 0 };
  const snapshot = structuredClone(start); const controls = Object.freeze({ bank: 0, pitch: 0 });
  const crossed = stepFlight(start, controls, 1 / 30);
  assert.deepEqual(start, snapshot);
  assert.equal(crossed.passed, 1); assert.equal(crossed.gateIndex, 1); assert.equal(crossed.missed, 0);
  assert.equal(crossed.lastEvent.type, 'pass'); assert.ok(crossed.score > 0);
  const later = fly(crossed, 1);
  assert.equal(later.passed, 1); assert.equal(later.score, crossed.score);
  assert.equal(later.lastEvent.id, crossed.lastEvent.id);
});

test('gate scoring uses the interpolated crossing rather than the endpoint', () => {
  const gate = getCourse('coast').gates[0];
  const start = { ...createFlight('coast'), x: gate.x + gate.radius - 0.1, y: gate.y, z: gate.z - 0.01, vx: 45, vy: 0 };
  const crossed = stepFlight(start, {}, 1 / 120);
  assert.ok(crossed.x > gate.x + gate.radius, 'The frame endpoint is outside the ring.');
  assert.equal(crossed.passed, 1, 'The aircraft was inside the ring when it crossed the plane.');
});

test('a missed ring resets the streak without crashing or awarding a pass', () => {
  const gate = getCourse('coast').gates[0];
  const start = { ...createFlight('coast'), x: gate.x + gate.radius + 15, y: gate.y, z: gate.z - 0.05, streak: 3, bestStreak: 3, score: 400 };
  const missed = stepFlight(start, {}, 1 / 30);
  assert.equal(missed.status, 'flying'); assert.equal(missed.missed, 1); assert.equal(missed.passed, 0);
  assert.equal(missed.streak, 0); assert.equal(missed.bestStreak, 3); assert.equal(missed.score, 400);
  assert.equal(missed.lastEvent.type, 'miss');
});

test('the final ring can be passed before reaching the finish and terminal states stay stable', () => {
  const course = getCourse('coast'); const last = course.gates.at(-1);
  const start = { ...createFlight('coast'), x: last.x, y: last.y, z: last.z - 0.1, gateIndex: course.gates.length - 1, passed: 6, vx: 0, vy: 0 };
  const passed = stepFlight(start, {}, 1 / 60);
  assert.equal(passed.passed, 7); assert.equal(passed.status, 'flying');
  const finished = fly(passed, 4);
  assert.equal(finished.status, 'finished'); assert.equal(finished.lastEvent.type, 'finish');
  assert.equal(finished.gateIndex, course.gates.length);
  const snapshot = structuredClone(finished);
  assert.deepEqual(stepFlight(finished, { bank: 1, pitch: -1 }, 0.1), snapshot);
});

test('ground, lateral boundary and ceiling contact crash consistently with shared terrain', () => {
  for (const course of COURSES) {
    const initial = createFlight(course.id);
    const ground = stepFlight({ ...initial, y: terrainHeight(course, initial.x, initial.z) + 2 }, {}, 1 / 60);
    assert.equal(ground.status, 'crashed'); assert.equal(ground.lastEvent.type, 'crash');
    assert.equal(stepFlight(ground, {}, 0.1), ground);
    assert.equal(stepFlight({ ...initial, x: course.bounds.halfWidth + 1 }, {}, 1 / 60).status, 'crashed');
    assert.equal(stepFlight({ ...initial, y: course.bounds.ceiling + 1 }, {}, 1 / 60).status, 'crashed');
  }
});

test('free flight ignores ring, finish and time-limit rules', () => {
  const course = getCourse('coast');
  const start = { ...createFlight('coast', 'free'), z: course.gates.at(-1).z + 100, time: course.limitSeconds + 5 };
  const next = fly(start, 2);
  assert.equal(next.status, 'flying'); assert.ok(next.z > start.z); assert.ok(next.time > course.limitSeconds);
  assert.equal(next.gateIndex, 0); assert.equal(next.passed, 0); assert.equal(next.missed, 0);
  assert.equal(next.score, 0);
});

test('invalid dt cannot advance flight and a giant catch-up is capped', () => {
  const initial = createFlight('coast');
  for (const dt of [NaN, Infinity, -Infinity, -1, 0, undefined, '1']) assert.deepEqual(stepFlight(initial, {}, dt), initial);
  assert.deepEqual(stepFlight(initial, {}, 100), stepFlight(initial, {}, 0.1));
  const clamped = fly(initial, 2, { bank: 100, pitch: -100 });
  assert.deepEqual(clamped, fly(initial, 2, { bank: 1, pitch: -1 }));
  const invalid = fly(initial, 2, { bank: NaN, pitch: Infinity });
  assert.deepEqual(invalid, fly(initial, 2));
});

test('fixed-step carry makes equal control histories independent of render-frame partitioning', () => {
  let sixty = createFlight('ridge', 'free'); let mixed = createFlight('ridge', 'free');
  const controls = { bank: 0.25, pitch: 0.1 };
  for (let i = 0; i < 240; i++) sixty = stepFlight(sixty, controls, 1 / 60);
  for (let i = 0; i < 80; i++) { mixed = stepFlight(mixed, controls, 0.013); mixed = stepFlight(mixed, controls, 0.037); }
  for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'roll', 'pitch', 'airspeed', 'time', 'updraftSeconds']) near(mixed[field], sixty[field]);
  assert.equal(mixed.status, sixty.status);
});

test('wind and terrain sampling are deterministic and remain finite for invalid coordinates', () => {
  for (const course of COURSES) {
    assert.deepEqual(sampleWind(course, 20, 100, 500, 9), sampleWind(course, 20, 100, 500, 9));
    const wind = sampleWind(course, NaN, Infinity, -Infinity, NaN);
    assert.ok([wind.x, wind.y, wind.z, terrainHeight(course, NaN, Infinity)].every(Number.isFinite));
  }
  const course = getCourse('cloudline');
  assert.notEqual(sampleWind(course, 0, 100, 0, 0).x, sampleWind(course, 0, 100, 0, 4).x);
});

test('a simple feedback pilot can finish every authored course with all rings', () => {
  const limit = (n, bound) => Math.max(-bound, Math.min(bound, n));
  for (const course of COURSES) {
    let state = createFlight(course.id);
    for (let frame = 0; frame < 90 * 60 && state.status === 'flying'; frame++) {
      const gate = course.gates[state.gateIndex] || course.gates.at(-1);
      const seconds = Math.max(1.2, (gate.z - state.z) / Math.max(1, state.vz));
      const desiredX = limit((gate.x - state.x) / seconds, 6);
      const desiredY = limit((gate.y - state.y) / seconds, 4);
      state = stepFlight(state, { bank: limit((desiredX - state.vx) * 0.3, 0.85), pitch: limit((desiredY - state.vy) * 0.15, 0.6) }, 1 / 60);
    }
    assert.equal(state.status, 'finished', `${course.id}: ${state.lastEvent?.text}`);
    assert.equal(state.passed, course.gates.length, `${course.id}: all gates should be approachable with gentle controls.`);
    assert.equal(state.missed, 0);
  }
});
