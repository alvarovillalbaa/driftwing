import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, inflateSync } from 'node:zlib';

const TITLES = [
  "six generated maps saved replay faster keyboard flight and native interruptions",
  "six visually piloted generated flights earn replay progression and persistent records",
  "narrow real touch roll stick release and corrupt preference recovery",
  "native disabled storage permits an actually completed generated flight"
];
const CASE_IDS=['L01','L02','L03','L04'];
const selected=new Set((process.env.DRIFTWING_GENERATED_CASES||CASE_IDS.join(',')).split(','));
assert.ok(selected.size&&[...selected].every(id=>CASE_IDS.includes(id)));

const ORIGIN = process.env.DRIFTWING_CHECK_ORIGIN;
assert.match(ORIGIN,/^http:\/\/127\.0\.0\.1:\d+$/);
const KEY = 'driftwing.v1', SENTINEL_KEY = 'driftwing.authored-unrelated', SENTINEL = 'owned-gameplay-sentinel';
const ROUTES = new Set(['/', '/styles.css', '/favicon.svg', '/src/game.js', '/src/flight.js', '/src/renderer.js', '/src/audio.js', '/src/records.js']);
const workSeconds=Number(process.env.DRIFTWING_WORK_SECONDS??450);
assert.ok(Number.isInteger(workSeconds)&&workSeconds>=30&&workSeconds<=450);
const workEnd = Date.now() + workSeconds*1000;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clean = value => String(value ?? '').replace(/(?:https?:\/\/|file:\/\/|wss?:\/\/)[^\s)]+/g, '[URL]').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 1000);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const report = { schemaVersion: 1, origin: ORIGIN, sourceCommit: process.env.SOURCE_COMMIT ?? null,
  expectedDeployment: process.env.DRIFTWING_EXPECTED_DEPLOYMENT ?? null, browserVersions: [], status: 'failed',
  cases: TITLES.map((title,index)=>({id:CASE_IDS[index],title,accepted:false,error:'unrun',observations:{}})).filter(c=>selected.has(c.id)), errors: [], visuals: [],
  boundaries: { pageErrors: 0, consoleErrors: 0, unexpectedRequests: 0, credentialRequests: 0, webSockets: 0,
    requestFailures: 0, responseErrors: 0, unexpectedDialogs: 0, events: [] },
  cleanup: { browsersCreated: 0, browsersClosed: 0, browserClosed: false, contextsCreated: 0, contextsClosed: 0,
    cdpSessionsCreated: 0, cdpSessionsDetached: 0, cdpSessionsClosedWithBrowser: 0, cdpSessionsRemaining: 0, lateChecksComplete: false, fixtureCleanup: 'unverified', failures: [] },
  limits: { workSeconds, cleanupSeconds: 60, stdoutSeconds: 2, reportBytes: 393216, visualBytesEach: 2097152 },
  proofLimits: ["Real unmodified animation/wall clock; no application/model import, private state, score fixture or synthetic DOM events.","One headed native-default noDefaults CDP profile observes real tab visibility/focus. Three independent managed full Chromium processes use actual native input and exit0/absence closure.","The visual pilot reads only actual Canvas next-ring accent components and public HUD distance. Its screen-space aim curve is a camera calibration, not a flight-state simulator.","Whole original viewport PNGs are retained separately; automated pixels are not human visual, physical-device, acoustic or performance acceptance.","Authored corrupt owned JSON and unrelated one-time sentinels are the only injected storage fixtures. Actual course records are earned through controls.","Prior native/scientific/source receipts remain bound to original sources; this generated edition and anonymous hosted publication are separate.","The new short free entry does not qualify beyond-finish native generated free flight. Unchanged range/physics constraints have their separately pinned Node evidence.","Nested original-native diagnostic source is sanitized as declared by the existing helper; native raw stderr is not independently archived."] };
let diagnosticPage=null;
let chromium, current, stage = 'preflight', cleanupEnd, root, child, identity, marker, interrupted = false, expired = false, nativeChrome;
const browsers = [], contexts = [], sessions = [], jobs = new Set(), handlers = new Map();
report.profileClosures=[];
const proof=process.env.DRIFTWING_OUTPUT;
assert.ok(path.isAbsolute(proof)&&fs.statSync(proof).isDirectory());
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
async function launch(profile,disabledStorage=false){
 const server=await within(()=>chromium.launchServer({headless:false,channel:'chromium',timeout:20000,args:disabledStorage?['--disable-local-storage']:[]}),22000,'owned headed Chromium');
 const processChild=server.process();assert.ok(processChild&&Number.isInteger(processChild.pid));
 const browser=await within(()=>chromium.connect(server.wsEndpoint()),10000,'owned managed connection');
 browsers.push({browser,server,processChild,profile,closed:false});report.cleanup.browsersCreated++;report.browserVersions.push({profile,version:browser.version()});return browser;
}
async function cdpFor(context, page, profile) {
  return within(async () => {
    const session = await context.newCDPSession(page), item = { session, profile, detached: false };
    sessions.push(item); report.cleanup.cdpSessionsCreated++; return item;
  }, 10000, 'owned ' + profile + ' CDP');
}
function groupAbsent(pid) { try { process.kill(-pid, 0); return false; } catch (error) { return error.code === 'ESRCH' ? true : null; } }
async function nativeDefaultBrowser() {
  const executable = fs.realpathSync(chromium.executablePath()), executableIdentity = fs.lstatSync(executable);
  assert(executable.startsWith(root + '/') && executableIdentity.isFile() && !executableIdentity.isSymbolicLink() && executableIdentity.uid === process.getuid() && executableIdentity.size <= 536870912, 'owned Chromium executable required');
  const descriptor = fs.openSync(executable, 'r'), magic = Buffer.alloc(4);
  try { assert.equal(fs.readSync(descriptor, magic, 0, 4, 0), 4); } finally { fs.closeSync(descriptor); }
  assert(magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), 'owned Chromium must be ELF');
  const binaryHash = createHash('sha256'); let executableBytes = 0;
  await within(async () => { for await (const part of fs.createReadStream(executable)) { executableBytes += part.length; assert(executableBytes <= 536870912, 'Chromium executable bound'); binaryHash.update(part); } }, 10000, 'owned Chromium identity');
  const executableAfter = fs.lstatSync(executable); assert(executableAfter.uid === executableIdentity.uid && executableAfter.dev === executableIdentity.dev && executableAfter.ino === executableIdentity.ino && executableAfter.size === executableIdentity.size && executableAfter.mtimeMs === executableIdentity.mtimeMs && executableAfter.ctimeMs === executableIdentity.ctimeMs && executableBytes === executableIdentity.size, 'Chromium executable changed');
  const profile = path.join(root, 'p1'), artifacts = path.join(root, 'a1');
  fs.mkdirSync(profile, { mode: 0o700 }); fs.mkdirSync(artifacts, { mode: 0o700 });
  const profileIdentity = fs.lstatSync(profile); assert(profileIdentity.uid === process.getuid() && Buffer.byteLength(profile) + 64 < 108, 'owned short profile required');
  const args = ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-extensions', '--disable-sync', '--disable-features=MediaRouter,OptimizationHints,Translate', '--disable-dev-shm-usage',
    '--no-sandbox', '--password-store=basic', '--lang=en-US', '--window-size=1440,1000', 'about:blank'];
  const processChild = spawn(executable, args, { env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = nativeChrome = { processChild, profile, profileIdentity, artifacts, pid: processChild.pid, exited: false, closed: false,
    exitCode: null, signal: null, eof: [false, false], captureFinished: false, stopReason: null, termSent: false, killSent: false,
    forcedDrain: false, timers: [], stdout: [], stderr: [], observed: [0, 0], sanitized: [0, 0], pending: [Buffer.alloc(0), Buffer.alloc(0)],
    digests: [createHash('sha256'), createHash('sha256')], streamProofs: [], redactions: [0, 0], redactedEndpointHashes: new Set(), released: false, accounted: false, closeRequested: false, closeAck: false, disconnected: false };
  report.ownedChrome = { profile: 'native-default', executableBytes, executableSha256: binaryHash.digest('hex'),
    profilePathBytes: Buffer.byteLength(profile), profileUid: profileIdentity.uid, profileInode: profileIdentity.ino,
    noDefaults: true, isLocal: true, startupTimeoutMs: 20000, streamLimitBytes: 65536, diagnosticGzipLimitEach: 49152,
    profileRemoval: 'delegated to outer owned-root cleanup after process verification', process: null };
  const keep = (index, line) => {
    const text = line.toString('latin1').replace(/ws:\/\/127\.0\.0\.1:\d{1,5}\/devtools\/browser\/[a-f0-9-]{36}/g, endpoint => { state.redactions[index]++; state.redactedEndpointHashes.add(sha(endpoint)); return '[OWNED_CDP_ENDPOINT]'; });
    const bytes = Buffer.from(text, 'latin1'); state.sanitized[index] += bytes.length;
    if (state.sanitized[index] > 65536) { state.stop('sanitized_diagnostic_limit'); return; }
    (index ? state.stderr : state.stdout).push(bytes);
  };
  state.stop = reason => {
    if (state.stopReason) return; state.stopReason = reason;
    if (state.pid && groupAbsent(state.pid) !== true) { state.termSent = true; try { process.kill(-state.pid, 'SIGTERM'); } catch {} }
    state.timers.push(setTimeout(() => { if (state.pid && groupAbsent(state.pid) !== true) { state.killSent = true; try { process.kill(-state.pid, 'SIGKILL'); } catch {} } }, 3000));
    state.timers.push(setTimeout(() => { if (!state.closed || !state.eof.every(Boolean)) { state.forcedDrain = true; processChild.stdout.destroy(); processChild.stderr.destroy(); } }, 6000));
  };
  processChild.once('error', () => state.stop('spawn_failed'));
  processChild.once('exit', (code, signal) => { state.exited = true; state.exitCode = code; state.signal = signal; });
  processChild.once('close', () => { state.closed = true; });
  [processChild.stdout, processChild.stderr].forEach((stream, index) => {
    stream.once('end', () => { state.eof[index] = true; });
    stream.on('data', bytes => {
      if (state.captureFinished) return;
      state.observed[index] += bytes.length; state.digests[index].update(bytes);
      if (state.observed[index] > 65536) { state.stop('original_diagnostic_limit'); return; }
      state.pending[index] = Buffer.concat([state.pending[index], bytes]);
      let newline;
      while ((newline = state.pending[index].indexOf(10)) >= 0) { keep(index, state.pending[index].subarray(0, newline + 1)); state.pending[index] = state.pending[index].subarray(newline + 1); }
    });
  });
  const started = Date.now(), portFile = path.join(profile, 'DevToolsActivePort'); let endpoint;
  await poll(async () => {
    assert(!state.stopReason && !state.exited, 'owned Chromium stopped during startup');
    if (!fs.existsSync(portFile)) return false;
    const before = fs.lstatSync(portFile); assert(before.isFile() && !before.isSymbolicLink() && before.uid === process.getuid() && before.size <= 4096, 'DevTools file ownership');
    const bytes = fs.readFileSync(portFile), after = fs.lstatSync(portFile);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== before.size) return false;
    const parts = bytes.toString().trimEnd().split('\n');
    if (!bytes.length || parts.length < 2 || !/^\/devtools\/browser\/[a-f0-9-]{36}$/.test(parts[1])) return false;
    assert(parts.length === 2 && /^\d{1,5}$/.test(parts[0]), 'DevTools file shape');
    const port = Number(parts[0]); assert(port >= 1024 && port <= 65535); endpoint = `ws://127.0.0.1:${port}${parts[1]}`;
    report.ownedChrome.transport = { host: '127.0.0.1', port, portFileBytes: bytes.length, portFileSha256: sha(bytes), endpointSha256: sha(endpoint) };
    assert([...state.redactedEndpointHashes].every(digest => digest === report.ownedChrome.transport.endpointSha256), 'diagnostic endpoint ownership mismatch'); return true;
  }, 'owned loopback DevTools endpoint', 20000);
  report.ownedChrome.startupMs = Date.now() - started;
  const browser = await within(() => chromium.connectOverCDP(endpoint, { noDefaults: true, isLocal: true, timeout: 10000, artifactsDir: artifacts }), 12000, 'public noDefaults CDP connection'); endpoint = null;
  const browserItem = { browser, closed: false, nativeOwned: true }; state.browserItem = browserItem; browsers.push(browserItem); report.cleanup.browsersCreated++;
  report.browserVersions.push({ profile: 'native-default', version: browser.version() }); browser.on('disconnected', () => { state.disconnected = true; });
  const defaults = browser.contexts(); assert.equal(defaults.length, 1); const context = defaults[0], pages = context.pages(); assert.equal(pages.length, 1); assert.equal(pages[0].url(), 'about:blank');
  await guardContext(context); state.contextItem = contexts.find(item => item.context === context); state.contextItem.nativeOwned = true;
  const session = await within(() => browser.newBrowserCDPSession(), 10000, 'owned browser-close CDP');
  state.closeSession = { session, profile: 'native-browser-close', detached: false, closedWithBrowser: false }; sessions.push(state.closeSession); report.cleanup.cdpSessionsCreated++;
  await within(() => pages[0].setViewportSize({ width: 1440, height: 1000 }), 5000, 'native profile public viewport');
  return { context, page: pages[0] };
}
async function closeNativeBrowser(cleanup = false) {
  const state = nativeChrome; if (!state || state.released) return;
  if (!state.closeRequested && state.closeSession && !state.disconnected) {
    state.closeRequested = true;
    try { await within(() => state.closeSession.session.send('Browser.close'), 8000, 'owned native Browser.close', cleanup); state.closeAck = true; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); state.stop('native_close_command_failed'); }
  } else if (!state.closeRequested) state.stop('native_startup_incomplete');
  const end = Math.min(Date.now() + 10000, cleanup ? cleanupEnd : workEnd);
  while (Date.now() < end && !(state.exited && state.closed && state.eof.every(Boolean) && groupAbsent(state.pid) === true)) await delay(25);
  if (!(state.exited && state.closed && state.eof.every(Boolean) && groupAbsent(state.pid) === true)) {
    state.stop('native_close_did_not_settle'); const drainEnd = Math.min(Date.now() + 6500, cleanup ? cleanupEnd : workEnd);
    while (Date.now() < drainEnd && !(state.exited && state.closed && state.eof.every(Boolean) && groupAbsent(state.pid) === true)) await delay(25);
  }
  if (state.exited && state.closed && state.eof.every(Boolean) && groupAbsent(state.pid) === true) for (const timer of state.timers) clearTimeout(timer);
  if (!state.processProof) {
    state.captureFinished = true;
    const streams = [state.stdout, state.stderr].map((parts, index) => {
    if (state.streamProofs[index]) return state.streamProofs[index];
    const pending = state.pending[index];
    if (pending.length) {
      const sanitized = Buffer.from(pending.toString('latin1').replace(/ws:\/\/127\.0\.0\.1:\d{1,5}\/devtools\/browser\/[a-f0-9-]{36}/g, endpoint => { state.redactions[index]++; state.redactedEndpointHashes.add(sha(endpoint)); return '[OWNED_CDP_ENDPOINT]'; }), 'latin1');
      state.sanitized[index] += sanitized.length; if (state.sanitized[index] <= 65536) parts.push(sanitized); else state.stopReason ??= 'sanitized_diagnostic_limit';
    }
    state.pending[index] = Buffer.alloc(0); const bytes = Buffer.concat(parts), compressed = gzipSync(bytes), retained = compressed.length <= 49152;
    if (!retained) state.stopReason ??= 'native_diagnostic_gzip_limit';
    state.streamProofs[index] = { name: index ? 'stderr' : 'stdout', originalObservedBytes: state.observed[index], originalObservedSha256: state.digests[index].digest('hex'), originalBytesRetained: false,
      completeSanitized: retained && state.closed && state.eof[index] && !state.forcedDrain && state.observed[index] <= 65536 && state.sanitized[index] <= 65536,
      redactionType: 'owned-DevTools-endpoint', sanitizationEncoding: 'latin1-byte-preserving', redactionCount: state.redactions[index], sanitizedBytes: bytes.length, sanitizedSha256: sha(bytes),
      sanitizedBytesRetained: retained, encoding: 'gzip-base64', observedCompressedBytes: compressed.length,
      compressedBytes: retained ? compressed.length : 0, data: retained ? compressed.toString('base64') : '' };
    return state.streamProofs[index];
    });
    state.processProof = { exitCode: state.exitCode, signal: state.signal, exitObservedAndReaped: state.exited, closeObserved: state.closed,
      pipesEOF: [...state.eof], originalProcessGroupAbsent: state.pid ? groupAbsent(state.pid) : null, termSent: state.termSent, killSent: state.killSent,
      forcedDrain: state.forcedDrain, stopReason: state.stopReason, streams };
    report.ownedChrome.process = state.processProof;
  }
  const processProof = state.processProof;
  assert([...state.redactedEndpointHashes].every(digest => digest === report.ownedChrome.transport?.endpointSha256), 'diagnostic endpoint ownership mismatch');
  report.ownedChrome.redactedEndpointsMatchOwned = true;
  assert(state.closeAck && state.closeRequested && state.exitCode === 0 && state.signal === null && state.exited && state.closed
    && state.eof.every(Boolean) && processProof.originalProcessGroupAbsent === true && !state.termSent && !state.killSent && !state.forcedDrain && !state.stopReason && processProof.streams.every(item => item.completeSanitized), 'owned native Chromium normal release unverified');
  const observedEnd = Math.min(Date.now() + 3000, cleanup ? cleanupEnd : workEnd);
  const pagesClosed = () => state.contextItem?.pages.size > 0 && [...state.contextItem.pages].every(page => page.isClosed());
  while (Date.now() < observedEnd && !(state.disconnected && state.contextItem?.closeObserved && pagesClosed())) await delay(25);
  assert(state.disconnected && state.contextItem?.closeObserved && pagesClosed(), 'native default context close not observed');
  const profileNow = fs.lstatSync(state.profile); assert(profileNow.isDirectory() && !profileNow.isSymbolicLink() && profileNow.uid === process.getuid() && profileNow.dev === state.profileIdentity.dev && profileNow.ino === state.profileIdentity.ino, 'native profile ownership changed');
  report.ownedChrome.profileIdentityUnchanged = true; state.released = true;
  if (!state.accounted) {
    state.contextItem.closed = true; report.cleanup.contextsClosed++; state.browserItem.closed = true; report.cleanup.browsersClosed++;
    state.closeSession.closedWithBrowser = true; report.cleanup.cdpSessionsClosedWithBrowser++; state.accounted = true;
  }
  report.ownedChrome.closeBasis = { browserCloseAcknowledged: true, browserDisconnected: true, defaultContextCloseObserved: true, defaultPagesClosed: true };
  await within(() => state.browserItem.browser.close(), 3000, 'release ended CDP transport', cleanup);
}
async function focusSnapshot(page, label) {
  const entry = current;
  const observed = await within(() => page.evaluate(() => ({ hidden: document.hidden, visibilityState: document.visibilityState, hasFocus: document.hasFocus(),
    mode: document.body.dataset.mode, width: innerWidth, height: innerHeight, activeTag: document.activeElement?.tagName ?? null, activeId: document.activeElement?.id ?? null })), 5000, 'native focus snapshot');
  const item = { label, ...observed }; entry.observations.focusLast = item;
  const rows = entry.observations.focusSnapshots ??= [], index = rows.findIndex(row => row.label === label);
  if (index >= 0) rows[index] = item; else { assert(rows.length < 16, 'focus snapshot label bound'); rows.push(item); } return observed;
}
async function nativeFocusState(page, label, hidden) {
  const entry = current; let last;
  try { await poll(async () => { last = await focusSnapshot(page, label); return last.hidden === hidden && last.hasFocus === !hidden && last.visibilityState === (hidden ? 'hidden' : 'visible'); }, label); }
  finally { if (last) entry.observations.focusLast = { label: label + ' final', ...last }; }
}
async function contextFor(browser, narrow = false) {
  const context = await within(() => browser.newContext({ viewport: narrow ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    hasTouch: narrow, isMobile: narrow, locale: 'en-US', reducedMotion: 'no-preference', serviceWorkers: 'block', acceptDownloads: false }), 10000, 'new authored context');
  await guardContext(context); return context;
}
async function guardContext(context) {
  const item = { context, closed: false, closeObserved: false, pages: new Set() }; contexts.push(item); report.cleanup.contextsCreated++;
  context.on('close', () => { item.closeObserved = true; });
  context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
  await within(() => context.route('**/*', async route => {
    try {
      const request = route.request(), url = new URL(request.url()), headers = await request.allHeaders();
      if (headers.authorization || headers.cookie) { boundary('credentialRequests', url.pathname); await route.abort(); return; }
      if (request.url() === 'about:blank' && request.isNavigationRequest()) { await route.continue(); return; }
      if (url.origin !== ORIGIN || url.search || !ROUTES.has(url.pathname) || !['GET', 'HEAD'].includes(request.method()) || request.postDataBuffer()?.length) {
        boundary('unexpectedRequests', request.method() + ' ' + url.pathname); await route.abort(); return;
      }
      await route.continue();
    } catch (error) { boundary('unexpectedRequests', error.message); try { await route.abort(); } catch {} }
  }), 5000, 'closed request boundary');
  await within(() => context.routeWebSocket('**/*', route => { boundary('webSockets', 'unexpected websocket'); route.close(); }), 5000, 'websocket boundary');
  context.on('requestfailed', request => boundary('requestFailures', new URL(request.url()).pathname + ' ' + request.failure()?.errorText));
  context.on('response', response => { if (response.status() >= 400) boundary('responseErrors', response.status() + ' ' + new URL(response.url()).pathname); });
  const armPage = page => {
    if (item.pages.has(page)) return; item.pages.add(page);
    page.on('pageerror', error => boundary('pageErrors', error.message));
    page.on('console', message => { if (message.type() === 'error') boundary('consoleErrors', message.text()); });
    page.on('dialog', dialog => { boundary('unexpectedDialogs', dialog.type()); void track(() => dialog.dismiss()).catch(error => report.errors.push(clean(error.message))); });
  };
  context.on('page', armPage); for (const page of context.pages()) armPage(page);
}
async function visit(context, existing = null) {
  const page = existing ?? await within(() => context.newPage(), 10000, 'new game page');
  const response = await within(() => page.goto(ORIGIN + '/', { waitUntil: 'load' }), 15000, 'owned generated-source game');
  assert.equal(response.status(), 200); assert.equal(response.url(), ORIGIN + '/'); await mode(page, 'menu');
  await poll(() => page.locator('#course-options button').count().then(count => count === 6), 'six actual generated courses');
  assert.equal(await page.locator('#error-overlay').isVisible(), false); await within(() => page.bringToFront(), 5000, 'game foreground'); diagnosticPage=page; return page;
}
async function start(page, free = false, touch = false) { await click(page, free ? '#free-button' : '#start-button', touch); await mode(page, 'flying'); }
async function result(page) {
  return within(() => page.evaluate(() => {
    const time = document.getElementById('result-time').textContent, gates = document.getElementById('result-gates').textContent;
    return { title: document.getElementById('result-title').textContent, message: document.getElementById('result-message').textContent,
      score: Number(document.getElementById('result-score').textContent.replaceAll(',', '')), gates, time,
      liftSeconds: Number.parseInt(document.getElementById('result-lift').textContent, 10), recordMessage: document.getElementById('record-message').textContent };
  }), 5000, 'actual result');
}
async function drawing(page) {
  let observed;
  await poll(async()=>{
  observed = await within(() => page.locator('#sky').evaluate(canvas => {
    const context = canvas.getContext('2d'), width = canvas.width, height = canvas.height, colors = new Set(), bytes = [];
    if (!context || width < 1 || height < 1) throw new Error('canvas unavailable');
    for (let y = 1; y <= 16; y++) for (let x = 1; x <= 20; x++) {
      const pixel = context.getImageData(Math.min(width - 1, Math.floor(x * width / 21)), Math.min(height - 1, Math.floor(y * height / 17)), 1, 1).data;
      bytes.push(...pixel); colors.add([...pixel].join(','));
    }
    return { width, height, colors: colors.size, bytes };
  }), 5000, 'actual Canvas pixels');
  return observed.colors>=12;
  },'actual Canvas repaint after native layout',5000,50);
  return { width: observed.width, height: observed.height, sampleColors: observed.colors, sampleSha256: sha(Buffer.from(observed.bytes)) };
}
async function caseRun(index, action) {
  current=report.cases.find(c=>c.id===CASE_IDS[index]);if(!current)return;diagnosticPage=null;const begun=Date.now(); mark('setup ' + current.id);
  try { Object.assign(current.observations, await action()); assert.equal(critical(), 0, 'unexpected browser/network error'); current.accepted = true; current.error = null; }
  catch (error) { current.error=clean(error.message);try{if(diagnosticPage&&!diagnosticPage.isClosed())await capture(diagnosticPage,current.id.toLowerCase()+'-failure');}catch(e){current.observations.captureError=clean(e.message);}throw error; }
  finally { current.durationMs=Date.now()-begun;fs.writeFileSync(path.join(proof,'case-'+current.id+'.json'),JSON.stringify(current,null,2)+'\n');fs.writeFileSync(path.join(proof,'generated-browser.json'),JSON.stringify(report,null,2)+'\n'); }
}
function owner() {
  const current = fs.lstatSync(child), file = path.join(child, 'owner'), token = fs.lstatSync(file);
  assert(path.dirname(child) === root && current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino
    && current.uid === process.getuid() && token.isFile() && !token.isSymbolicLink() && token.uid === process.getuid() && fs.readFileSync(file, 'utf8') === marker);
  assert.deepEqual(fs.readdirSync(child), ['owner']);
}

async function closeProfile(context,browser,label){
 const ctx=contexts.find(x=>x.context===context),item=browsers.find(x=>x.browser===browser);
 assert.ok(ctx&&item&&!ctx.closed&&!item.closed);
 await within(()=>context.close(),10000,'normal '+label+' context close');ctx.closed=true;report.cleanup.contextsClosed++;assert.equal(ctx.closeObserved,true);
 await within(()=>browser.close(),10000,'normal '+label+' browser close');
 await within(()=>item.server.close(),10000,'normal '+label+' native process close');
 let absent=false;try{process.kill(item.processChild.pid,0);}catch(e){absent=e.code==='ESRCH';}
 const closure={label,contextsClosed:true,browserCloseAcknowledged:true,native:{pid:item.processChild.pid,exitCode:item.processChild.exitCode,absent,stdoutEnded:item.processChild.stdout?.readableEnded??null,stderrEnded:item.processChild.stderr?.readableEnded??null}};
 assert.equal(closure.native.exitCode,0,'native exit0 required');assert.equal(absent,true);
 item.closed=true;report.cleanup.browsersClosed++;report.profileClosures.push(closure);return closure;
}
async function detach(item){await within(()=>item.session.detach(),5000,'normal touch detach');item.detached=true;report.cleanup.cdpSessionsDetached++;}
async function capture(page,name){
 assert.match(name,/^l0[1-4]-[a-z0-9-]+$/);assert.ok(report.visuals.length<16);
 const bytes=await within(()=>page.screenshot({type:'png',fullPage:false}),10000,'original viewport screenshot');
 assert.ok(bytes.length>0&&bytes.length<=2097152);
 const file=name+'.png';fs.writeFileSync(path.join(proof,file),bytes,{flag:'wx'});
 const canvas=await page.locator('#sky').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{rect:{x:r.x,y:r.y,width:r.width,height:r.height},width:e.width,height:e.height,display:s.display,visibility:s.visibility,opacity:s.opacity,attributes:e.getContext('2d').getContextAttributes()};});
 const h=await hud(page),sceneScreenshot=h.mode==='flying'?pngScene(bytes):null;
 report.visuals.push({caseId:current.id,file,kind:'original-native-full-viewport',bytes:bytes.length,sha256:sha(bytes),viewport:page.viewportSize(),canvas,hud:h,drawing:await drawing(page),sceneScreenshot});
 if(sceneScreenshot)assert.ok(sceneScreenshot.colors>=32,'actual screenshot must show the painted scene');return file;
}
function pngScene(png){
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let at=8,w,h,bpp;const chunks=[];
 while(at<png.length){const n=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8),b=png.subarray(at+8,at+8+n);assert.ok(at+12+n<=png.length);
  if(type==='IHDR'){w=b.readUInt32BE(0);h=b.readUInt32BE(4);assert.equal(b[8],8);bpp=b[9]===2?3:b[9]===6?4:0;assert.ok(bpp&&w<=4000&&h<=4000);assert.equal(b[12],0);}
  if(type==='IDAT')chunks.push(b);at+=n+12;if(type==='IEND')break;
 }
 assert.ok(w&&h&&bpp);const row=w*bpp,raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:(row+1)*h});assert.equal(raw.length,(row+1)*h);
 let previous=Buffer.alloc(row),offset=0;const colors=new Set();
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<h;y++){const filter=raw[offset++],line=Buffer.allocUnsafe(row);assert.ok(filter<=4);
  for(let x=0;x<row;x++){const a=x>=bpp?line[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0;line[x]=(raw[offset++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}
  if(y>=h*.3&&y<h*.52&&y%3===0)for(let x=Math.ceil(w*.2);x<w*.8;x+=3){const i=x*bpp;colors.add(line[i]+','+line[i+1]+','+line[i+2]);}
  previous=line;
 }
 return{width:w,height:h,region:[.2,.3,.8,.52],colors:colors.size,method:'read-only native PNG reconstruction; original bytes retained'};
}
async function fit(page){
 const canvas=await page.locator('#sky').boundingBox();current.observations.canvasBounds=canvas;
 const f=await within(()=>page.evaluate(()=>{const r=document.getElementById('flight-deck').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,deck:{x:r.x,y:r.y,width:r.width,height:r.height},stick:(()=>{const e=document.getElementById('stick-area'),r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,visible:!!e.getClientRects().length&&!e.closest('[hidden]')};})()};}),5000,'actual screen bounds');
 assert.ok(f.scrollWidth<=f.width);assert.equal(f.deck.x,0);assert.equal(f.deck.y,0);assert.ok(Math.abs(f.deck.height-f.height)<=1);
 assert.ok(canvas&&Math.abs(canvas.x-f.deck.x)<=1&&Math.abs(canvas.y-f.deck.y)<=1&&Math.abs(canvas.width-f.deck.width)<=1&&Math.abs(canvas.height-f.deck.height)<=1,'actual visible Canvas must fill the flight deck');
 if(f.stick.visible)assert.ok(f.stick.x>=0&&f.stick.y>=0&&f.stick.x+f.stick.width<=f.width&&f.stick.y+f.stick.height<=f.height);return{...f,pixels:await drawing(page)};
}
async function menu(page,touch=false){
 const m=(await hud(page)).mode;if(m==='flying'){await click(page,'#pause-button',touch);await click(page,'#pause-menu-button',touch);}else if(m==='paused')await click(page,'#pause-menu-button',touch);else if(m==='result')await click(page,'#result-menu-button',touch);
 await mode(page,'menu');
}
async function choose(page,index,touch=true){
 await menu(page,touch);await within(()=>touch?page.locator('#course-options button').nth(index).tap():page.locator('#course-options button').nth(index).click(),10000,'native generated map');
 const id=await page.locator('#saved-levels').inputValue();assert.match(id,/^v2-(coast|ridge|cloudline|canyon|islands|aurora)-[1-9]\d*-[1-9]\d?$/);return id;
}
async function readSave(page){const raw=await rawSaved(page);assert.ok(raw&&Buffer.byteLength(raw)<65536);return JSON.parse(raw);}
async function ringPixels(page){
 return within(()=>page.locator('#sky').evaluate(canvas=>{
  const w=canvas.width,h=canvas.height,stride=2,top=Math.floor(h*.2),rw=Math.ceil(w/stride),rh=Math.floor((h-top)/stride);
  const data=canvas.getContext('2d').getImageData(0,top,w,h-top).data,n=rw*rh,mask=new Uint8Array(n),queue=new Int32Array(n),found=[];
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=(y*stride*w+x*stride)*4,r=data[i],g=data[i+1],b=data[i+2];if(r>228&&r<251&&g>155&&g<190&&b>90&&b<132&&r-g>45&&g-b>40)mask[y*rw+x]=1;}
  for(let i=0;i<n;i++){if(mask[i]!==1)continue;let read=0,write=0,minX=rw,minY=rh,maxX=0,maxY=0,count=0;queue[write++]=i;mask[i]=2;
   while(read<write){const q=queue[read++],x=q%rw,y=Math.floor(q/rw);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||xx>=rw||yy<0||yy>=rh)continue;const t=yy*rw+xx;if(mask[t]===1){mask[t]=2;queue[write++]=t;}}
   }
   const width=(maxX-minX+1)*stride,height=(maxY-minY+1)*stride;if(width>=20&&height>=20&&count>=20)found.push({x:(minX+maxX)*stride/2,y:top+(minY+maxY)*stride/2,width,height,pixels:count,rank:count*Math.min(width,height)});
  }
  found.sort((a,b)=>b.rank-a.rank);return{width:w,height:h,candidate:found[0]||null,candidates:found.slice(0,3)};
 }),5000,'read-only actual next-ring pixels');
}
async function stickPoint(page,bank,pitch,id=1){
 const r=await page.locator('#stick-area').boundingBox();assert.ok(r&&r.width>=40&&r.height>=40);
 const length=Math.hypot(bank,pitch),scale=length>1?1/length:1;
 return{x:r.x+r.width/2+bank*scale*r.width*.34,y:r.y+r.height/2-pitch*scale*r.width*.34,id,radiusX:2,radiusY:2,force:1};
}
async function visualPilot(page,session,observation,{keyboardRoll=false,durationMs=90000}={}){
 observation.method='read-only orange-next-ring Canvas components plus public HUD, native CDP stick';observation.samples=[];observation.nativeSeed=await page.locator('#saved-levels').inputValue();
 const begin=Date.now();let contact=false,last=null,requested=false,released=false,sawActive=false,firstScore=null,missed=0;
 try{
  while(Date.now()-begin<durationMs){
   const h=await hud(page);if(h.mode==='result')break;assert.equal(h.mode,'flying');
   const image=await ringPixels(page),match=/Next ring (\d+) m/.exec(h.nextGate),d=match?Number(match[1]):null;
   let bank=0,pitch=0;
   if(match){
    if(!image.candidate){if(++missed>8)throw Error('Visible next-ring component not found');}else{
     missed=0;const ex=(image.candidate.x-image.width*.5)/image.height,aim=.384+26.97/(d+88),ey=aim-image.candidate.y/image.height;
     const now=Date.now(),dt=last?Math.max(.1,(now-last.at)/1000):.2;
     const same=last&&Math.abs(d-last.distance)<50;
     const dx=same?Math.max(-.4,Math.min(.4,(ex-last.ex)/dt)):0,dy=same?Math.max(-.4,Math.min(.4,(ey-last.ey)/dt)):0;
     bank=Math.max(-.75,Math.min(.75,ex*6.2+dx*.5));pitch=Math.max(-.65,Math.min(.65,ey*6+dy*.7));last={at:now,ex,ey,distance:d};
    }
   }
   const event={hud:h,ring:image.candidate,bank,pitch};observation.samples.push(event);if(observation.samples.length>18)observation.samples.shift();
   current.observations.activeFlight=observation;
   const ready=await page.locator('#trick-status').textContent();
   if(keyboardRoll&&!requested&&ready==='SPACE / ROLL · +250'){firstScore=h.score;await within(()=>page.keyboard.down('Space'),3000,'real roll key');requested=true;}
   if(requested&&ready==='BARREL ROLL')sawActive=true;
   if(requested&&!released&&sawActive&&ready!=='BARREL ROLL'){await within(()=>page.keyboard.up('Space'),3000,'release real roll key');released=true;observation.keyboardRoll={sawActive,scoreBefore:firstScore,scoreAfter:h.score,event:await page.locator('#flight-event').textContent()};assert.ok(h.score>=firstScore+250);}
   const point=await stickPoint(page,bank,pitch);await within(()=>session.send('Input.dispatchTouchEvent',{type:contact?'touchMove':'touchStart',touchPoints:[point]}),3000,'native visual-pilot stick');contact=true;
   await within(()=>delay(160),1000,'unmodified animation loop');
  }
 }finally{
  if(contact)await within(()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}),3000,'native pilot release');
  if(requested&&!released)await within(()=>page.keyboard.up('Space'),3000,'release held roll');
 }
 await mode(page,'result');const actual=await result(page);observation.result=actual;observation.elapsedMs=Date.now()-begin;
 assert.equal(actual.title,'A flight to remember.');assert.match(actual.message,/complete|through/i);
 const counts=/^(\d+) \/ (\d+)$/.exec(actual.gates);assert.ok(counts);assert.ok(Number(counts[2])>=8&&Number(counts[1])>=Math.floor(Number(counts[2])*.6));assert.ok(actual.score>200);
 if(keyboardRoll)assert.ok(requested&&sawActive&&released&&observation.keyboardRoll,'Actual keyboard roll must complete');
 const frozen=await page.locator('#result-overlay').textContent();await within(()=>delay(400),1000,'real terminal interval');assert.equal(await page.locator('#result-overlay').textContent(),frozen);
 delete current.observations.activeFlight;return actual;
}

const interrupt = () => { interrupted = true; nativeChrome?.stop('interrupted'); for (const item of contexts) if (!item.nativeOwned) void track(() => item.context.close()).catch(() => {}); };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) { handlers.set(signal, interrupt); process.on(signal, interrupt); }
const workTimer = setTimeout(() => { expired = true; nativeChrome?.stop('work_deadline'); for (const item of contexts) if (!item.nativeOwned) void track(() => item.context.close()).catch(() => {}); }, Math.max(1, workEnd - Date.now()));
try {
  assert.equal(process.env.CI, 'true'); assert(process.env.DISPLAY && process.env.DISPLAY.length < 100, 'owned headed display required');
  assert.equal(process.env.DRIFTWING_CHECK_ORIGIN, ORIGIN); assert(/^[a-f0-9]{40}$/.test(report.sourceCommit ?? '')); assert.equal(report.expectedDeployment,null,'loopback source is not deployment proof');
  root = fs.realpathSync(process.env.DRIFTWING_CHECK_ROOT ?? ''); assert(path.isAbsolute(root) && fs.statSync(root).isDirectory() && fs.statSync(root).uid === process.getuid());
  child = fs.mkdtempSync(path.join(root, 'driftwing-driver-')); fs.chmodSync(child, 0o700); identity = fs.lstatSync(child); marker = randomUUID(); fs.writeFileSync(path.join(child, 'owner'), marker, { flag: 'wx', mode: 0o600 });
  const moduleInput = process.env.DRIFTWING_PLAYWRIGHT_MODULE ?? '', moduleFile = moduleInput.startsWith('file:') ? fileURLToPath(moduleInput) : moduleInput;
  assert(path.isAbsolute(moduleFile)); const item = fs.lstatSync(moduleFile); assert(item.isFile() && !item.isSymbolicLink() && item.size <= 1048576);
  ({ chromium } = await import(pathToFileURL(moduleFile).href)); let mainBrowser;
  const display=/^:(\d+)(?:\.0)?$/.exec(process.env.DISPLAY);assert.ok(display);
  const lock='/tmp/.X'+display[1]+'-lock',socket='/tmp/.X11-unix/X'+display[1],xpid=Number(fs.readFileSync(lock,'utf8').trim());
  fs.writeFileSync(path.join(proof,'xvfb-observed.json'),JSON.stringify({display:Number(display[1]),pid:xpid,lock,socket,exe:fs.realpathSync('/proc/'+xpid+'/exe'),starttime:fs.readFileSync('/proc/'+xpid+'/stat','utf8').split(' ')[21],socketInode:fs.statSync(socket).ino,lockInode:fs.statSync(lock).ino})+'\n',{flag:'wx'});
  await caseRun(0,async()=>{
   const owned=await nativeDefaultBrowser(),context=owned.context,page=await visit(context,owned.page);await seedSentinel(page);
   const maps=[];for(let i=0;i<6;i++){const id=await choose(page,i,false);maps.push({id,pixels:await drawing(page)});}
   assert.equal(new Set(maps.map(x=>x.id.split('-')[1])).size,6);assert.equal(new Set(maps.map(x=>x.pixels.sampleSha256)).size,6);
   const one=await page.locator('#saved-levels').inputValue();await click(page,'#new-map-button');const two=await page.locator('#saved-levels').inputValue();assert.notEqual(one,two);
   const saved=await readSave(page);assert.ok(saved.progress.levels.includes(one)&&saved.progress.levels.includes(two));assert.equal(Object.keys(saved.records).length,0);
   await within(()=>page.reload({waitUntil:'load'}),15000,'native saved reload');await mode(page,'menu');assert.equal(await page.locator('#saved-levels').inputValue(),two);await page.locator('#saved-levels').selectOption(one);assert.equal((await readSave(page)).course,one);
   const bounds=await fit(page);await capture(page,'l01-desktop-menu');await choose(page,0,false);await start(page);const initial=await hud(page);assert.ok(initial.airspeed>=46);
   await page.keyboard.down('ArrowUp');await poll(async()=>(await hud(page)).altitude>=initial.altitude+5,'actual climb',8000);await page.keyboard.up('ArrowUp');const climbed=await hud(page);
   await page.keyboard.press('KeyR');await page.keyboard.down('ArrowRight');await poll(async()=>{const h=await hud(page);assert.equal(h.mode,'flying');return h.airspeed<=initial.airspeed-1;},'actual bank drag',2500);await page.keyboard.up('ArrowRight');const banked=await hud(page);assert.ok(banked.airspeed<=initial.airspeed-1);
   await page.keyboard.press('KeyR');await page.keyboard.press('KeyP');const paused=await freezePaused(page);await page.keyboard.press('Escape');await mode(page,'flying');await click(page,'#help-button');const guide=await freezePaused(page);await click(page,'#guide-done');await mode(page,'paused');await click(page,'#resume-button');
   await nativeFocusState(page,'current generated native focus',false);const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await nativeFocusState(page,'actual current hidden and unfocused',true);const hidden=await freezePaused(page);
   await page.bringToFront();await nativeFocusState(page,'actual current visible and focused',false);await mode(page,'paused');await other.close();await click(page,'#resume-button');await mode(page,'flying');await click(page,'#pause-button');await click(page,'#pause-menu-button');await sentinel(page);
   assert.equal(await page.locator('#flight-event').evaluate(e=>getComputedStyle(e).display),'none');await capture(page,'l01-returned-menu');
   await closeNativeBrowser();const closure={label:'L01-native-default',normalNativeClose:true,process:report.ownedChrome.process,closeBasis:report.ownedChrome.closeBasis};report.profileClosures.push(closure);
   return{maps,newTerrain:{one,two},actualSavedReplay:true,bounds,initial,climbed,banked,paused,guide,hidden,actualNativeFocus:true,unrelatedStoragePreserved:true,profileClosure:closure};
  });
  await caseRun(1,async()=>{
   const browser=await launch('L02-visual-generated'),context=await contextFor(browser,true),page=await visit(context);await seedSentinel(page);await page.locator('#steady-camera').check();
   const session=await cdpFor(context,page,'L02-native-stick'),courses=[];current.observations.courses=courses;
   try{
    for(let i=0;i<6;i++){
     const id=await choose(page,i,true),before=await readSave(page);await start(page,false,true);const flight={id,levelBefore:before.progress.level};current.observations.activeFlight=flight;
     await visualPilot(page,session.session,flight,{keyboardRoll:i===0});const after=await readSave(page);assert.ok(after.records[id]);assert.equal(after.progress.level,before.progress.level+1);assert.ok(after.progress.completed.includes(id));flight.record=after.records[id];flight.levelAfter=after.progress.level;courses.push(flight);await capture(page,'l02-map-'+i+'-result');
     if(i===0){const level=after.progress.level;await click(page,'#next-level-button',true);await mode(page,'flying');const nextId=await page.locator('#saved-levels').inputValue();assert.equal(Number(nextId.split('-').at(-1)),level);assert.notEqual(nextId,id);await menu(page,true);await page.locator('#saved-levels').selectOption(id);await start(page,false,true);const replay={id};current.observations.replay=replay;await visualPilot(page,session.session,replay);assert.equal((await readSave(page)).progress.level,level);}
    }
    await menu(page,true);const saved=await readSave(page);assert.equal(saved.progress.level,7);await page.reload({waitUntil:'load'});await mode(page,'menu');assert.deepEqual((await readSave(page)).records,saved.records);assert.equal((await readSave(page)).progress.level,7);await sentinel(page);current.observations.persisted=saved;
    await choose(page,0,true);const before=await readSave(page);await start(page,false,true);await page.keyboard.down('ArrowDown');await modeResultWithin(page,20000);await page.keyboard.up('ArrowDown');const crashed=await result(page);assert.notEqual(crashed.title,'A flight to remember.');assert.deepEqual((await readSave(page)).records,before.records);assert.equal((await readSave(page)).progress.level,before.progress.level);current.observations.crash=crashed;
    await menu(page,true);await start(page,true,true);await within(()=>delay(1200),2000,'actual free entry');const free=await hud(page);assert.equal(free.mode,'flying');assert.ok(free.distanceKm>=0);assert.deepEqual((await readSave(page)).records,before.records);current.observations.freeEntry={...free,limit:'Entry/record preservation only; beyond-finish new free-world native play remains unqualified.'};await menu(page,true);
   }finally{await detach(session);}
   const closure=await closeProfile(context,browser,'L02-generated-courses');return{courses,allSixNativeFinishes:true,actualProgressionReload:7,profileClosure:closure};
  });
  await caseRun(2,async()=>{
   const browser=await launch('L03-narrow-native-touch'),context=await contextFor(browser,true);
   await context.addInitScript(({key,sentinelKey,sentinel,origin})=>{if(location.origin!==origin)return;if(!sessionStorage.getItem('dw-negative-seeded')){localStorage.setItem(key,'{authored-corrupt');localStorage.setItem(sentinelKey,sentinel);sessionStorage.setItem('dw-negative-seeded','1');}},{key:KEY,sentinelKey:SENTINEL_KEY,sentinel:SENTINEL,origin:ORIGIN});
   const page=await visit(context);await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{window.__dwPointerTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','click'])document.getElementById('trick-button').addEventListener(type,event=>{if(window.__dwPointerTrace.length<32)window.__dwPointerTrace.push({type,pointerType:event.pointerType??null,isPrimary:event.isPrimary??null,at:performance.now()});},{passive:true});});const initialRaw=await rawSaved(page);assert.equal(initialRaw,'{authored-corrupt');await choose(page,0,true);await page.locator('#steady-camera').check();assert.ok(JSON.parse(await rawSaved(page)).progress.levels.length);await sentinel(page);await start(page,false,true);
   const session=await cdpFor(context,page,'L03-touch-control');
   let contact=false,last=null,started=false,sawRoll=false,rollDone=false;
   try{
    const end=Date.now()+15000;
    while(Date.now()<end&&!rollDone){
     const h=await hud(page);assert.equal(h.mode,'flying');const img=await ringPixels(page),m=/Next ring (\d+) m/.exec(h.nextGate);let bank=0,pitch=0;
     if(img.candidate&&m){const ex=(img.candidate.x-img.width*.5)/img.height,ey=.384+26.97/(Number(m[1])+88)-img.candidate.y/img.height;bank=Math.max(-.65,Math.min(.65,ex*6));pitch=Math.max(-.6,Math.min(.6,ey*6));}
     const point=await stickPoint(page,bank,pitch);
     await session.session.send('Input.dispatchTouchEvent',{type:contact?'touchMove':'touchStart',touchPoints:[point]});contact=true;
     const ready=await page.locator('#trick-status').textContent();
     if(!started&&ready==='SPACE / ROLL · +250'){
      const r=await page.locator('#trick-button').boundingBox();assert.ok(r);const roll={x:r.x+r.width/2,y:r.y+r.height/2,id:2,radiusX:2,radiusY:2,force:1};
      await session.session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});contact=false;await session.session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,roll]});await within(()=>delay(80),1000,'actual simultaneous touch contacts');await session.session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});contact=false;started=true;
     }
     const status=await page.locator('#trick-status').textContent();if(started&&status==='BARREL ROLL'){if(!sawRoll)await capture(page,'l03-roll-320');sawRoll=true;}
     if(sawRoll&&status!=='BARREL ROLL'){assert.ok((await hud(page)).score>=250);rollDone=true;}
     await within(()=>delay(120),1000,'native touch animation');
    }
    assert.ok(started&&sawRoll&&rollDone,'Actual native touch roll must complete');
    await session.session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});contact=false;await poll(async()=>await page.locator('#stick-knob').evaluate(e=>e.style.transform)==='translate(0px, 0px)','native stick release');
    const p=await stickPoint(page,.35,.2);await session.session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});contact=true;await within(()=>delay(200),1000,'native stick hold');await session.session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});contact=false;await poll(async()=>await page.locator('#stick-knob').evaluate(e=>e.style.transform)==='translate(0px, 0px)','native touch cancellation');
    current.observations.fit320=await fit(page);await page.setViewportSize({width:390,height:844});current.observations.fit390=await fit(page);await click(page,'#pause-button',true);await freezePaused(page);await click(page,'#pause-menu-button',true);await page.setViewportSize({width:320,height:844});await capture(page,'l03-menu-320');const saved=(await readSave(page)).course;await page.reload({waitUntil:'load'});await mode(page,'menu');assert.equal((await readSave(page)).course,saved);await sentinel(page);
   }finally{try{current.observations.actualPointerEvents=await page.evaluate(()=>window.__dwPointerTrace);}catch(e){current.observations.pointerReadError=clean(e.message);}if(contact)await session.session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await detach(session);}
   const closure=await closeProfile(context,browser,'L03-narrow-touch');return{corruptPreferencesRecovered:true,actualTouchRoll:true,releaseAndCancel:true,profileClosure:closure};
  });
  await caseRun(3,async()=>{
   const browser=await launch('L04-native-storage-disabled',true),context=await contextFor(browser,true),page=await visit(context),unavailable=await nativeStorageProbe(page);assert.ok(unavailable.getterUnavailable&&unavailable.writeUnavailable);
   await page.evaluate(()=>sessionStorage.setItem('dw-generated-session','keep'));assert.equal(await page.locator('#storage-notice').isVisible(),true);await choose(page,0,true);await page.locator('#steady-camera').check();await start(page,false,true);
   const session=await cdpFor(context,page,'L04-native-stick'),flight={};
   try{await visualPilot(page,session.session,flight);const end=await result(page);assert.match(end.recordMessage,/this visit/);assert.doesNotMatch(end.recordMessage,/Saved/);await capture(page,'l04-visit-result');await page.reload({waitUntil:'load'});await mode(page,'menu');assert.equal((await nativeStorageProbe(page)).getterUnavailable,true);assert.match(await page.locator('#record-note').textContent(),/No account/);assert.equal(await page.evaluate(()=>sessionStorage.getItem('dw-generated-session')),'keep');}
   finally{await detach(session);}
   const closure=await closeProfile(context,browser,'L04-native-storage');return{unavailable,completed:flight,visitOnly:true,noRecordAfterReload:true,profileClosure:closure};
  });
} catch (error) { report.errors.push(clean(error.message)); }
finally {
  clearTimeout(workTimer);
  cleanupEnd = Math.min(Date.now() + 60000, workEnd + 60000); current = null;
  try { await closeNativeBrowser(true); } catch (error) { report.cleanup.failures.push(clean(error.message)); }
  for (const item of sessions) if (!item.detached && !item.closedWithBrowser) {
    try { await within(() => item.session.detach(), 4000, 'remaining touch CDP detach', true); item.detached = true; report.cleanup.cdpSessionsDetached++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  for (const item of [...contexts].reverse()) if (!item.closed && !item.nativeOwned) {
    try { await within(() => item.context.close(), 8000, 'context close', true); item.closed = true; report.cleanup.contextsClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  for (const item of [...browsers].reverse()) if (!item.closed && !item.nativeOwned) {
    try { await within(() => item.browser.close(), 10000, 'browser close', true); if(item.server)await within(()=>item.server.close(),10000,'native managed close',true); item.closed = true; report.cleanup.browsersClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  const settleEnd = Math.min(Date.now() + 5000, cleanupEnd); while (jobs.size && Date.now() < settleEnd) await delay(25);
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  report.cleanup.cdpSessionsRemaining = sessions.filter(item => !item.detached && !item.closedWithBrowser).length;
  report.cleanup.browserClosed = browsers.length > 0 && browsers.every(item => item.closed); report.cleanup.lateChecksComplete = jobs.size === 0;
  if (child && report.cleanup.browserClosed && contexts.every(item => item.closed) && jobs.size === 0 && report.cleanup.cdpSessionsRemaining === 0) {
    try { owner(); fs.rmSync(child, { recursive: true }); assert(!fs.existsSync(child)); report.cleanup.fixtureCleanup = 'passed'; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  if (critical()) report.errors.push('unexpected browser/network error, including late observations');
  if (interrupted || expired || Date.now() > workEnd + 60000) report.errors.push(interrupted ? 'interrupted' : 'work or cleanup deadline');
  if (report.cleanup.browsersCreated !== report.cleanup.browsersClosed || report.cleanup.contextsCreated !== report.cleanup.contextsClosed
    || !report.cleanup.browserClosed || !report.cleanup.lateChecksComplete || report.cleanup.cdpSessionsRemaining || report.cleanup.fixtureCleanup !== 'passed' || report.cleanup.failures.length) report.errors.push('resource cleanup unverified');
  const expectedCount=selected.size,expectedDetached=[...selected].filter(x=>x!=='L01').length;
  if(report.cases.every(item=>item.accepted)&&(report.cleanup.browsersCreated!==expectedCount||report.cleanup.contextsCreated!==expectedCount
    ||report.cleanup.cdpSessionsCreated!==expectedCount||report.cleanup.cdpSessionsDetached!==expectedDetached
    ||report.cleanup.cdpSessionsClosedWithBrowser!==(selected.has('L01')?1:0)
    ||selected.has('L01')&&!nativeChrome?.released||report.profileClosures.length!==expectedCount))report.errors.push('full selected scope not observed');
  report.status = report.cases.every(item => item.accepted) && !report.errors.length ? 'passed' : 'failed';
  fs.writeFileSync(path.join(proof,'generated-browser.json'),JSON.stringify(report,null,2)+'\n');
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
