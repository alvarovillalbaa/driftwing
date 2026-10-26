import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSave, loadSave, writeSave, keepRecord } from '../public/src/records.js';

test('unavailable and malformed storage preserve playable defaults', () => {
  assert.equal(loadSave(null, true).available, false);
  const corrupt = loadSave({ getItem() { return '{broken'; } }, true);
  assert.equal(corrupt.available, false); assert.equal(corrupt.value.steady, true);
  assert.equal(writeSave({ setItem() { throw new Error('quota'); } }, {}), false);
});
test('stored data cannot inject courses, invalid records or arbitrary keys', () => {
  const result = normalizeSave({ course: '__proto__', sound: 'yes', records: { coast: { score: NaN, passed: 4, time: 1 }, ridge: { score: 700, passed: 5, time: 80 }, unrelated: { score: 1000, passed: 7, time: 5 } } });
  assert.equal(result.course, 'coast'); assert.equal(result.sound, false);
  assert.deepEqual(Object.keys(result.records), ['ridge']);
});
test('only completed course flights replace records and ties require faster time', () => {
  const save = normalizeSave(null);
  const flight = { courseId: 'coast', mode: 'course', status: 'finished', score: 500, passed: 5, time: 80 };
  const next = keepRecord(save, flight); assert.equal(next.improved, true); assert.equal(save.records.coast, undefined);
  for (const update of [{ status: 'crashed' }, { mode: 'free' }, { score: 499 }, { time: 81 }]) assert.equal(keepRecord(next.value, { ...flight, ...update }).improved, false);
  assert.equal(keepRecord(next.value, { ...flight, time: 79 }).improved, true);
  assert.equal(keepRecord(next.value, { ...flight, score: 600, time: 100 }).improved, true);
});
