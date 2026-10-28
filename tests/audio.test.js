// Actual audio module, with authored AudioContext/node boundaries. No browser,
// speaker, permission, native audio or provider operation runs in these checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(process.env.DRIFTWING_AUDIO_SOURCE || new URL('../public/src/audio.js', import.meta.url), 'utf8');
assert.equal((source.match(/^export function createFlightAudio\b/gm) || []).length, 1);
const script = new vm.Script(source.replace(/^export (?=function createFlightAudio\b)/m, '')
  + '\n;globalThis.createFlightAudio = createFlightAudio;', { filename: 'actual-driftwing-audio.mocked.js' });

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness({ absent = false, constructorFailure = false, legacy = false, rejectedClose = false, partialFailureOnce = false } = {}) {
  const contexts = [], resumes = [], parameterChanges = [];
  let closeRejectionHandlers = 0;
  let failGraph = partialFailureOnce;
  function parameter(value = 0) {
    return {
      value,
      setTargetAtTime(next) { this.value = next; parameterChanges.push(next); },
      setValueAtTime(next) { this.value = next; parameterChanges.push(next); },
      linearRampToValueAtTime(next) { this.value = next; parameterChanges.push(next); },
      exponentialRampToValueAtTime(next) { this.value = next; parameterChanges.push(next); },
      cancelScheduledValues() {},
    };
  }
  function node(type) {
    return {
      type, connections: [], disconnects: 0, starts: [], stops: [],
      connect(destination) { this.connections.push(destination); return destination; },
      disconnect() { this.disconnects++; this.connections = []; },
      start(time) { this.starts.push(time); },
      stop(time) { this.stops.push(time); },
    };
  }
  class AudioContext {
    constructor() {
      if (constructorFailure) throw new Error('Authored audio construction failure');
      this.state = 'suspended'; this.sampleRate = 8000; this.currentTime = 12;
      this.destination = node('destination'); this.gains = []; this.oscillators = []; this.noises = []; this.closeCalls = 0;
      contexts.push(this);
    }
    createGain() {
      const gain = { ...node('gain'), gain: parameter() }; this.gains.push(gain); return gain;
    }
    createBiquadFilter() { return { ...node('filter'), frequency: parameter() }; }
    createBuffer(channels, length) {
      assert.equal(channels, 1);
      const samples = new Float32Array(length);
      return { getChannelData(channel) { assert.equal(channel, 0); return samples; } };
    }
    createBufferSource() {
      if (failGraph) { failGraph = false; throw new Error('Authored partial graph failure'); }
      const noise = node('noise'); this.noises.push(noise); return noise;
    }
    createOscillator() {
      const oscillator = { ...node('oscillator'), frequency: parameter() };
      this.oscillators.push(oscillator); return oscillator;
    }
    resume() {
      const gate = deferred(); resumes.push(gate);
      return gate.promise.then(() => { if (this.state !== 'closed') this.state = 'running'; });
    }
    close() {
      this.masterAtClose = this.gains[0]?.gain.value;
      this.masterDisconnectedAtClose = this.gains[0]?.disconnects ?? 0;
      this.closeCalls++; this.state = 'closed';
      if (!rejectedClose) return Promise.resolve();
      // This rejected thenable records whether production attaches a rejection
      // handler, without creating an unrelated unhandled baseline rejection.
      const error = new Error('Authored close rejection');
      return {
        then(_success, failure) {
          if (typeof failure === 'function') { closeRejectionHandlers++; failure(error); }
          return Promise.resolve();
        },
        catch(failure) { closeRejectionHandlers++; failure(error); return Promise.resolve(); },
      };
    }
  }
  const window = absent ? {} : legacy ? { webkitAudioContext: AudioContext } : { AudioContext };
  const context = vm.createContext({ window });
  script.runInContext(context);
  const audio = context.createFlightAudio();
  return {
    audio, contexts, resumes, parameterChanges,
    get current() { return contexts.at(-1); },
    get wind() { return contexts.at(-1)?.gains[1]?.gain.value ?? 0; },
    get master() { return contexts.at(-1)?.gains[0]?.gain.value ?? 0; },
    get closeRejectionHandlers() { return closeRejectionHandlers; },
    async enable() {
      const pending = audio.setEnabled(true);
      resumes.at(-1).resolve();
      assert.equal(await pending, true);
    },
  };
}

test('disabled defaults and an explicit off request allocate no audio resources', async () => {
  const h = harness();
  h.audio.update(34, 6, true); h.audio.chime('pass');
  assert.equal(await h.audio.setEnabled(false), true);
  assert.equal(h.contexts.length, 0); assert.equal(h.resumes.length, 0);
});

test('enabling calls resume synchronously within the initiating user action', async () => {
  const h = harness();
  const pending = h.audio.setEnabled(true);
  assert.equal(h.contexts.length, 1);
  assert.equal(h.resumes.length, 1, 'The resume call must not be deferred beyond user activation.');
  assert.equal(h.current.noises.length, 1); assert.equal(h.current.noises[0].starts.length, 1);
  h.resumes[0].resolve(); assert.equal(await pending, true);
  h.audio.update(34, 6, true);
  assert.ok(h.wind > 0); assert.ok(h.master > 0);
});

test('the existing webkit AudioContext fallback remains usable', async () => {
  const h = harness({ legacy: true });
  await h.enable(); h.audio.update(34, 1, true);
  assert.ok(h.wind > 0); assert.ok(h.master > 0);
});

test('missing audio support reports failure without allocating or throwing', async () => {
  const h = harness({ absent: true });
  assert.equal(await h.audio.setEnabled(true), false);
  h.audio.update(34, 2, true); h.audio.chime('finish');
  assert.equal(h.contexts.length, 0);
  assert.doesNotThrow(() => h.audio.destroy());
});

test('AudioContext construction failure reports failure and leaves off usable', async () => {
  const h = harness({ constructorFailure: true });
  assert.equal(await h.audio.setEnabled(true), false);
  assert.equal(await h.audio.setEnabled(false), true);
  assert.equal(h.contexts.length, 0); assert.equal(h.resumes.length, 0);
});

test('a partial audio graph failure closes that graph and a later enable builds a complete replacement', async () => {
  const h = harness({ partialFailureOnce: true });
  assert.equal(await h.audio.setEnabled(true), false);
  const failed = h.current;
  const retry = h.audio.setEnabled(true);
  h.resumes.at(-1).resolve(); assert.equal(await retry, true);
  h.audio.update(34, 2, true); h.audio.chime('pass');
  assert.equal(h.contexts.length, 2, 'Retry must not reuse the incomplete graph.');
  assert.equal(failed.closeCalls, 1);
  assert.ok(failed.gains[0].disconnects > 0);
  assert.equal(h.current.noises.length, 1); assert.equal(h.current.noises[0].starts.length, 1);
  assert.equal(h.current.oscillators.length, 2);
  assert.ok(h.master > 0); assert.ok(h.wind > 0);
});

test('the latest resume rejection returns false and mutes wind and scheduled tones', async () => {
  const h = harness();
  await h.enable(); h.audio.update(34, 2, true); h.audio.chime('pass');
  assert.equal(h.current.oscillators.length, 2);
  const pending = h.audio.setEnabled(true);
  h.resumes.at(-1).reject(new Error('Authored latest resume failure'));
  assert.equal(await pending, false);
  h.audio.update(34, 2, true); h.audio.chime('finish');
  assert.equal(h.wind, 0); assert.equal(h.master, 0);
  assert.equal(h.current.oscillators.length, 2);
});

test('a pending on request cannot restore sound after a newer off intent', async () => {
  const h = harness();
  const pending = h.audio.setEnabled(true);
  assert.equal(await h.audio.setEnabled(false), true);
  h.resumes[0].resolve(); await pending;
  h.audio.update(34, 3, true); h.audio.chime('pass');
  assert.equal(h.wind, 0); assert.equal(h.master, 0);
  assert.equal(h.current.oscillators.length, 0);
});

test('on off on keeps the newest successful sound when the first resume rejects later', async () => {
  const h = harness();
  const older = h.audio.setEnabled(true);
  await h.audio.setEnabled(false);
  const newer = h.audio.setEnabled(true);
  assert.equal(h.contexts.length, 1, 'Overlapping activation requests share one owned context.');
  h.resumes[1].resolve(); assert.equal(await newer, true);
  h.audio.update(34, 3, true);
  h.resumes[0].reject(new Error('Authored obsolete failure')); await older;
  h.audio.update(34, 3, true); h.audio.chime('pass');
  assert.ok(h.wind > 0); assert.ok(h.master > 0);
  assert.equal(h.current.oscillators.length, 2);
});

test('an older rejection while the newest on is pending cannot disable that newer intent', async () => {
  const h = harness();
  const older = h.audio.setEnabled(true);
  await h.audio.setEnabled(false);
  const newer = h.audio.setEnabled(true);
  h.resumes[0].reject(new Error('Authored older failure')); await older;
  h.resumes[1].resolve(); assert.equal(await newer, true);
  h.audio.update(34, 3, true); h.audio.chime('pass');
  assert.ok(h.wind > 0); assert.ok(h.master > 0);
  assert.equal(h.current.oscillators.length, 2);
});

test('an obsolete success cannot restore sound after the latest activation failed', async () => {
  const h = harness();
  const older = h.audio.setEnabled(true), newer = h.audio.setEnabled(true);
  h.resumes[1].reject(new Error('Authored newest failure'));
  assert.equal(await newer, false);
  h.resumes[0].resolve(); await older;
  h.audio.update(34, 3, true); h.audio.chime('pass');
  assert.equal(h.wind, 0); assert.equal(h.master, 0);
  assert.equal(h.current.oscillators.length, 0);
});

test('active flight restores gain while pause and menu updates mute the complete audio graph', async () => {
  const h = harness(); await h.enable();
  h.audio.update(34, 3, true);
  assert.ok(h.wind > 0); assert.ok(h.master > 0);
  for (const inactive of [[34, 3, false], [0, 0, false]]) {
    h.audio.update(...inactive);
    assert.equal(h.wind, 0); assert.equal(h.master, 0);
    h.audio.update(34, 3, true);
    assert.ok(h.wind > 0); assert.ok(h.master > 0);
  }
});

test('pass chimes require active flight and all notes require enabled running audio', async () => {
  const h = harness(); await h.enable();
  h.audio.chime('pass'); assert.equal(h.current.oscillators.length, 0);
  h.audio.update(34, 2, true); h.current.state = 'suspended';
  h.audio.chime('pass'); h.audio.chime('finish'); assert.equal(h.current.oscillators.length, 0);
  h.current.state = 'running'; h.audio.chime('pass'); h.audio.chime('finish');
  assert.deepEqual(h.current.oscillators.map(tone => tone.frequency.value), [660, 880, 523, 659, 784]);
  assert.ok(h.current.oscillators.every(tone => tone.starts.length === 1 && tone.stops.length === 1));
  h.audio.update(34, 2, false); h.audio.chime('pass');
  assert.equal(h.current.oscillators.length, 5);
  await h.audio.setEnabled(false); h.audio.update(34, 2, true); h.audio.chime('finish');
  assert.equal(h.current.oscillators.length, 5);
});

test('an enabled running result can play its finish chime with wind off until the next inactive update', async () => {
  const h = harness(); await h.enable();
  h.audio.update(34, 2, false);
  assert.equal(h.wind, 0); assert.equal(h.master, 0);
  h.audio.chime('finish');
  assert.deepEqual(h.current.oscillators.map(tone => tone.frequency.value), [523, 659, 784]);
  assert.equal(h.wind, 0); assert.ok(h.master > 0);
  h.audio.update(0, 0, false);
  assert.equal(h.master, 0);
  await h.audio.setEnabled(false); h.audio.chime('finish');
  assert.equal(h.current.oscillators.length, 3);
  h.audio.destroy(); h.audio.chime('finish');
  assert.equal(h.current.oscillators.length, 3);
});

test('turning sound off immediately mutes tones that were already scheduled', async () => {
  const h = harness(); await h.enable();
  h.audio.update(34, 2, true); h.audio.chime('finish');
  assert.equal(h.current.oscillators.length, 3); assert.ok(h.master > 0);
  await h.audio.setEnabled(false);
  assert.equal(h.master, 0); assert.equal(h.wind, 0);
});

test('destroy fences a pending resume and every later update chime or enable attempt', async () => {
  const h = harness(), pending = h.audio.setEnabled(true);
  h.audio.destroy();
  const context = h.current, changes = h.parameterChanges.length;
  h.resumes[0].resolve(); await pending;
  h.audio.update(34, 4, true); h.audio.chime('finish');
  const resumeCount = h.resumes.length, lateEnable = h.audio.setEnabled(true);
  // Settle an obsolete implementation's unexpected request before asserting;
  // baseline sensitivity must fail behavior rather than leave a pending test.
  for (const gate of h.resumes.slice(resumeCount)) gate.resolve();
  assert.equal(await lateEnable, false);
  assert.equal(h.contexts.length, 1); assert.equal(h.resumes.length, 1);
  assert.equal(context.oscillators.length, 0); assert.equal(h.parameterChanges.length, changes);
  assert.equal(context.closeCalls, 1); assert.equal(context.noises[0].stops.length, 1);
});

test('destroy is idempotent and silences the graph before closing its owned context', async () => {
  const h = harness(); await h.enable(); h.audio.update(34, 2, true);
  h.audio.destroy(); h.audio.destroy();
  assert.ok(h.master === 0 || h.current.gains[0].disconnects > 0);
  assert.equal(h.current.closeCalls, 1);
  assert.ok(h.current.masterAtClose === 0 || h.current.masterDisconnectedAtClose > 0);
  assert.equal(h.current.noises[0].stops.length, 1);
});

test('destroy contains an asynchronous close rejection through an attached handler', async () => {
  const h = harness({ rejectedClose: true }); await h.enable();
  assert.doesNotThrow(() => h.audio.destroy());
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.current.closeCalls, 1);
  assert.ok(h.closeRejectionHandlers > 0, 'Closing audio must handle its asynchronous rejection.');
});

test('destroy before activation is terminal and cannot allocate a later audio context', async () => {
  const h = harness(); h.audio.destroy(); h.audio.destroy();
  const lateEnable = h.audio.setEnabled(true);
  for (const gate of h.resumes) gate.resolve();
  assert.equal(await lateEnable, false);
  h.audio.update(34, 3, true); h.audio.chime('pass');
  assert.equal(h.contexts.length, 0); assert.equal(h.resumes.length, 0);
});
