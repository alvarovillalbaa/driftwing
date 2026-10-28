// T2: the complete actual game module, including registered user/lifecycle
// callbacks, executes against controlled DOM/renderer/audio/storage/rAF edges.
// This does not run a browser, Web Audio, Canvas rendering or a backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as flightApi from '../public/src/flight.js';
import * as recordApi from '../public/src/records.js';

const gamePath = process.env.DRIFTWING_GAME_SOURCE || new URL('../public/src/game.js', import.meta.url);
const source = await readFile(gamePath, 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const elementMarkup = [...html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)];
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const flush = async () => { for (let count = 0; count < 12; count++) await Promise.resolve(); };
function preferences(sound = false) {
  return { course: 'ridge', sound, steady: true, records: { coast: { score: 1234, time: 87, passed: 7 }, cloudline: { score: 888, time: 99, passed: 5 } } };
}

function environment(initial = preferences()) {
  const nodes = new Map(), windowListeners = new Map(), documentListeners = new Map(), frames = new Map();
  const storage = new Map([['driftwing.v1', JSON.stringify(initial)], ['unrelated-game', 'preserve this value']]);
  const writes = [], audioCalls = [], updates = [], events = [], errors = [];
  let destroyed = 0, rendererDestroyed = 0, rendererRendered = 0, frameID = 0;
  function element(tag = 'div', id = '') {
    const attributes = new Map(), classes = new Set(), listeners = new Map(), small = { textContent: '' };
    const node = {
      id, tagName: tag.toUpperCase(), hidden: false, checked: false, open: false, textContent: '', dataset: {}, style: {},
      firstChild: { textContent: '' }, children: [],
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); },
      },
      setAttribute(name, value) { attributes.set(name, String(value)); }, getAttribute(name) { return attributes.get(name) ?? null; },
      append(...items) { node.children.push(...items); },
      addEventListener(name, callback) { const values = listeners.get(name) || []; values.push(callback); listeners.set(name, values); },
      dispatch(name, detail = {}) { return (listeners.get(name) || []).map(callback => callback({ target: node, currentTarget: node, preventDefault() {}, ...detail })); },
      focus() { document.activeElement = node; }, scrollIntoView() {},
      close() { node.open = false; }, showModal() { node.open = true; },
      querySelector(selector) { assert.equal(selector, 'small'); return small; },
      getBoundingClientRect() { return { width: 920, height: 640, left: 0, top: 0 }; },
      releasePointerCapture() {}, setPointerCapture() {},
    };
    return node;
  }
  for (const [markup, tag, id] of elementMarkup) {
    const node = element(tag, id); node.hidden = /\shidden(?:\s|=|>)/.test(markup); nodes.set(id, node);
  }
  const document = {
    body: element('body'), hidden: false, activeElement: null,
    getElementById(id) { assert.ok(nodes.has(id), 'Unmodeled game element: ' + id); return nodes.get(id); },
    createElement: tag => element(tag),
    addEventListener(name, callback) { const list = documentListeners.get(name) || []; list.push(callback); documentListeners.set(name, list); },
  };
  const audio = {
    setEnabled(next) {
      events.push({ type: 'setEnabled', enabled: Boolean(next) });
      const gate = deferred(), call = { enabled: Boolean(next), ...gate }; audioCalls.push(call);
      if (!next) gate.resolve(true); // The actual disable path needs no resume acknowledgement.
      return gate.promise;
    },
    update(airspeed, wind, flying) { updates.push({ airspeed, wind, flying }); events.push({ type: 'audio-update', flying }); },
    chime(type) { events.push({ type: 'chime', kind: type }); },
    destroy() { destroyed++; events.push({ type: 'audio-destroy' }); },
  };
  const context = vm.createContext({
    ...flightApi, ...recordApi, document, Math, Map, Set, String, Number, Boolean, Object, JSON, structuredClone,
    performance: { now: () => 1000 },
    console: { error(...args) { errors.push(args); } },
    window: {
      localStorage: {
        getItem(key) { return storage.get(key) ?? null; },
        setItem(key, value) { assert.equal(key, 'driftwing.v1'); storage.set(key, value); writes.push(JSON.parse(value)); events.push({ type: 'write', value: JSON.parse(value) }); },
      },
      matchMedia() { return { matches: false }; }, devicePixelRatio: 1,
      location: { reload() { throw new Error('Reload is outside sound checks.'); } },
      addEventListener(name, callback) { const list = windowListeners.get(name) || []; list.push(callback); windowListeners.set(name, list); },
    },
    createFlightAudio: () => audio,
    createRenderer: () => ({ resize() {}, render() { rendererRendered++; }, destroy() { rendererDestroyed++; } }),
    ResizeObserver: class { observe() {} },
    requestAnimationFrame(callback) { const id = ++frameID; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    fetch() { throw new Error('Network is forbidden in in-memory game checks.'); },
  });
  const stripped = source.replace(/^import [^\n]+;\s*$/gm, '');
  vm.runInContext(stripped + '\nglobalThis.actualGame = { start, toggleSound, pause, resume, menu, selectCourse, endFlight, replaceFlight: next => { flight = next; }, state: () => ({ save: structuredClone(save), mode, runNumber }) };',
    context, { filename: String(gamePath) });
  assert.deepEqual(errors, [], 'The actual game must complete bootstrap through controlled platform boundaries.');
  return {
    app: context.actualGame, nodes, storage, writes, audioCalls, updates, events, document,
    get destroyed() { return destroyed; }, get rendererDestroyed() { return rendererDestroyed; },
    get rendererRendered() { return rendererRendered; }, get scheduledFrames() { return frames.size; },
    runNextFrame(timestamp = 1016) {
      const next = frames.entries().next().value; assert.ok(next, 'The actual game must have scheduled a frame.');
      frames.delete(next[0]); next[1](timestamp);
    },
    click(id) { return nodes.get(id).dispatch('click'); },
    documentEvent(name) { for (const callback of documentListeners.get(name) || []) callback({}); },
    windowEvent(name, detail = {}) { for (const callback of windowListeners.get(name) || []) callback(detail); },
    observable() {
      return { state: plain(context.actualGame.state()), persisted: storage.get('driftwing.v1'), writes: writes.length,
        pressed: nodes.get('sound-button').getAttribute('aria-pressed'), label: nodes.get('sound-label').textContent,
        notice: nodes.get('flight-event').textContent, visible: nodes.get('flight-event').classList.contains('visible') };
    },
  };
}

test('sound preference, UI and durable intent commit before an enable acknowledgement', async () => {
  const h = environment(), pending = h.app.toggleSound();
  assert.equal(h.app.state().save.sound, true); assert.equal(h.nodes.get('sound-button').getAttribute('aria-pressed'), 'true');
  assert.equal(h.nodes.get('sound-label').textContent, 'Sound on'); assert.equal(JSON.parse(h.storage.get('driftwing.v1')).sound, true);
  assert.equal(h.audioCalls.length, 1); h.audioCalls[0].resolve(true); await pending;
});

test('a second toggle immediately disables an enable that is still waiting', async () => {
  const h = environment(), first = h.app.toggleSound(), off = h.app.toggleSound();
  assert.deepEqual(h.audioCalls.map(call => call.enabled), [true, false]);
  assert.equal(h.app.state().save.sound, false); assert.equal(h.nodes.get('sound-label').textContent, 'Sound off');
  assert.equal(JSON.parse(h.storage.get('driftwing.v1')).sound, false);
  h.audioCalls[0].resolve(true); await first; await off;
});

test('the actual sound-button callback invokes audio synchronously in the user callback', async () => {
  const h = environment(); h.click('sound-button');
  assert.equal(h.audioCalls.length, 1); assert.equal(h.audioCalls[0].enabled, true);
  h.audioCalls[0].resolve(true); await flush();
});

test('the actual launch callback invokes saved sound synchronously before yielding', async () => {
  const h = environment(preferences(true)); h.click('start-button');
  assert.equal(h.app.state().mode, 'flying'); assert.equal(h.audioCalls.length, 1); assert.equal(h.audioCalls[0].enabled, true);
  h.audioCalls[0].resolve(true); await flush();
});

for (const outcome of [true, false]) test(`on-off-on preserves newest success after obsolete enable result ${outcome}`, async () => {
  const h = environment(), first = h.app.toggleSound(), off = h.app.toggleSound(), latest = h.app.toggleSound();
  assert.deepEqual(h.audioCalls.map(call => call.enabled), [true, false, true]);
  h.audioCalls[2].resolve(true); await latest; await off; const before = h.observable();
  h.audioCalls[0].resolve(outcome); await first;
  assert.deepEqual(h.observable(), before); assert.equal(h.app.state().save.sound, true);
});

test('an obsolete success cannot acknowledge a newest enable that later fails', async () => {
  const h = environment(), first = h.app.toggleSound(), off = h.app.toggleSound(), latest = h.app.toggleSound();
  assert.deepEqual(h.audioCalls.map(call => call.enabled), [true, false, true]);
  const before = h.observable(); h.audioCalls[0].resolve(true); await first; await off;
  assert.deepEqual(h.observable(), before);
  h.audioCalls[2].resolve(false); await latest; assert.equal(h.app.state().save.sound, false);
  assert.match(h.nodes.get('flight-event').textContent, /sound.*unavailable/i);
});

for (const outcome of [true, false]) test(`a user disable survives an older enable result ${outcome}`, async () => {
  const h = environment(), first = h.app.toggleSound(), off = h.app.toggleSound();
  assert.deepEqual(h.audioCalls.map(call => call.enabled), [true, false]); await off;
  const before = h.observable(); h.audioCalls[0].resolve(outcome); await first;
  assert.deepEqual(h.observable(), before); assert.equal(h.app.state().save.sound, false);
});

test('a current enable failure resets preference, persists it and announces the failure', async () => {
  const h = environment(), pending = h.app.toggleSound(); h.audioCalls[0].resolve(false); await pending;
  assert.equal(h.app.state().save.sound, false); assert.equal(JSON.parse(h.storage.get('driftwing.v1')).sound, false);
  assert.equal(h.nodes.get('sound-button').getAttribute('aria-pressed'), 'false'); assert.equal(h.nodes.get('sound-label').textContent, 'Sound off');
  assert.match(h.nodes.get('flight-event').textContent, /sound.*unavailable/i); assert.equal(h.nodes.get('flight-event').classList.contains('visible'), true);
});

test('sound transitions preserve course, camera, every record and unrelated storage', async () => {
  const initial = preferences(), h = environment(initial), pending = h.app.toggleSound(); h.audioCalls[0].resolve(false); await pending;
  const { sound, ...expected } = initial;
  for (const written of h.writes) { const { sound: ignored, ...actual } = written; assert.deepEqual(actual, expected); }
  assert.equal(h.storage.get('unrelated-game'), 'preserve this value');
});

test('an old launch failure cannot disable sound after a newer flight has acknowledged it', async () => {
  const h = environment(preferences(true)), first = h.app.start(), latest = h.app.start(true);
  h.audioCalls[1].resolve(true); await latest; const before = h.observable(); h.audioCalls[0].resolve(false); await first;
  assert.deepEqual(h.observable(), before); assert.equal(h.app.state().save.sound, true);
});

test('an old launch failure cannot disable a newer off-on choice', async () => {
  const h = environment(preferences(true)), first = h.app.start(), off = h.app.toggleSound(), latest = h.app.toggleSound();
  assert.deepEqual(h.audioCalls.map(call => call.enabled), [true, false, true]);
  h.audioCalls[2].resolve(true); await latest; await off; const before = h.observable(); h.audioCalls[0].resolve(false); await first;
  assert.deepEqual(h.observable(), before);
});

test('an old launch success cannot update a newer run after its acknowledgement', async () => {
  const h = environment(preferences(true)), first = h.app.start(), latest = h.app.start();
  h.audioCalls[1].resolve(true); await latest; const before = h.observable(), updates = h.updates.length;
  h.audioCalls[0].resolve(true); await first; assert.deepEqual(h.observable(), before); assert.equal(h.updates.length, updates);
});

test('returning to the menu fences a pending launch failure', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.app.menu(); const before = h.observable();
  h.audioCalls[0].resolve(false); await pending; assert.deepEqual(h.observable(), before); assert.equal(h.app.state().mode, 'menu');
});

test('a successful pending launch stays muted after an explicit pause', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.click('pause-button'); const updates = h.updates.length;
  h.audioCalls[0].resolve(true); await pending;
  assert.equal(h.app.state().mode, 'paused'); assert.equal(h.app.state().save.sound, true);
  assert.equal(h.updates.slice(updates).some(update => update.flying), false);
});

test('a current failure while paused can still report unavailable sound', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.app.pause(); h.audioCalls[0].resolve(false); await pending;
  assert.equal(h.app.state().mode, 'paused'); assert.equal(h.app.state().save.sound, false);
  assert.match(h.nodes.get('flight-event').textContent, /sound.*(?:unavailable|could not start)/i);
});

test('visibility interruption keeps a late successful enable muted', async () => {
  const h = environment(); await h.app.start(); const pending = h.app.toggleSound(); h.document.hidden = true; h.documentEvent('visibilitychange');
  const updates = h.updates.length; h.audioCalls[0].resolve(true); await pending;
  assert.equal(h.app.state().mode, 'paused'); assert.equal(h.updates.slice(updates).some(update => update.flying), false);
});

test('a hidden document cannot become audible before its visibility callback is delivered', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.document.hidden = true; const updates = h.updates.length;
  h.audioCalls[0].resolve(true); await pending; assert.equal(h.updates.slice(updates).some(update => update.flying), false);
});

test('window blur pauses a pending launch without reviving sound when it resolves', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.windowEvent('blur'); const updates = h.updates.length;
  h.audioCalls[0].resolve(true); await pending; assert.equal(h.app.state().mode, 'paused');
  assert.equal(h.updates.slice(updates).some(update => update.flying), false);
});

test('back-forward cache hiding preserves sound intent while pausing output and retaining resources', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.windowEvent('pagehide', { persisted: true }); const updates = h.updates.length;
  h.audioCalls[0].resolve(true); await pending; h.windowEvent('pageshow', { persisted: true });
  assert.equal(h.app.state().mode, 'paused'); assert.equal(h.app.state().save.sound, true); assert.equal(h.destroyed, 0); assert.equal(h.rendererDestroyed, 0);
  assert.equal(h.updates.slice(updates).some(update => update.flying), false);
});

for (const outcome of [true, false]) test(`terminal pagehide ignores pending audio result ${outcome} after destroying resources`, async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.windowEvent('pagehide', { persisted: false });
  const before = h.observable(), updates = h.updates.length; h.audioCalls[0].resolve(outcome); await pending;
  assert.deepEqual(h.observable(), before); assert.equal(h.updates.length, updates); assert.equal(h.destroyed, 1); assert.equal(h.rendererDestroyed, 1);
});

test('stale user handlers cannot restart sound or persist another preference after terminal pagehide', async () => {
  const h = environment(); h.windowEvent('pagehide', { persisted: false }); const before = h.observable();
  const start = h.app.start(), toggle = h.app.toggleSound(), calls = h.audioCalls.length;
  for (const call of h.audioCalls) call.resolve(true);
  await start; await toggle; assert.equal(calls, 0); assert.deepEqual(h.observable(), before);
});

test('a queued animation frame cannot render or update sound after terminal pagehide', () => {
  const h = environment(); assert.equal(h.scheduledFrames, 1); h.windowEvent('pagehide', { persisted: false });
  const before = h.observable(), renders = h.rendererRendered, updates = h.updates.length;
  h.runNextFrame(); assert.equal(h.rendererRendered, renders); assert.equal(h.updates.length, updates);
  assert.equal(h.scheduledFrames, 0); assert.deepEqual(h.observable(), before);
});

function terminalFlight(status) {
  const course = flightApi.getCourse('ridge'), state = flightApi.createFlight(course.id);
  return { ...state, status, gateIndex: course.gates.length, passed: course.gates.length, score: 1200, time: 80,
    z: course.gates.at(-1).z + 20, lastEvent: { id: 1, type: status === 'finished' ? 'finish' : 'crash', text: 'Authored terminal fixture' } };
}

test('the actual finish flow mutes continuous flight audio before its one finish cue', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.audioCalls[0].resolve(true); await pending;
  h.app.replaceFlight(terminalFlight('finished')); const before = h.events.length; h.app.endFlight();
  const events = h.events.slice(before), muted = events.findIndex(event => event.type === 'audio-update' && event.flying === false);
  const chimes = events.map((event, index) => ({ event, index })).filter(item => item.event.type === 'chime');
  assert.equal(h.app.state().mode, 'result'); assert.ok(muted >= 0); assert.equal(chimes.length, 1);
  assert.equal(chimes[0].event.kind, 'finish'); assert.ok(chimes[0].index > muted);
});

test('a crashed flight enters its result flow without a finish cue', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.audioCalls[0].resolve(true); await pending;
  h.app.replaceFlight(terminalFlight('crashed')); const before = h.events.length; h.app.endFlight();
  assert.equal(h.app.state().mode, 'result'); assert.equal(h.events.slice(before).some(event => event.type === 'chime'), false);
  assert.equal(h.events.slice(before).some(event => event.type === 'audio-update' && event.flying === false), true);
});

test('window blur explicitly mutes a finished result cue even when there is no active flight to pause', async () => {
  const h = environment(preferences(true)), pending = h.app.start(); h.audioCalls[0].resolve(true); await pending;
  h.app.replaceFlight(terminalFlight('finished')); h.app.endFlight(); const updates = h.updates.length;
  h.windowEvent('blur'); assert.equal(h.app.state().mode, 'result');
  assert.equal(h.updates.slice(updates).some(update => update.flying === false), true);
});
