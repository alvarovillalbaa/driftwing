import { MAPS, parseLevel, getCourse } from './flight.js';

const KEY = 'driftwing.v1';
const COURSE_IDS = new Set(MAPS.map(map => map.id));
const validId = id => COURSE_IDS.has(id) || Boolean(parseLevel(id));
function recordValue(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || !Number.isFinite(record.score) || !Number.isFinite(record.time)
    || !Number.isInteger(record.passed) || record.score < 0 || record.score > 100000
    || record.time <= 0 || record.time > 7200 || record.passed < 0 || record.passed > 100) return null;
  return { score: Math.round(record.score), time: record.time, passed: record.passed };
}

export function normalizeSave(value, reducedMotion = false) {
  const defaults = { course: 'coast', sound: false, steady: Boolean(reducedMotion), records: {}, progress: { level: 1, levels: [], completed: [] } };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const result = {
    course: validId(value.course) ? value.course : defaults.course,
    sound: typeof value.sound === 'boolean' ? value.sound : false,
    steady: typeof value.steady === 'boolean' ? value.steady : defaults.steady,
    records: {},
    progress: {
      level: Number.isInteger(value.progress?.level) && value.progress.level >= 1 && value.progress.level <= 50 ? value.progress.level : 1,
      levels: Array.isArray(value.progress?.levels) ? [...new Set(value.progress.levels.filter(id => parseLevel(id)))].slice(-80) : [],
      completed: Array.isArray(value.progress?.completed) ? [...new Set(value.progress.completed.filter(id => parseLevel(id)))].slice(-80) : [],
    },
  };
  if (value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const id of Object.keys(value.records).filter(validId).slice(-100)) {
      const record = recordValue(value.records[id]);
      if (record) result.records[id] = record;
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
  try {
    const raw = JSON.stringify(normalizeSave(value));
    storage.setItem(KEY, raw); return storage.getItem(KEY) === raw;
  }
  catch { return false; }
}

export function rememberLevel(save, id) {
  const normalized = normalizeSave(save);
  if (!parseLevel(id)) return normalized;
  return { ...normalized, course: id, progress: { ...normalized.progress,
    levels: [...normalized.progress.levels.filter(item => item !== id), id].slice(-80) } };
}

export function keepRecord(save, flight) {
  if (!flight || flight.status !== 'finished' || flight.mode !== 'course' || !validId(flight.courseId)) return { value: save, improved: false };
  const candidate = recordValue(flight), level = parseLevel(flight.courseId);
  if (!candidate || (level && (flight.passed + flight.missed !== getCourse(flight.courseId).gates.length
    || flight.gateIndex !== getCourse(flight.courseId).gates.length))) return { value: save, improved: false };
  const normalized = normalizeSave(save), previous = normalized.records[flight.courseId];
  const improved = !previous || flight.score > previous.score || (flight.score === previous.score && flight.time < previous.time);
  const advanced = level && !normalized.progress.completed.includes(flight.courseId);
  if (!improved && !advanced) return { value: save, improved: false };
  const progress = advanced ? { ...normalized.progress, level: Math.min(50, Math.max(normalized.progress.level, level.level + 1)),
    completed: [...normalized.progress.completed, flight.courseId].slice(-80) } : normalized.progress;
  return { value: { ...normalized, progress,
    records: improved ? { ...normalized.records, [flight.courseId]: candidate } : normalized.records }, improved };
}
