import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TITLES = [
  'desktop controls and native interruptions preserve a paused flight',
  'a real Coast flight earns a record that survives reload crash and free flight',
  'narrow native touch controls recover from corrupt preferences',
  'native storage unavailability keeps a completed flight playable without a saved claim',
];
const ORIGIN = 'https://driftwing-alvaro.vercel.app';
const KEY = 'driftwing.v1', SENTINEL_KEY = 'driftwing.authored-unrelated', SENTINEL = 'owned-gameplay-sentinel';
const ROUTES = new Set(['/', '/styles.css', '/favicon.svg', '/src/game.js', '/src/flight.js', '/src/renderer.js', '/src/audio.js', '/src/records.js']);
const workEnd = Date.now() + 420000;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clean = value => String(value ?? '').replace(/(?:https?:\/\/|file:\/\/)[^\s)]+/g, '[URL]').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 1000);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const report = { schemaVersion: 1, origin: ORIGIN, sourceCommit: process.env.SOURCE_COMMIT ?? null,
  expectedDeployment: process.env.DRIFTWING_EXPECTED_DEPLOYMENT ?? null, browserVersions: [], status: 'failed',
  cases: TITLES.map((title, index) => ({ id: `D0${index + 1}`, title, accepted: false, error: 'unrun', observations: {} })), errors: [], visuals: [],
  boundaries: { pageErrors: 0, consoleErrors: 0, unexpectedRequests: 0, credentialRequests: 0, webSockets: 0,
    requestFailures: 0, responseErrors: 0, unexpectedDialogs: 0, events: [] },
  cleanup: { browsersCreated: 0, browsersClosed: 0, browserClosed: false, contextsCreated: 0, contextsClosed: 0,
    cdpSessionsCreated: 0, cdpSessionsDetached: 0, cdpSessionsRemaining: 0, lateChecksComplete: false, fixtureCleanup: 'unverified', failures: [] },
  limits: { workSeconds: 420, cleanupSeconds: 60, stdoutSeconds: 2, reportBytes: 393216, visualBytesEach: 65536 },
  proofLimits: ['All flight progression uses real wall time and the actual animation loop; no clock installation, model import, state/score injection or DOM event synthesis.',
    'Headed Chromium under owned Xvfb exercises real keyboard, native tab focus/visibility and emulated touch. This is not a physical touchscreen, audible-output or performance acceptance claim.',
    'Only authored corruption of this app key and an unrelated authored sentinel are written as negative/setup data; no completed score or preference API is replaced.',
    'D04 uses a second Chromium with its native storage-disable switch and rejects a profile that still exposes usable localStorage.',
    'Two small DOM screenshot crops are retained for visual inspection; pixel statistics establish drawing, not full viewport appearance or a flight-simulation certification.',
    'The outer controller independently binds hosted assets/source and verifies attributable browser/Xvfb processes before deleting its scratch.'] };
let chromium, current, stage = 'preflight', cleanupEnd, root, child, identity, marker, interrupted = false, expired = false;
const browsers = [], contexts = [], sessions = [], jobs = new Set(), handlers = new Map();
function track(action) {
  const task = Promise.resolve().then(action); jobs.add(task); task.then(() => jobs.delete(task), () => jobs.delete(task)); return task;
}
async function within(action, maximum = 10000, label = 'operation', cleanup = false) {
  const end = Math.min(Date.now() + maximum, cleanup ? cleanupEnd : workEnd);
  assert(end > Date.now() && (cleanup || (!expired && !interrupted)), label + ': budget unavailable');
  let timer;
  try {
    const result = await Promise.race([track(action), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ': deadline')), end - Date.now()); })]);
    assert(Date.now() <= end, label + ': late completion'); return result;
  } finally { clearTimeout(timer); }
}
async function poll(action, label, maximum = 10000, spacing = 100) {
  const end = Math.min(Date.now() + maximum, workEnd);
  while (Date.now() < end && !expired && !interrupted) {
    if (await within(action, Math.max(1, end - Date.now()), label)) return;
    await delay(spacing);
  }
  throw new Error(label + ': not observed');
}
function mark(value) { stage = value; if (current) current.observations.stage = value; }
function boundary(kind, detail) {
  report.boundaries[kind]++;
  if (report.boundaries.events.length < 16) report.boundaries.events.push({ kind, stage, detail: clean(detail).slice(0, 300) });
}
function critical() { return Object.entries(report.boundaries).reduce((sum, [key, value]) => key === 'events' ? sum : sum + value, 0); }
async function mode(page, expected) { await poll(() => page.locator('body').getAttribute('data-mode').then(value => value === expected), 'mode ' + expected); }
async function click(page, selector, touch = false) { await within(() => touch ? page.locator(selector).tap() : page.locator(selector).click(), 10000, 'native control ' + selector); }
async function text(page, selector, expected, contains = false) {
  await poll(async () => { const actual = await page.locator(selector).textContent(); return contains ? actual?.includes(expected) : actual === expected; }, selector + ' text');
}
async function rawSaved(page) { return within(() => page.evaluate(key => localStorage.getItem(key), KEY), 5000, 'read authored profile save'); }
async function sentinel(page) { assert.equal(await within(() => page.evaluate(key => localStorage.getItem(key), SENTINEL_KEY), 5000, 'unrelated sentinel'), SENTINEL); }
async function seedSentinel(page) { await within(() => page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SENTINEL_KEY, value: SENTINEL }), 5000, 'once-only sentinel'); }
async function hud(page) {
  return within(() => page.evaluate(() => {
    const firstNumber = id => Number(document.getElementById(id).firstChild.textContent.trim().replaceAll(',', ''));
    const time = document.getElementById('flight-time').textContent.match(/^(\d+):(\d{2})/);
    return { mode: document.body.dataset.mode, altitude: firstNumber('altitude'), airspeed: firstNumber('airspeed'),
      passed: document.getElementById('progress-label').textContent === 'GATES' ? firstNumber('gate-progress') : null,
      distanceKm: document.getElementById('progress-label').textContent === 'DISTANCE' ? firstNumber('gate-progress') : null,
      score: Number(document.getElementById('score').textContent.replaceAll(',', '')), timeSeconds: time ? Number(time[1]) * 60 + Number(time[2]) : null,
      windLabel: document.getElementById('wind-label').textContent, windDetail: document.getElementById('wind-detail').textContent,
      nextGate: document.getElementById('next-gate').textContent };
  }), 5000, 'actual HUD');
}
async function freezePaused(page) {
  await mode(page, 'paused'); const before = await hud(page);
  await within(() => delay(650), 1200, 'real paused interval'); assert.deepEqual(await hud(page), before, 'paused HUD changed'); return before;
}
async function launch(profile, disabledStorage = false) {
  const browser = await within(() => chromium.launch({ headless: false, timeout: 20000, args: disabledStorage ? ['--disable-local-storage'] : [] }), 22000, 'headed browser launch');
  browsers.push({ browser, closed: false }); report.cleanup.browsersCreated++; report.browserVersions.push({ profile, version: browser.version() }); return browser;
}
async function cdpFor(context, page, profile) {
  return within(async () => {
    const session = await context.newCDPSession(page), item = { session, profile, detached: false };
    sessions.push(item); report.cleanup.cdpSessionsCreated++; return item;
  }, 10000, 'owned ' + profile + ' CDP');
}
async function contextFor(browser, narrow = false) {
  const context = await within(() => browser.newContext({ viewport: narrow ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    hasTouch: narrow, isMobile: narrow, locale: 'en-US', reducedMotion: 'no-preference', serviceWorkers: 'block', acceptDownloads: false }), 10000, 'new authored context');
  contexts.push({ context, closed: false }); report.cleanup.contextsCreated++;
  context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
  await within(() => context.route('**/*', async route => {
    try {
      const request = route.request(), url = new URL(request.url()), headers = await request.allHeaders();
      if (headers.authorization || headers.cookie) { boundary('credentialRequests', url.pathname); await route.abort(); return; }
      if (request.url() === 'about:blank' && request.isNavigationRequest()) { await route.continue(); return; }
      if (url.origin !== ORIGIN || url.search || !ROUTES.has(url.pathname) || !['GET', 'HEAD'].includes(request.method())) {
        boundary('unexpectedRequests', request.method() + ' ' + url.pathname); await route.abort(); return;
      }
      await route.continue();
    } catch (error) { boundary('unexpectedRequests', error.message); try { await route.abort(); } catch {} }
  }), 5000, 'closed request boundary');
  await within(() => context.routeWebSocket('**/*', route => { boundary('webSockets', 'unexpected websocket'); route.close(); }), 5000, 'websocket boundary');
  context.on('requestfailed', request => boundary('requestFailures', new URL(request.url()).pathname + ' ' + request.failure()?.errorText));
  context.on('response', response => { if (response.status() >= 400) boundary('responseErrors', response.status() + ' ' + new URL(response.url()).pathname); });
  context.on('page', page => {
    page.on('pageerror', error => boundary('pageErrors', error.message));
    page.on('console', message => { if (message.type() === 'error') boundary('consoleErrors', message.text()); });
    page.on('dialog', dialog => { boundary('unexpectedDialogs', dialog.type()); void track(() => dialog.dismiss()).catch(error => report.errors.push(clean(error.message))); });
  });
  return context;
}
async function visit(context) {
  const page = await within(() => context.newPage(), 10000, 'new game page');
  const response = await within(() => page.goto(ORIGIN + '/', { waitUntil: 'load' }), 15000, 'published game');
  assert.equal(response.status(), 200); assert.equal(response.url(), ORIGIN + '/'); await mode(page, 'menu');
  await poll(() => page.locator('#course-options button').count().then(count => count === 3), 'three actual courses');
  assert.equal(await page.locator('#error-overlay').isVisible(), false); await within(() => page.bringToFront(), 5000, 'game foreground'); return page;
}
async function chooseCoast(page, touch = false) { await click(page, '#course-options button[aria-label="Coast: Find the rising air"]', touch); await text(page, '#course-position', '01 / 03'); }
async function start(page, free = false, touch = false) { await click(page, free ? '#free-button' : '#start-button', touch); await mode(page, 'flying'); }
async function result(page) {
  return within(() => page.evaluate(() => {
    const time = document.getElementById('result-time').textContent, gates = document.getElementById('result-gates').textContent;
    return { title: document.getElementById('result-title').textContent, message: document.getElementById('result-message').textContent,
      score: Number(document.getElementById('result-score').textContent.replaceAll(',', '')), gates, time,
      liftSeconds: Number.parseInt(document.getElementById('result-lift').textContent, 10), recordMessage: document.getElementById('record-message').textContent };
  }), 5000, 'actual result');
}
async function completeCoast(page, visual = false) {
  let minimumAltitude = Infinity, recoveredInLift = false, sawRisingAir = false, sawTwoGates = false, screenshotTaken = false, samples = 0;
  const first = await hud(page); assert(first.mode === 'flying');
  await poll(async () => {
    const sample = await hud(page); samples++; assert(samples <= 1000, 'flight observation bound');
    minimumAltitude = Math.min(minimumAltitude, sample.altitude);
    if (sample.windLabel.startsWith('Rising air +')) { sawRisingAir = true; if (sample.altitude >= minimumAltitude + 2) recoveredInLift = true; }
    if (sample.mode === 'flying' && sample.passed >= 2 && sample.score > 0) sawTwoGates = true;
    if (visual && !screenshotTaken && sample.mode === 'flying' && sample.passed >= 1) { await visualCrop(page, 'D02'); screenshotTaken = true; }
    return sample.mode === 'result';
  }, 'real neutral Coast completion', 95000, 150);
  const actual = await result(page); assert.equal(actual.title, 'A flight to remember.'); assert.match(actual.message, /through Coast\./);
  const gates = /^(\d+) \/ 7$/.exec(actual.gates); assert(gates && Number(gates[1]) >= 2); assert(actual.score > 200);
  assert(sawTwoGates && sawRisingAir && recoveredInLift && actual.liftSeconds > 0, 'actual scored flight and thermal altitude recovery required');
  assert(!visual || screenshotTaken); return { ...actual, observedGatePassBeforeFinish: true, sawRisingAir, minimumAltitude, recoveredInLift, samples };
}
async function drawing(page) {
  const observed = await within(() => page.locator('#sky').evaluate(canvas => {
    const context = canvas.getContext('2d'), width = canvas.width, height = canvas.height, colors = new Set(), bytes = [];
    if (!context || width < 1 || height < 1) throw new Error('canvas unavailable');
    for (let y = 1; y <= 16; y++) for (let x = 1; x <= 20; x++) {
      const pixel = context.getImageData(Math.min(width - 1, Math.floor(x * width / 21)), Math.min(height - 1, Math.floor(y * height / 17)), 1, 1).data;
      bytes.push(...pixel); colors.add([...pixel].join(','));
    }
    return { width, height, colors: colors.size, bytes };
  }), 5000, 'actual Canvas pixels');
  assert(observed.colors >= 12, 'canvas must have visible drawn variation'); return { width: observed.width, height: observed.height, sampleColors: observed.colors, sampleSha256: sha(Buffer.from(observed.bytes)) };
}
async function visualCrop(page, caseId) {
  assert(!report.visuals.some(item => item.caseId === caseId) && report.visuals.length < 2);
  const bounds = await within(() => page.locator('#sky').boundingBox(), 5000, 'canvas screenshot bounds'); assert(bounds && bounds.width >= 320 && bounds.height >= 240);
  const viewport = page.viewportSize(), minimumX = Math.ceil(Math.max(0, bounds.x)), maximumX = Math.floor(Math.min(viewport.width, bounds.x + bounds.width) - 320);
  const minimumY = Math.ceil(Math.max(0, bounds.y)), maximumY = Math.floor(Math.min(viewport.height, bounds.y + bounds.height) - 240);
  assert(maximumX >= minimumX && maximumY >= minimumY, 'canvas crop not visible');
  const clip = { x: Math.round(Math.max(minimumX, Math.min(maximumX, bounds.x + bounds.width * 0.5 - 160))),
    y: Math.round(Math.max(minimumY, Math.min(maximumY, bounds.y + bounds.height * 0.65 - 120))), width: 320, height: 240 };
  const bytes = await within(() => page.screenshot({ type: 'jpeg', quality: 35, scale: 'css', clip }), 10000, 'actual DOM screenshot crop');
  assert(bytes.length > 0 && bytes.length <= 65536, 'visual byte bound');
  report.visuals.push({ caseId, kind: 'canvas-dom-crop', width: 320, height: 240, mimeType: 'image/jpeg', bytes: bytes.length,
    sha256: sha(bytes), dataBase64: bytes.toString('base64'), clip, hud: await hud(page) });
}
async function caseRun(index, action) {
  current = report.cases[index]; const begun = Date.now(); mark('setup ' + current.id);
  try { Object.assign(current.observations, await action()); assert.equal(critical(), 0, 'unexpected browser/network error'); current.accepted = true; current.error = null; }
  catch (error) { current.error = clean(error.message); throw error; }
  finally { current.durationMs = Date.now() - begun; }
}
function owner() {
  const current = fs.lstatSync(child), file = path.join(child, 'owner'), token = fs.lstatSync(file);
  assert(path.dirname(child) === root && current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino
    && current.uid === process.getuid() && token.isFile() && !token.isSymbolicLink() && token.uid === process.getuid() && fs.readFileSync(file, 'utf8') === marker);
  assert.deepEqual(fs.readdirSync(child), ['owner']);
}
const interrupt = () => { interrupted = true; for (const item of contexts) void track(() => item.context.close()).catch(() => {}); };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) { handlers.set(signal, interrupt); process.on(signal, interrupt); }
const workTimer = setTimeout(() => { expired = true; for (const item of contexts) void track(() => item.context.close()).catch(() => {}); }, Math.max(1, workEnd - Date.now()));
try {
  assert.equal(process.env.CI, 'true'); assert(process.env.DISPLAY && process.env.DISPLAY.length < 100, 'owned headed display required');
  assert.equal(process.env.DRIFTWING_CHECK_ORIGIN, ORIGIN); assert(/^[a-f0-9]{40}$/.test(report.sourceCommit ?? '')); assert(/^dpl_[A-Za-z0-9]+$/.test(report.expectedDeployment ?? ''));
  root = fs.realpathSync(process.env.DRIFTWING_CHECK_ROOT ?? ''); assert(path.isAbsolute(root) && fs.statSync(root).isDirectory() && fs.statSync(root).uid === process.getuid());
  child = fs.mkdtempSync(path.join(root, 'driftwing-driver-')); fs.chmodSync(child, 0o700); identity = fs.lstatSync(child); marker = randomUUID(); fs.writeFileSync(path.join(child, 'owner'), marker, { flag: 'wx', mode: 0o600 });
  const moduleInput = process.env.DRIFTWING_PLAYWRIGHT_MODULE ?? '', moduleFile = moduleInput.startsWith('file:') ? fileURLToPath(moduleInput) : moduleInput;
  assert(path.isAbsolute(moduleFile)); const item = fs.lstatSync(moduleFile); assert(item.isFile() && !item.isSymbolicLink() && item.size <= 1048576);
  ({ chromium } = await import(pathToFileURL(moduleFile).href)); const mainBrowser = await launch('normal');
  await caseRun(0, async () => {
    const context = await contextFor(mainBrowser), page = await visit(context); await seedSentinel(page);
    const mainFocus = await cdpFor(context, page, 'native-focus-main');
    await within(() => mainFocus.session.send('Emulation.setFocusEmulationEnabled', { enabled: false }), 5000, 'restore native game focus');
    await within(() => page.bringToFront(), 5000, 'native main foreground');
    for (const [name, position] of [['Ridge: Lean into the crosswind', '02 / 03'], ['Cloudline: Ride the changing breeze', '03 / 03'], ['Coast: Find the rising air', '01 / 03']]) {
      await click(page, `#course-options button[aria-label="${name}"]`); await text(page, '#course-position', position);
      assert.equal(await page.locator(`#course-options button[aria-label="${name}"]`).getAttribute('aria-pressed'), 'true');
    }
    await click(page, '#sound-button');
    await poll(async () => await page.locator('#sound-button').getAttribute('aria-pressed') === 'true' || (await page.locator('#flight-event').textContent()).includes('Sound is unavailable'), 'native sound intent or explicit unavailability');
    const soundOutcome = await page.locator('#sound-button').getAttribute('aria-pressed') === 'true' ? 'on-then-off-ui-only' : 'explicit-native-unavailability';
    if (soundOutcome === 'on-then-off-ui-only') await click(page, '#sound-button');
    await text(page, '#sound-label', 'Sound off'); assert.equal(JSON.parse(await rawSaved(page)).sound, false);
    await start(page); await poll(() => page.evaluate(() => !document.hidden && document.hasFocus()), 'native initial focus');
    const initial = await hud(page); await within(() => page.keyboard.down('ArrowUp'), 5000, 'real climb key');
    await poll(async () => (await hud(page)).altitude >= initial.altitude + 5, 'real climb response', 8000);
    await within(() => page.keyboard.up('ArrowUp'), 5000, 'release climb key'); const climbed = await hud(page); assert(climbed.airspeed < 34);
    await within(() => page.keyboard.press('r'), 5000, 'fresh neutral restart before bank'); await mode(page, 'flying');
    await within(() => page.keyboard.down('ArrowRight'), 5000, 'real bank key');
    await poll(async () => { const sample = await hud(page); assert.equal(sample.mode, 'flying'); return sample.airspeed <= 33 && sample.timeSeconds >= 3; }, 'real bank drag response', 8000);
    await within(() => page.keyboard.up('ArrowRight'), 5000, 'release bank key'); const banked = await hud(page);
    await within(() => page.keyboard.press('r'), 5000, 'native R restart'); await mode(page, 'flying'); const restarted = await hud(page); assert.equal(restarted.timeSeconds, 0); assert.equal(restarted.passed, 0);
    await within(() => page.keyboard.press('p'), 5000, 'native pause key'); const paused = await freezePaused(page);
    await within(() => page.keyboard.press('Escape'), 5000, 'native resume key'); await mode(page, 'flying');
    await click(page, '#help-button'); assert.equal(await page.locator('#help-dialog').evaluate(element => element.open && element.matches(':modal')), true);
    const guidePaused = await freezePaused(page); await click(page, '#guide-done'); await mode(page, 'paused'); await click(page, '#resume-button'); await mode(page, 'flying');
    mark('real owned-tab visibility and blur interruption');
    const other = await within(() => context.newPage(), 10000, 'owned blank tab'); await within(() => other.goto('about:blank'), 10000, 'owned blank navigation');
    const otherFocus = await cdpFor(context, other, 'native-focus-blank');
    await within(() => otherFocus.session.send('Emulation.setFocusEmulationEnabled', { enabled: false }), 5000, 'restore native other-tab focus');
    await within(() => other.bringToFront(), 5000, 'native other tab foreground');
    await poll(() => page.evaluate(() => document.hidden && !document.hasFocus()), 'actual hidden and unfocused transition');
    const hiddenPaused = await freezePaused(page);
    await within(() => page.bringToFront(), 5000, 'native return to game tab'); await poll(() => page.evaluate(() => !document.hidden && document.hasFocus()), 'actual visible focused return'); await mode(page, 'paused');
    await within(() => otherFocus.session.detach(), 5000, 'blank focus CDP detach'); otherFocus.detached = true; report.cleanup.cdpSessionsDetached++;
    await within(() => other.close(), 5000, 'close owned blank tab'); await click(page, '#resume-button'); await mode(page, 'flying');
    await poll(async () => (await hud(page)).timeSeconds >= restarted.timeSeconds + 1, 'flight continues after actual interruption');
    const pixels = await drawing(page); await click(page, '#pause-button'); await mode(page, 'paused'); await click(page, '#pause-menu-button'); await mode(page, 'menu'); await sentinel(page);
    return { profile: 'headed-desktop1440x1000-realtime', courseChoices: 3, initial, climbed, banked, restarted, paused, guidePaused, hiddenPaused,
      actualHiddenAndBlurObserved: true, actualVisibleFocusReturn: true, focusProfile: 'Playwright focus emulation disabled on both owned tabs', focusCdpSessions: 2,
      nativeSoundOutcome: soundOutcome, acousticOutputVerified: false, pixels, unrelatedStoragePreserved: true };
  });
  await caseRun(1, async () => {
    const context = await contextFor(mainBrowser), page = await visit(context); await seedSentinel(page); await chooseCoast(page); await start(page);
    await within(() => page.keyboard.down('ArrowRight'), 5000, 'initial held bank'); await within(() => page.keyboard.down('ArrowUp'), 5000, 'initial held pitch');
    await within(() => delay(650), 1500, 'initial real input interval'); await within(() => page.keyboard.press('r'), 5000, 'real R clears first controls');
    await within(() => page.keyboard.up('ArrowRight'), 5000, 'release initial bank'); await within(() => page.keyboard.up('ArrowUp'), 5000, 'release initial pitch');
    const reset = await hud(page); assert.equal(reset.passed, 0); assert.equal(reset.timeSeconds, 0);
    mark('actual neutral scored Coast flight'); const completed = await completeCoast(page, true), frozen = await result(page);
    await within(() => delay(700), 1500, 'terminal result interval'); assert.deepEqual(await result(page), frozen);
    assert.equal(completed.recordMessage, 'A new personal best. Saved on this device.'); const savedRaw = await rawSaved(page), record = JSON.parse(savedRaw).records.coast;
    assert.equal(record.score, completed.score); assert.equal(record.passed, Number(completed.gates.split('/')[0].trim()));
    assert.equal(completed.time, `${Math.floor(record.time / 60)}:${String(Math.floor(record.time % 60)).padStart(2, '0')}`); assert(record.time > 40 && record.time < 60);
    const recordBytes = JSON.stringify(JSON.parse(savedRaw).records); await within(() => page.reload({ waitUntil: 'load' }), 15000, 'real record reload'); await mode(page, 'menu');
    assert.equal(await rawSaved(page), savedRaw); await text(page, '#record-note', `Your best completed flight: ${record.score.toLocaleString('en-US')} points`, true); await sentinel(page);
    mark('deliberate real dive crash must preserve the earned record'); await start(page); await within(() => page.keyboard.down('ArrowDown'), 5000, 'real dive input');
    try { await modeResultWithin(page, 20000); } finally { await within(() => page.keyboard.up('ArrowDown'), 5000, 'release dive'); }
    const crashed = await result(page); assert.equal(crashed.title, 'Every flight teaches you.'); assert.match(crashed.message, /^Ground contact\./); assert.equal(crashed.recordMessage, 'Only completed courses become course records.');
    assert.equal(JSON.stringify(JSON.parse(await rawSaved(page)).records), recordBytes); await click(page, '#result-menu-button'); await mode(page, 'menu');
    mark('actual free flight continues beyond the course finish'); await start(page, true);
    await poll(async () => { const sample = await hud(page); assert.equal(sample.mode, 'flying'); return sample.distanceKm >= 1.5 && sample.timeSeconds >= 46; }, 'real free flight past 1470 metres', 95000, 200);
    const free = await hud(page); assert.equal(free.passed, null); assert.equal(free.score, 0); assert.equal(free.nextGate, 'Find your own line'); assert(free.timeSeconds >= 46);
    assert.equal(JSON.stringify(JSON.parse(await rawSaved(page)).records), recordBytes); await click(page, '#pause-button'); await mode(page, 'paused'); await click(page, '#pause-menu-button'); await mode(page, 'menu'); await sentinel(page);
    return { profile: 'headed-desktop1440x1000-realtime', actualRestartClearedInput: true, reset, completed, terminalResultFrozen: true,
      recordReloadExact: true, savedRecord: record, savedRawSha256: sha(savedRaw), crash: crashed, free, recordBytesSha256: sha(recordBytes), unrelatedStoragePreserved: true, pixels: await drawing(page) };
  });
  await caseRun(2, async () => {
    const context = await contextFor(mainBrowser, true), page = await visit(context); await seedSentinel(page);
    const corrupt = '{authored-invalid-driftwing-json'; await within(() => page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: corrupt }), 5000, 'authored corrupt own preference');
    await within(() => page.reload({ waitUntil: 'load' }), 15000, 'real corrupt preference reload'); await mode(page, 'menu');
    assert.equal(await rawSaved(page), corrupt); assert.equal(await page.locator('#storage-notice').isVisible(), true); await sentinel(page);
    await click(page, '#course-options button[aria-label="Ridge: Lean into the crosswind"]', true); await text(page, '#course-position', '02 / 03');
    assert.equal(JSON.parse(await rawSaved(page)).course, 'ridge'); assert.deepEqual(JSON.parse(await rawSaved(page)).records, {}); assert.equal(await page.locator('#storage-notice').isVisible(), false);
    await chooseCoast(page, true); await start(page, false, true);
    const ownedSession = await cdpFor(context, page, 'native-touch'), session = ownedSession.session;
    const box = await within(() => page.locator('#stick-area').boundingBox(), 5000, 'actual stick bounds'); assert(box && box.width >= 100 && box.height >= 100);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }, radius = box.width * 0.34;
    const send = (type, points) => within(() => session.send('Input.dispatchTouchEvent', { type, touchPoints: points }), 5000, 'native ' + type);
    const before = await hud(page); await send('touchStart', [{ ...center, id: 1 }]); await send('touchMove', [{ x: center.x + radius * 0.45, y: center.y - radius * 0.85, id: 1 }]);
    await poll(async () => (await hud(page)).altitude >= before.altitude + 4, 'actual touch climb response', 8000);
    const dragged = await page.locator('#stick-knob').evaluate(element => element.style.transform); assert.notEqual(dragged, 'translate(0px, 0px)'); const climbing = await hud(page); await visualCrop(page, 'D03');
    await send('touchEnd', []); await poll(() => page.locator('#stick-knob').evaluate(element => element.style.transform === 'translate(0px, 0px)'), 'native touch release reset');
    await send('touchStart', [{ ...center, id: 2 }]); await send('touchMove', [{ x: center.x - radius * 0.8, y: center.y, id: 2 }]);
    assert.notEqual(await page.locator('#stick-knob').evaluate(element => element.style.transform), 'translate(0px, 0px)'); await send('touchCancel', []);
    await poll(() => page.locator('#stick-knob').evaluate(element => element.style.transform === 'translate(0px, 0px)'), 'native touch cancel reset');
    await click(page, '#pause-button', true); const paused = await freezePaused(page); await click(page, '#resume-button', true); await mode(page, 'flying');
    await click(page, '#pause-button', true); await click(page, '#restart-button', true); await mode(page, 'flying'); const restarted = await hud(page); assert.equal(restarted.passed, 0); assert.equal(restarted.timeSeconds, 0);
    const layout = await within(() => page.evaluate(() => { const stick = document.getElementById('stick-area').getBoundingClientRect(), pause = document.getElementById('pause-button').getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, maxTouchPoints: navigator.maxTouchPoints,
        controls: [stick, pause].map(rect => ({ x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height })) }; }), 5000, 'actual narrow layout');
    assert.equal(layout.width, 390); assert.equal(layout.height, 844); assert(layout.maxTouchPoints > 0 && layout.scrollWidth <= 391);
    for (const control of layout.controls) assert(control.x >= 0 && control.right <= 391 && control.y >= 0 && control.bottom <= 845 && control.width >= 44 && control.height >= 44);
    const pixels = await drawing(page); await click(page, '#pause-button', true); await click(page, '#pause-menu-button', true); await mode(page, 'menu'); await sentinel(page);
    await within(() => session.detach(), 5000, 'touch CDP detach'); ownedSession.detached = true; report.cleanup.cdpSessionsDetached++;
    return { profile: 'headed390x844-touch-emulation-realtime', corruptRawPreservedUntilExplicitPreference: true, actualPreferenceWriteRecovered: true,
      before, climbing, dragged, nativeReleaseReset: true, nativeCancelReset: true, paused, restarted, layout, pixels, unrelatedStoragePreserved: true };
  });
  await caseRun(3, async () => {
    const isolated = await launch('storage-disabled', true), context = await contextFor(isolated), page = await visit(context);
    const unavailable = await nativeStorageProbe(page); assert(unavailable.getterUnavailable && unavailable.writeUnavailable, 'native storage-disable profile not effective');
    assert.equal(await page.locator('#storage-notice').isVisible(), true); await chooseCoast(page); await start(page);
    mark('real complete flight with native storage unavailable'); const completed = await completeCoast(page);
    assert.equal(completed.recordMessage, 'A new personal best for this visit.'); assert(!completed.recordMessage.includes('Saved'));
    await click(page, '#result-menu-button'); await mode(page, 'menu'); await text(page, '#record-note', 'Your best this visit:', true);
    await within(() => page.reload({ waitUntil: 'load' }), 15000, 'native unavailable-storage reload'); await mode(page, 'menu');
    const afterReload = await nativeStorageProbe(page); assert(afterReload.getterUnavailable && afterReload.writeUnavailable);
    await text(page, '#record-note', 'No account. Just you and the air.'); assert.equal(await page.locator('#storage-notice').isVisible(), true);
    await start(page); await poll(async () => (await hud(page)).timeSeconds >= 1, 'still playable after unavailable-storage reload'); await click(page, '#pause-button'); await mode(page, 'paused');
    return { profile: 'second-headed-Chromium-native-disable-local-storage-realtime', nativeStorage: unavailable, completed, visitOnlyMessageObserved: true,
      noSavedClaim: true, afterReload, recordAbsentAfterReload: true, playAfterReload: true, pixels: await drawing(page) };
  });
} catch (error) { report.errors.push(clean(error.message)); }
finally {
  cleanupEnd = Math.min(Date.now() + 60000, workEnd + 60000); current = null;
  for (const item of sessions) if (!item.detached) {
    try { await within(() => item.session.detach(), 4000, 'remaining touch CDP detach', true); item.detached = true; report.cleanup.cdpSessionsDetached++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  for (const item of [...contexts].reverse()) {
    try { await within(() => item.context.close(), 8000, 'context close', true); item.closed = true; report.cleanup.contextsClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  for (const item of [...browsers].reverse()) {
    try { await within(() => item.browser.close(), 10000, 'browser close', true); item.closed = true; report.cleanup.browsersClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  const settleEnd = Math.min(Date.now() + 5000, cleanupEnd); while (jobs.size && Date.now() < settleEnd) await delay(25);
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  report.cleanup.cdpSessionsRemaining = sessions.filter(item => !item.detached).length;
  report.cleanup.browserClosed = browsers.length > 0 && browsers.every(item => item.closed); report.cleanup.lateChecksComplete = jobs.size === 0;
  if (child && report.cleanup.browserClosed && contexts.every(item => item.closed) && jobs.size === 0 && report.cleanup.cdpSessionsRemaining === 0) {
    try { owner(); fs.rmSync(child, { recursive: true }); assert(!fs.existsSync(child)); report.cleanup.fixtureCleanup = 'passed'; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  if (critical()) report.errors.push('unexpected browser/network error, including late observations');
  if (interrupted || expired || Date.now() > workEnd + 60000) report.errors.push(interrupted ? 'interrupted' : 'work or cleanup deadline');
  if (report.cleanup.browsersCreated !== report.cleanup.browsersClosed || report.cleanup.contextsCreated !== report.cleanup.contextsClosed
    || !report.cleanup.browserClosed || !report.cleanup.lateChecksComplete || report.cleanup.cdpSessionsRemaining || report.cleanup.fixtureCleanup !== 'passed' || report.cleanup.failures.length) report.errors.push('resource cleanup unverified');
  if (report.cases.every(item => item.accepted) && (report.cleanup.browsersCreated !== 2 || report.cleanup.contextsCreated !== 4
    || report.cleanup.cdpSessionsCreated !== 3 || report.cleanup.cdpSessionsDetached !== 3 || report.visuals.length !== 2)) report.errors.push('full scope not observed');
  report.status = report.cases.every(item => item.accepted) && !report.errors.length ? 'passed' : 'failed';
  let result = JSON.stringify(report);
  if (Buffer.byteLength(result) > 393216) { report.status = 'failed'; result = JSON.stringify({ schemaVersion: 1, origin: ORIGIN, status: 'failed', cases: report.cases.map(({ id, title }) => ({ id, title, accepted: false, error: 'report limit', observations: {} })), errors: ['report limit'], cleanup: report.cleanup }); }
  const outputEnd = Math.min(Date.now() + 2000, workEnd + 62000), timer = setTimeout(() => process.exit(1), Math.max(1, outputEnd - Date.now()));
  process.stdout.write('DRIFTWING_BROWSER_DRIVER=' + result + '\n', () => {
    clearTimeout(timer); clearTimeout(workTimer); for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    process.exit(report.status === 'passed' && !interrupted && !expired && Date.now() <= outputEnd ? 0 : 1);
  });
}
async function modeResultWithin(page, maximum) { await poll(() => page.locator('body').getAttribute('data-mode').then(value => value === 'result'), 'deliberate flight end', maximum); }
async function nativeStorageProbe(page) {
  return within(() => page.evaluate(() => {
    let getterUnavailable = false, getterError = null, writeUnavailable = false, writeError = null;
    try { getterUnavailable = window.localStorage == null; } catch (error) { getterUnavailable = true; getterError = error.name; }
    try { window.localStorage.setItem('driftwing.authored-probe', 'owned'); writeUnavailable = window.localStorage.getItem('driftwing.authored-probe') !== 'owned';
      if (!writeUnavailable) window.localStorage.removeItem('driftwing.authored-probe'); } catch (error) { writeUnavailable = true; writeError = error.name; }
    return { getterUnavailable, getterError, writeUnavailable, writeError };
  }), 5000, 'actual native storage capability probe');
}
