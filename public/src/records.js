const KEY = 'driftwing.v1';
const COURSE_IDS = new Set(['coast', 'ridge', 'cloudline']);

export function normalizeSave(value, reducedMotion = false) {
  const defaults = { course: 'coast', sound: false, steady: Boolean(reducedMotion), records: {} };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const result = {
    course: COURSE_IDS.has(value.course) ? value.course : defaults.course,
    sound: typeof value.sound === 'boolean' ? value.sound : false,
    steady: typeof value.steady === 'boolean' ? value.steady : defaults.steady,
    records: {},
  };
  if (value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const id of COURSE_IDS) {
      const record = value.records[id];
      if (!record || typeof record !== 'object' || !Number.isFinite(record.score) || !Number.isFinite(record.time)
        || !Number.isInteger(record.passed) || record.score < 0 || record.score > 100000
        || record.time < 0 || record.time > 7200 || record.passed < 0 || record.passed > 100) continue;
      result.records[id] = { score: Math.round(record.score), time: record.time, passed: record.passed };
    }
  }
  return result;
}

export function loadSave(storage, reducedMotion = false) {
  try {
    const raw = storage.getItem(KEY);
    return { value: normalizeSave(raw ? JSON.parse(raw) : null, reducedMotion), available: true };
  } catch {
    return { value: normalizeSave(null, reducedMotion), available: false };
  }
}

export function writeSave(storage, value) {
  try { storage.setItem(KEY, JSON.stringify(normalizeSave(value))); return true; }
  catch { return false; }
}

export function keepRecord(save, flight) {
  if (flight.status !== 'finished' || flight.mode !== 'course' || !COURSE_IDS.has(flight.courseId)) return { value: save, improved: false };
  const previous = save.records[flight.courseId];
  const improved = !previous || flight.score > previous.score || (flight.score === previous.score && flight.time < previous.time);
  if (!improved) return { value: save, improved: false };
  const value = normalizeSave({ ...save, records: { ...save.records, [flight.courseId]: { score: flight.score, time: flight.time, passed: flight.passed } } });
  return { value, improved: true };
}
