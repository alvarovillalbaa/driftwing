#!/usr/bin/env node
// Focused public gameplay checks; tooling and headed browsers live only on owned CI.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
const REPOSITORY = 'alvarovillalbaa/driftwing';
const BRANCH = 'refs/heads/qa/driftwing-gameplay-20261105';
const ACTIVE = '.github/workflows/gameplay-browser.yml';
const SPEC = 'scripts/gameplay-browser-driver.mjs';
const SPEC_SHA = 'a6b40d7c17abefa6954e878c5458654978d42f94ad845b6150f4fa0af2ae4bcb';
const ORIGIN = 'https://driftwing-alvaro.vercel.app';
const TITLES = [
  'desktop controls and native interruptions preserve a paused flight',
  'a real Coast flight earns a record that survives reload crash and free flight',
  'narrow native touch controls recover from corrupt preferences',
  'native storage unavailability keeps a completed flight playable without a saved claim',
];
const ASSETS = [
  ['/', 'public/index.html'], ['/index.html', 'public/index.html'], ['/styles.css', 'public/styles.css'],
  ['/favicon.svg', 'public/favicon.svg'], ['/src/game.js', 'public/src/game.js'], ['/src/flight.js', 'public/src/flight.js'],
  ['/src/renderer.js', 'public/src/renderer.js'], ['/src/audio.js', 'public/src/audio.js'], ['/src/records.js', 'public/src/records.js'],
];
const STREAM_LIMIT = 524288, REPORT_LIMIT = 1048576, BROWSER_LIMIT = 393216;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const need = (condition, code) => { if (!condition) throw new Error(code); };
const finite = error => /^[a-z0-9_]+$/.test(error?.message ?? '') ? error.message : 'controller_error';
const sourceCommit = process.argv[3], deployment = process.env.DRIFTWING_EXPECTED_DEPLOYMENT;
need(process.argv.length === 4 && process.argv[2] === '--source-commit' && /^[a-f0-9]{40}$/.test(sourceCommit ?? ''), 'source_pin_required');
need(/^dpl_[A-Za-z0-9]{1,100}$/.test(deployment ?? ''), 'deployment_pin_required');
need(process.version === 'v24.21.0' && process.platform === 'linux' && process.env.CI === 'true'
  && process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY === REPOSITORY
  && process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === BRANCH
  && process.env.DRIFTWING_PUBLIC_REPOSITORY === 'true', 'approved_public_ci_required');

const repo = fs.realpathSync(process.cwd()), parent = fs.realpathSync('/tmp');
need(path.isAbsolute(parent) && fs.statSync(parent).isDirectory(), 'runner_temp_invalid');
const root = fs.mkdtempSync(path.join(parent, 'dw-'));
fs.chmodSync(root, 0o700);
const identity = fs.lstatSync(root), nonce = randomUUID();
need(identity.uid === process.getuid(), 'scratch_owner_invalid');
fs.writeFileSync(path.join(root, 'owner'), nonce, { flag: 'wx', mode: 0o600 });
for (const name of ['tools', 'tmp', 'cache', 'config', 'browsers']) fs.mkdirSync(path.join(root, name), { mode: 0o700 });
for (const name of ['npm-user', 'npm-global']) fs.writeFileSync(path.join(root, name), '', { flag: 'wx', mode: 0o600 });
const tools = path.join(root, 'tools'), specFile = path.join(tools, 'gameplay-browser-driver.mjs');
const xvfbLog = path.join(root, 'xvfb-errors.log');
need(Buffer.byteLength(path.join(root, 'tmp')) + 64 < 108, 'chromium_socket_path_budget');
const env = {
  PATH: `${path.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', CI: 'true', NO_COLOR: '1',
  TMPDIR: path.join(root, 'tmp'), TMP: path.join(root, 'tmp'), TEMP: path.join(root, 'tmp'),
  XDG_CACHE_HOME: path.join(root, 'cache'), XDG_CONFIG_HOME: path.join(root, 'config'),
  NODE_COMPILE_CACHE: path.join(root, 'cache', 'node'),
  npm_config_userconfig: path.join(root, 'npm-user'), npm_config_globalconfig: path.join(root, 'npm-global'),
  npm_config_cache: path.join(root, 'cache', 'npm'), npm_config_registry: 'https://registry.npmjs.org/',
  npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
  PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'browsers'), PLAYWRIGHT_HTML_OPEN: 'never',
  DRIFTWING_EXPECTED_DEPLOYMENT: deployment, DRIFTWING_CHECK_ORIGIN: ORIGIN,
  DRIFTWING_CHECK_ROOT: root, DRIFTWING_PLAYWRIGHT_MODULE: path.join(tools, 'node_modules/playwright/index.mjs'),
  SOURCE_COMMIT: sourceCommit,
};
const report = {
  schemaVersion: 'driftwing.gameplay-browser.v1', sourceCommit, expectedDeployment: deployment, origin: ORIGIN,
  status: 'failed', startedAtUtc: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch, tmpDirectoryBytes: Buffer.byteLength(path.join(root, 'tmp')), chromiumSocketReserveBytes: 64 },
  scope: { scenarios: TITLES, cases: 4, retries: 0, workers: 1, appBuild: false, appDependencies: false,
    accounts: false, backend: false, models: false, physicalDevice: false, old64CasesRepeated: false,
    profiles: ['owned native-default headed desktop Chromium', 'Playwright headed desktop/narrow Chromium', 'Playwright headed Chromium with native storage disabled'] },
  limits: { workSeconds: 700, cleanupSeconds: 90, browserSeconds: 490, jobMinutes: 14,
    streamBytes: STREAM_LIMIT, streamGzipBytes: 131072, allStreamsGzipBytes: 524288,
    browserJsonBytes: BROWSER_LIMIT, reportBytes: REPORT_LIMIT, assetFetchSeconds: 8 },
  commands: [], guards: [], errors: [], sourceFiles: [],
  proofLimits: [
    'Four real-time public browser journeys are separate from the 64 closed mechanics/audio/VM checks, which are not repeated.',
    'Eighteen anonymous before/after observations bind eight source payloads; root and index.html share the same HTML.',
    'Native Chromium controls, interruptions, storage, touch and rendered canvas are observed without private application state or a synthetic animation clock.',
    'D01 uses a fresh owned Chromium/default context over public noDefaults CDP; normal Browser.close must release the actual child. Nested Chrome diagnostics retain complete sanitized bytes, with original observed counts/digests recorded separately; original bytes are not archived or independently replayable.',
    'Headed Chromium uses owned Xvfb/auth storage. Selected X11 socket/lock absence is observed separately; unknown external resources are never removed.',
    'Only Playwright1.64.1 and its headed Chromium are installed in owned runner storage. Existing shared libraries, Xvfb, xauth and fonts are recorded; missing requirements fail without privileged package installation.',
    'Exit/close/EOF/groups and same-UID owned browser/Xvfb paths plus Linux starttime prove scoped cleanup, not a host-wide inventory.',
    'Deployment ID is a parent-supplied metadata label; served bytes do not independently fetch provider metadata or identify an internal backend.',
    'Canvas crops and actual UI do not prove physical devices, speaker output, audio latency, scientific flight accuracy or complete product acceptance.',
  ],
};
const workEnd = Date.now() + 700000;
let cleanupEnd, interrupted = false, globalExpired = false, baseline, allGzip = 0, browserAttempted = false, assetManifest;
let xvfbLogIdentity;
let browserScanUncertain = false, lastBrowserScan = 0;
const browserProcesses = new Map();
let x11Before;
const x11Displays = new Map();
const active = new Set(), activeHttp = new Set(), handlers = new Map();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const handler = () => { interrupted = true; for (const child of active) child.stop('interrupted'); for (const request of activeHttp) request.abort(); };
  handlers.set(signal, handler); process.on(signal, handler);
}
const globalTimer = setTimeout(() => { globalExpired = true; for (const child of active) child.stop('global_deadline'); for (const request of activeHttp) request.abort(); }, Math.max(1, workEnd + 90000 - Date.now()));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function owner() {
  const current = fs.lstatSync(root), marker = path.join(root, 'owner');
  need(path.dirname(root) === parent && current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino
    && current.uid === process.getuid() && fs.lstatSync(marker).uid === process.getuid()
    && !fs.lstatSync(marker).isSymbolicLink() && fs.readFileSync(marker, 'utf8') === nonce, 'scratch_identity_changed');
}
function read(file, maximum = 16777216) {
  const before = fs.lstatSync(file); need(before.isFile() && !before.isSymbolicLink() && before.size <= maximum, 'file_type_or_bound');
  const bytes = fs.readFileSync(file), after = fs.lstatSync(file);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs
    && before.ctimeMs === after.ctimeMs && bytes.length === before.size, 'file_changed'); return bytes;
}
function scrub(value, maximum = 700) {
  let text = String(value ?? '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  for (const [from, to] of [[root, '[scratch]'], [repo, '[repository]'], [process.env.HOME, '[runner-home]']]) if (from) text = text.split(from).join(to);
  return Buffer.from(text).subarray(0, maximum).toString('utf8');
}
function compressed(bytes, maximum = 131072) {
  const zip = gzipSync(bytes); need(zip.length <= maximum, 'raw_gzip_limit');
  return { encoding: 'gzip-base64', bytes: bytes.length, sha256: sha(bytes), compressedBytes: zip.length, data: zip.toString('base64') };
}
function groupAbsent(pid) { try { process.kill(-pid, 0); return false; } catch (error) { return error.code === 'ESRCH' ? true : null; } }
function proc(pid) {
  const base = `/proc/${pid}`, item = fs.statSync(base);
  if (item.uid !== process.getuid()) return null;
  const before = readProc(path.join(base, 'stat'), 8192).toString(), close = before.lastIndexOf(')');
  need(close > 0, 'proc_stat_shape');
  const fields = before.slice(close + 2).trim().split(/\s+/);
  need(fields.length >= 20 && /^\d+$/.test(fields[19]), 'proc_stat_shape');
  const args = readProc(path.join(base, 'cmdline'), 65536).toString().split('\0').filter(Boolean);
  const after = readProc(path.join(base, 'stat'), 8192).toString(), afterClose = after.lastIndexOf(')');
  need(afterClose > 0 && after.slice(afterClose + 2).trim().split(/\s+/)[19] === fields[19], 'proc_identity_changed');
  const owned = args.some(arg => arg === root || arg.startsWith(root + '/') || arg.includes('=' + root + '/'))
    || browserProcesses.has(pid + ':' + fields[19]);
  const x11Display = owned && path.basename(args[0] ?? '') === 'Xvfb' ? observeX11(args) : null;
  return { pid, x11Display, ppid: Number(fields[1]), pgid: Number(fields[2]), session: Number(fields[3]), state: fields[0],
    starttime: fields[19], owned, executable: args.length ? path.basename(args[0].trim().split(/\s+/)[0]).slice(0, 80) : '' };
}
function readProc(file, maximum) {
  const fd = fs.openSync(file, 'r');
  try { const buffer = Buffer.alloc(maximum + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0); need(length <= maximum, 'proc_read_bound'); return buffer.subarray(0, length); }
  finally { fs.closeSync(fd); }
}
function scanBrowsers(force = false) {
  if (!browserAttempted || (!force && Date.now() - lastBrowserScan < 500)) return [];
  lastBrowserScan = Date.now(); const names = fs.readdirSync('/proc').filter(name => /^\d+$/.test(name));
  need(names.length <= 8192, 'proc_inventory_bound'); const present = [];
  for (const name of names) {
    const pid = Number(name); if (pid === process.pid) continue;
    try {
      const item = proc(pid); if (!item?.owned) continue;
      // The command supervisor owns its own process group; this supplementary
      // inventory records detached browser descendants without logging argv.
      const key = item.pid + ':' + item.starttime;
      if (!browserProcesses.has(key)) browserProcesses.set(key, { ...item, firstSeenAtUtc: new Date().toISOString() });
      need(browserProcesses.size <= 256, 'browser_process_inventory_bound');
      present.push(item);
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error.code)) browserScanUncertain = true;
    }
  }
  return present;
}
async function cleanupBrowsers() {
  owner(); const graceStarted = Date.now(), graceEnd = Math.min(graceStarted + 2000, cleanupEnd - 16500);
  let present = scanBrowsers(true), termSent = 0, killSent = 0;
  while (present.length && Date.now() < graceEnd) { await pause(100); present = scanBrowsers(true); }
  const normalGraceMs = Date.now() - graceStarted, remainingAfterGrace = present.length, started = Date.now(), signalTargets = new Map();
  while (present.length && Date.now() - started < 6500 && Date.now() < cleanupEnd - 10000) {
    for (const item of present) {
      try {
        const current = proc(item.pid);
        need(current?.owned && current.starttime === item.starttime, 'browser_pid_identity_changed');
        const signal = Date.now() - started >= 3000 ? 'SIGKILL' : 'SIGTERM';
        process.kill(item.pid, signal); if (signal === 'SIGKILL') killSent++; else termSent++;
        const key = current.pid + ':' + current.starttime;
        if (!signalTargets.has(key)) signalTargets.set(key, { pid: current.pid, starttime: current.starttime,
          executable: current.executable || item.executable || browserProcesses.get(key)?.executable || '',
          stateAtFirstSignal: current.state, termSent: 0, killSent: 0 });
        const target = signalTargets.get(key); target[signal === 'SIGKILL' ? 'killSent' : 'termSent']++;
      } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) browserScanUncertain = true; }
    }
    await pause(100); present = scanBrowsers(true);
  }
  const stillPresent = scanBrowsers(true);
  report.browserProcessCleanup = { passed: !browserScanUncertain && stillPresent.length === 0 && termSent === 0 && killSent === 0,
    basis: 'Same UID, unique owned-root argv attribution and revalidated Linux kernel PID starttime; no argv/env output.',
    observed: [...browserProcesses.values()], normalGraceMs, normalGraceLimitMs: 2000, remainingAfterGrace,
    signals: [...signalTargets.values()], remaining: stillPresent, termSent, killSent, scanUncertain: browserScanUncertain };
  need(report.browserProcessCleanup.passed, 'browser_process_cleanup_unverified');
}

function snapshotX11() {
  const found = new Set();
  for (const name of fs.readdirSync('/tmp')) if (/^\.X\d+-lock$/.test(name)) found.add('/tmp/' + name);
  try {
    const item = fs.lstatSync('/tmp/.X11-unix'); need(item.isDirectory() && !item.isSymbolicLink(), 'x11_directory_type');
    for (const name of fs.readdirSync('/tmp/.X11-unix')) if (/^X\d+$/.test(name)) found.add('/tmp/.X11-unix/' + name);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  need(found.size <= 1024, 'x11_inventory_bound'); return found;
}
function observeX11(args) {
  const token = args.find(value => /^:\d+$/.test(value)), auth = args[args.indexOf('-auth') + 1];
  need(token && args.includes('-auth') && typeof auth === 'string' && auth === path.resolve(auth)
    && auth.startsWith(path.join(root, 'tmp') + '/') && x11Before instanceof Set, 'xvfb_identity');
  const number = Number(token.slice(1)); need(Number.isSafeInteger(number) && number >= 0 && number <= 65535, 'xvfb_display');
  let row = x11Displays.get(number);
  if (!row) {
    const item = fs.lstatSync(auth); need(item.isFile() && !item.isSymbolicLink() && item.uid === process.getuid(), 'xvfb_auth_identity');
    for (let at = path.dirname(auth); at !== root; at = path.dirname(at)) {
      const parent = fs.lstatSync(at); need(parent.isDirectory() && !parent.isSymbolicLink() && parent.uid === process.getuid(), 'xvfb_auth_ancestor');
    }
    row = { display: number, authWithinOwnedScratch: true, authDev: item.dev, authIno: item.ino,
      socket: { path: '/tmp/.X11-unix/X' + number, observed: false },
      lock: { path: '/tmp/.X' + number + '-lock', observed: false } };
    x11Displays.set(number, row); need(x11Displays.size <= 4, 'xvfb_display_bound');
  }
  for (const kind of ['socket', 'lock']) {
    const endpoint = row[kind]; need(!x11Before.has(endpoint.path), 'x11_endpoint_preexisting');
    try {
      const item = fs.lstatSync(endpoint.path);
      need(!item.isSymbolicLink() && item.uid === process.getuid() && (kind === 'socket' ? item.isSocket() : item.isFile()), 'x11_endpoint_identity');
      if (endpoint.observed) need(item.dev === endpoint.dev && item.ino === endpoint.ino, 'x11_endpoint_replaced');
      else Object.assign(endpoint, { observed: true, dev: item.dev, ino: item.ino, uid: item.uid });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return number;
}
async function cleanupX11() {
  const end = Math.min(Date.now() + 3000, cleanupEnd - 5000);
  let remaining = [];
  do {
    remaining = [];
    for (const row of x11Displays.values()) for (const key of ['socket', 'lock']) {
      try { fs.lstatSync(row[key].path); remaining.push(row[key].path); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!remaining.length) break;
    await pause(50);
  } while (Date.now() < end);
  const observed = [...x11Displays.values()];
  report.x11Cleanup = { passed: (!browserAttempted || (observed.length === 1 && observed.every(row => row.socket.observed && row.lock.observed)))
      && remaining.length === 0, observed, remaining, baselineEndpoints: x11Before?.size ?? 0,
    basis: 'Actual owned-auth Xvfb display; socket/lock were absent before launch and are absent after normal wrapper teardown. No external resource is deleted.' };
  need(report.x11Cleanup.passed, 'x11_cleanup_unverified');
}
async function prepareXvfb() {
  const names = ['/usr/bin/xvfb-run', '/usr/bin/Xvfb', '/usr/bin/xauth'];
  report.runtime.xvfbSystemPackagesInstalled = false;
  report.runtime.preinstalledSystemToolsRequired = true;
  report.runtime.xvfbTools = names.map(file => {
    fs.accessSync(file, fs.constants.X_OK); const bytes = read(file);
    return { path: file, bytes: bytes.length, sha256: sha(bytes) };
  });
  await run('xvfb_package_versions', '/usr/bin/dpkg-query', ['--show', '--showformat=${Package} ${Version}\\n', 'xvfb', 'xauth'], 15, { cwd: tools });
}
async function verifyChromiumProfile() {
  const query = `const { chromium } = await import(${JSON.stringify(env.DRIFTWING_PLAYWRIGHT_MODULE)}); process.stdout.write(JSON.stringify({ executable: chromium.executablePath() }));`;
  const located = await run('chromium_executable_path', process.execPath, ['--input-type=module', '--eval', query], 15, { cwd: tools });
  const value = JSON.parse(located.output[0].toString()), executable = value.executable, browserRoot = path.join(root, 'browsers');
  need(typeof executable === 'string' && path.isAbsolute(executable) && executable === path.resolve(executable)
    && executable.startsWith(browserRoot + '/') && fs.realpathSync(executable) === executable, 'chromium_executable_identity');
  for (let at = path.dirname(executable); at !== root; at = path.dirname(at)) {
    const item = fs.lstatSync(at); need(item.isDirectory() && !item.isSymbolicLink() && item.uid === process.getuid(), 'chromium_executable_ancestor');
  }
  const before = fs.lstatSync(executable), maximum = 536870912;
  need(before.isFile() && !before.isSymbolicLink() && before.uid === process.getuid() && (before.mode & 0o111)
    && before.size > 4 && before.size <= maximum, 'chromium_executable_type');
  const digest = createHash('sha256'), fd = fs.openSync(executable, 'r'), buffer = Buffer.alloc(65536);
  let bytes = 0;
  try {
    while (true) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null); if (!count) break;
      if (!bytes) need(buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46, 'chromium_elf_required');
      bytes += count; need(bytes <= maximum, 'chromium_executable_bound'); digest.update(buffer.subarray(0, count));
    }
  } finally { fs.closeSync(fd); }
  const after = fs.lstatSync(executable);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs
    && before.ctimeMs === after.ctimeMs && bytes === before.size, 'chromium_executable_changed');
  report.runtime.chromiumExecutable = { path: scrub(executable, 250), bytes, sha256: digest.digest('hex'), elf: true };
  fs.accessSync('/usr/bin/ldd', fs.constants.X_OK);
  report.runtime.lddSha256 = sha(read(fs.realpathSync('/usr/bin/ldd'), 1048576));
  await run('shared_library_runtime_version', '/usr/bin/ldd', ['--version'], 15, { cwd: tools });
  const linked = await run('chromium_shared_libraries', '/usr/bin/ldd', [executable], 30, { cwd: tools });
  const libraries = Buffer.concat(linked.output).toString();
  need(libraries.length > 0 && !/\bnot found\b/i.test(libraries), 'chromium_shared_library_missing');
  report.runtime.chromiumSharedLibraries = { passed: true, missing: [], stdoutBytes: linked.output[0].length, stdoutSha256: sha(linked.output[0]),
    qualification: 'ldd resolves this installed ELF against the current runner. The actual headed launch is additionally required; no dependency validation is disabled.' };
  const version = await run('chromium_binary_version', executable, ['--version'], 15, { cwd: tools });
  const versionText = version.output[0].toString().trim();
  need(versionText.length > 0 && Buffer.byteLength(versionText) <= 200, 'chromium_version_invalid');
  report.runtime.chromiumExecutable.reportedVersion = versionText;
  fs.accessSync('/usr/bin/fc-list', fs.constants.X_OK);
  report.runtime.fontListExecutableSha256 = sha(read(fs.realpathSync('/usr/bin/fc-list'), 1048576));
  await run('fontconfig_version', '/usr/bin/fc-list', ['--version'], 15, { cwd: tools });
  const fonts = await run('actual_font_families', '/usr/bin/fc-list', ['--format=%{family}|%{style}\\n'], 15, { cwd: tools });
  const families = [...new Set(fonts.output[0].toString().split('\n').filter(Boolean))].sort();
  need(families.length > 0 && families.length <= 4096, 'font_inventory_invalid');
  report.runtime.fonts = { familyStyleRows: families.length, sortedFamilyStyleSha256: sha(JSON.stringify(families)), stdoutBytes: fonts.output[0].length,
    stdoutSha256: sha(fonts.output[0]), qualification: 'Existing runner font families/styles are retained in the raw command stream; no font packages are installed or equality with earlier profiles claimed.' };
}
function createXvfbLog() {
  owner();
  fs.writeFileSync(xvfbLog, '', { flag: 'wx', mode: 0o600 });
  const item = fs.lstatSync(xvfbLog);
  need(item.isFile() && !item.isSymbolicLink() && item.uid === process.getuid() && (item.mode & 0o777) === 0o600 && item.nlink === 1, 'xvfb_log_identity');
  xvfbLogIdentity = { dev: item.dev, ino: item.ino, uid: item.uid };
}
function captureXvfbLog() {
  report.xvfbDiagnostics = { created: Boolean(xvfbLogIdentity), complete: false,
    source: 'Owned regular file for xvfb-run/Xvfb stderr; no authentication-file contents are read.' };
  if (!xvfbLogIdentity) { need(!browserAttempted, 'xvfb_log_missing'); report.xvfbDiagnostics.complete = true; return; }
  owner(); const item = fs.lstatSync(xvfbLog);
  Object.assign(report.xvfbDiagnostics, { observedBytes: item.size, byteLimit: STREAM_LIMIT });
  need(item.isFile() && !item.isSymbolicLink() && item.dev === xvfbLogIdentity.dev && item.ino === xvfbLogIdentity.ino
    && item.uid === xvfbLogIdentity.uid && (item.mode & 0o777) === 0o600 && item.nlink === 1, 'xvfb_log_identity');
  const bytes = read(xvfbLog, STREAM_LIMIT), after = fs.lstatSync(xvfbLog);
  need(after.dev === item.dev && after.ino === item.ino && after.uid === item.uid && after.mode === item.mode
    && after.nlink === 1 && after.size === bytes.length, 'xvfb_log_changed');
  const wrapper = report.commands.find(row => row.label === 'browser_cases');
  const writersAbsent = Boolean(wrapper?.released && wrapper.exitObservedAndReaped && wrapper.closeObserved
    && wrapper.pipesEOF.every(Boolean) && !wrapper.forcedDrain && wrapper.originalProcessGroupAbsent === true
    && active.size === 0 && report.browserProcessCleanup?.passed === true);
  const raw = compressed(bytes); allGzip += raw.compressedBytes;
  Object.assign(report.xvfbDiagnostics, { type: 'regular-file', mode: '0600', ...xvfbLogIdentity,
    observedBytes: bytes.length, observedSha256: sha(bytes), raw, writersAbsent, complete: writersAbsent,
    closureBasis: 'Wrapper exit/close/pipe EOF and original group absence, plus independently verified owned browser/Xvfb process absence.' });
  need(allGzip <= 524288, 'all_streams_gzip_limit');
  need(writersAbsent, 'xvfb_log_writer_cleanup_unverified');
}

async function run(label, executable, args, seconds, { cleanup = false, retainFailure = false, cwd = repo, postScratch = false } = {}) {
  if (postScratch) need(cleanup && report.scratchCleanup === 'passed' && !fs.existsSync(root), 'scratch_postguard_invalid'); else owner();
  need(cleanup || (!interrupted && !globalExpired), 'interrupted_before_command');
  const end = cleanup ? cleanupEnd : workEnd, remaining = end - Date.now() - 6500;
  need(remaining > 0, 'command_budget_exhausted');
  const commandEnv = postScratch ? { PATH: env.PATH, HOME: env.HOME, LANG: env.LANG, TZ: env.TZ,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } : env;
  const started = Date.now(), child = spawn(executable, args, { cwd, env: commandEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [[], []], count = [0, 0], size = [0, 0], digest = [createHash('sha256'), createHash('sha256')], eof = [false, false];
  let exitCode = null, signal = null, exited = false, closed = false, reason = null, stopAt = null, termSent = false, killSent = false, forcedDrain = false, captureFinished = false;
  const control = { stop(why) {
    if (!reason) { reason = why; stopAt = Date.now(); }
    if (!termSent && child.pid) { termSent = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  } };
  active.add(control);
  child.once('error', () => { control.stop('spawn_failed'); });
  child.once('exit', (code, received) => { exited = true; exitCode = code; signal = received; });
  child.once('close', () => { closed = true; });
  [child.stdout, child.stderr].forEach((stream, index) => {
    stream.once('end', () => { eof[index] = true; });
    stream.on('data', bytes => {
      if (captureFinished) return;
      count[index] += bytes.length; digest[index].update(bytes);
      const kept = bytes.subarray(0, Math.max(0, STREAM_LIMIT - size[index])); chunks[index].push(kept); size[index] += kept.length;
      if (count[index] > STREAM_LIMIT) control.stop('output_limit');
    });
  });
  let leaderClosedAt = null;
  while (true) {
    if (label === 'browser_cases') {
      try { scanBrowsers(); } catch { browserScanUncertain = true; }
      try {
        const log = fs.lstatSync(xvfbLog);
        need(log.isFile() && !log.isSymbolicLink() && log.dev === xvfbLogIdentity.dev && log.ino === xvfbLogIdentity.ino
          && log.uid === xvfbLogIdentity.uid && (log.mode & 0o777) === 0o600 && log.nlink === 1, 'xvfb_log_identity');
        if (log.size > STREAM_LIMIT) control.stop('xvfb_log_output_limit');
      } catch { control.stop('xvfb_log_identity'); }
    }
    const now = Date.now(), absent = child.pid ? groupAbsent(child.pid) : true;
    if (closed && leaderClosedAt === null) leaderClosedAt = now;
    if (interrupted && !cleanup) control.stop('interrupted');
    if (now - started >= Math.min(seconds * 1000, remaining)) control.stop('timeout');
    if (closed && exited && eof.every(Boolean) && absent === true) break;
    if (closed && !child.pid) break;
    if (leaderClosedAt !== null && absent !== true && now - leaderClosedAt >= 1500) control.stop('process_group_remaining');
    if (stopAt !== null && now - stopAt >= 3000 && !killSent && child.pid && absent !== true) {
      killSent = true; try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
    if (stopAt !== null && now - stopAt >= 6000) {
      forcedDrain = !closed || !eof.every(Boolean);
      if (forcedDrain) { child.stdout.destroy(); child.stderr.destroy(); }
      break;
    }
    await pause(25);
  }
  captureFinished = true; const output = chunks.map(parts => Buffer.concat(parts));
  const row = { label, args: [executable === process.execPath ? '[node]' : scrub(executable, 250), ...args.map(value => scrub(value, 250))],
    exitCode, signal, stopReason: reason, exitObservedAndReaped: exited, closeObserved: closed, pipesEOF: [...eof],
    forcedDrain, originalProcessGroupAbsent: child.pid ? groupAbsent(child.pid) : true, termSent, killSent, durationMs: Date.now() - started,
    streams: output.map((bytes, index) => {
      const raw = compressed(bytes); allGzip += raw.compressedBytes;
      return { name: index ? 'stderr' : 'stdout', observedBytes: count[index], observedSha256: digest[index].digest('hex'),
        complete: closed && eof[index] && count[index] === bytes.length && !forcedDrain, raw, head: scrub(bytes.toString(), 500), tail: scrub(bytes.subarray(Math.max(0, bytes.length - 700)).toString(), 700) };
    }) };
  row.released = exited && closed && eof.every(Boolean) && !forcedDrain && row.originalProcessGroupAbsent === true;
  report.commands.push(row); active.delete(control);
  need(allGzip <= 524288, 'all_streams_gzip_limit');
  const accepted = row.exitCode === 0 && row.signal === null && row.stopReason === null && row.released && row.streams.every(stream => stream.complete);
  if (!retainFailure) need(accepted, label + '_failed');
  return { output, row, accepted };
}
function parseGit(bytes, index) {
  const rows = new Map();
  for (const record of bytes.toString().split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t'), header = record.slice(0, tab).split(' '), name = record.slice(tab + 1);
    need(tab > 0 && name && !path.isAbsolute(name) && !name.split('/').some(part => !part || part === '.' || part === '..') && !rows.has(name), 'git_entry_invalid');
    need(index ? header[2] === '0' : header[1] === 'blob', 'git_entry_type'); rows.set(name, { mode: header[0], gitBlob: header[index ? 1 : 2] });
  }
  return rows;
}
function fileVector(name) {
  const file = path.join(repo, name);
  for (let current = path.dirname(file); current !== repo; current = path.dirname(current)) {
    const item = fs.lstatSync(current); need(item.isDirectory() && !item.isSymbolicLink(), 'tracked_ancestor_changed');
  }
  const before = fs.lstatSync(file), mode = before.isSymbolicLink() ? '120000' : before.isFile() ? (before.mode & 0o111 ? '100755' : '100644') : null;
  need(mode, 'tracked_type_invalid');
  const bytes = before.isSymbolicLink() ? fs.readlinkSync(file, { encoding: 'buffer' }) : read(file), after = fs.lstatSync(file);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'tracked_file_changed');
  return { path: name, mode, gitBlob: gitBlob(bytes), bytes: bytes.length, sha256: sha(bytes) };
}
async function guard(label, cleanup = false, postScratch = false) {
  const result = { label, passed: false }; report.guards.push(result); const options = { cleanup, postScratch };
  need((await run(label + '_head', 'git', ['rev-parse', 'HEAD'], 10, options)).output[0].toString().trim() === sourceCommit, 'head_changed');
  need(!fs.existsSync(path.join(repo, ACTIVE)), 'active_workflow_in_source');
  const tree = parseGit((await run(label + '_tree', 'git', ['ls-tree', '-r', '-z', 'HEAD'], 10, options)).output[0], false);
  const index = parseGit((await run(label + '_index', 'git', ['ls-files', '--stage', '-z'], 10, options)).output[0], true);
  need(tree.size > 0 && index.size === tree.size, 'tracked_count_changed');
  const vector = [];
  for (const [name, item] of tree) {
    const value = fileVector(name); need(index.get(name)?.mode === item.mode && index.get(name)?.gitBlob === item.gitBlob
      && value.mode === item.mode && value.gitBlob === item.gitBlob, 'full_tracked_source_changed'); vector.push(value);
  }
  need((await run(label + '_status', 'git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 10, options)).output[0].length === 0, 'worktree_not_clean');
  await run(label + '_diff', 'git', ['-c', 'core.filemode=true', 'diff', '--no-ext-diff', '--no-textconv', '--quiet', '--exit-code', 'HEAD', '--'], 10, options);
  const ignored = (await run(label + '_ignored', 'git', ['status', '--porcelain=v1', '-z', '--ignored=matching', '--untracked-files=normal'], 10, options)).output[0];
  need(ignored.length === 0, 'repository_generated_output');
  if (!baseline) { baseline = vector; report.sourceFiles = vector; }
  need(JSON.stringify(vector) === JSON.stringify(baseline), 'source_vector_changed');
  Object.assign(result, { passed: true, trackedFiles: vector.length, sourceBytes: vector.reduce((sum, file) => sum + file.bytes, 0),
    vectorSha256: sha(JSON.stringify(vector)), fullHeadIndexModesAndBytes: true, noUntrackedOrIgnoredOutput: true });
}
async function verifyServedAssets(phase) {
  report.servedAssets ??= [];
  for (const expected of assetManifest) {
    owner(); need(!interrupted && !globalExpired && workEnd - Date.now() > 9000, 'asset_budget_exhausted');
    const abort = new AbortController(), row = { phase, route: expected.route, expectedBytes: expected.bytes, expectedSha256: expected.sha256,
      status: null, sameOrigin: false, redirect: false, complete: false, bytes: 0, sha256: null, matchesExpected: false,
      credentials: 'omit', readerReleased: false, aborted: false };
    report.servedAssets.push(row); activeHttp.add(abort);
    let reader, timedOut = false; const digest = createHash('sha256'), deadline = Date.now() + 8000;
    const timer = setTimeout(() => { timedOut = true; abort.abort(); }, 8000);
    try {
      const response = await fetch(ORIGIN + expected.route, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: abort.signal, headers: { accept: '*/*', 'user-agent': 'DriftwingGameplayChecks/1' } });
      row.status = response.status; row.sameOrigin = new URL(response.url).origin === ORIGIN;
      row.redirect = response.redirected;
      need(response.status === 200 && response.url === ORIGIN + expected.route && !response.redirected, 'asset_response_identity');
      const length = response.headers.get('content-length');
      need(length === null || (/^\d+$/.test(length) && Number(length) <= 2097152), 'asset_declared_limit');
      need(response.body, 'asset_body_missing'); reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        need(!interrupted && !globalExpired, 'asset_interrupted'); need(!timedOut && Date.now() <= deadline, 'asset_timeout');
        if (chunk.done) { row.complete = true; break; }
        row.bytes += chunk.value.byteLength; need(row.bytes <= 2097152, 'asset_body_limit'); digest.update(chunk.value);
      }
      row.sha256 = digest.digest('hex'); row.matchesExpected = row.bytes === expected.bytes && row.sha256 === expected.sha256;
      need(row.matchesExpected, 'served_asset_source_mismatch');
    } catch (error) { row.error = timedOut ? 'asset_timeout' : finite(error); throw new Error(row.error); }
    finally {
      clearTimeout(timer); abort.abort(); row.aborted = true;
      if (row.sha256 === null) row.sha256 = digest.digest('hex');
      if (reader) {
        let cancelled = false;
        try { cancelled = await Promise.race([reader.cancel().then(() => true, () => false), pause(1000).then(() => false)]); }
        finally { try { reader.releaseLock(); row.readerReleased = cancelled; } catch { row.readerReleased = false; } }
      } else row.readerReleased = true;
      activeHttp.delete(abort);
    }
    need(row.readerReleased && !timedOut, 'asset_stream_cleanup_unverified');
  }
}

function prepareManifest() {
  assetManifest = ASSETS.map(([route, file]) => { const bytes = read(path.join(repo, file)); return { route, bytes: bytes.length, sha256: sha(bytes) }; });
  need(assetManifest.length === 9 && new Set(assetManifest.map(item => item.route)).size === 9, 'source_manifest_shape');
  report.expectedAssets = assetManifest;
}
function generate() {
  const bytes = read(path.join(repo, SPEC), 131072); need(sha(bytes) === SPEC_SHA, 'browser_source_hash');
  fs.writeFileSync(specFile, bytes, { flag: 'wx', mode: 0o600 });
  report.generated = { sourceSpec: SPEC, sourceSha256: SPEC_SHA, generatedSha256: sha(read(specFile, 131072)),
    copiedByteExact: read(specFile, 131072).equals(bytes) };
  need(report.generated.copiedByteExact, 'generated_spec_changed');
}
function jpegDimensions(bytes) {
  need(bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9, 'visual_jpeg_shape');
  let offset = 2;
  while (offset < bytes.length - 2) {
    need(bytes[offset++] === 0xff, 'visual_jpeg_marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++]; if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    need(offset + 2 <= bytes.length, 'visual_jpeg_segment');
    const length = bytes.readUInt16BE(offset); need(length >= 2 && offset + length <= bytes.length, 'visual_jpeg_segment');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      need(length >= 8, 'visual_jpeg_frame'); return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error('visual_jpeg_frame_missing');
}
function verifyOwnedChrome(value) {
  const owned = value.ownedChrome, executable = report.runtime.chromiumExecutable;
  need(owned?.profile === 'native-default' && owned.executableBytes === executable?.bytes && owned.executableSha256 === executable?.sha256
    && owned.noDefaults === true && owned.isLocal === true && owned.profileIdentityUnchanged === true && owned.redactedEndpointsMatchOwned === true
    && Number.isSafeInteger(owned.profilePathBytes) && owned.profilePathBytes > 0 && owned.profilePathBytes + 64 < 108
    && Number.isSafeInteger(owned.profileUid) && owned.profileUid >= 0 && Number.isSafeInteger(owned.profileInode) && owned.profileInode > 0
    && owned.startupTimeoutMs === 20000 && owned.streamLimitBytes === 65536 && owned.diagnosticGzipLimitEach === 49152, 'native_chrome_identity');
  const transport = owned.transport;
  need(transport?.host === '127.0.0.1' && Number.isSafeInteger(transport.port) && transport.port >= 1024 && transport.port <= 65535
    && Number.isSafeInteger(transport.portFileBytes) && transport.portFileBytes > 0 && transport.portFileBytes <= 4096
    && /^[a-f0-9]{64}$/.test(transport.portFileSha256) && /^[a-f0-9]{64}$/.test(transport.endpointSha256), 'native_chrome_transport');
  need(Object.keys(transport).sort().join(',') === 'endpointSha256,host,port,portFileBytes,portFileSha256', 'native_chrome_transport_shape');
  const p = owned.process;
  need(p?.exitCode === 0 && p.signal === null && p.stopReason === null && p.exitObservedAndReaped === true && p.closeObserved === true
    && Array.isArray(p.pipesEOF) && p.pipesEOF.length === 2 && p.pipesEOF.every(item => item === true)
    && p.originalProcessGroupAbsent === true && p.termSent === false && p.killSent === false && p.forcedDrain === false
    && Array.isArray(p.streams) && p.streams.length === 2, 'native_chrome_process_release');
  need(p.streams.map(item => item.name).join(',') === 'stdout,stderr', 'native_chrome_stream_identity');
  let sanitizedBytes = 0, redactions = 0;
  for (const stream of p.streams) {
    need(Number.isSafeInteger(stream.originalObservedBytes) && stream.originalObservedBytes >= 0 && stream.originalObservedBytes <= 65536
      && /^[a-f0-9]{64}$/.test(stream.originalObservedSha256) && stream.originalBytesRetained === false
      && stream.completeSanitized === true && stream.sanitizedBytesRetained === true && stream.encoding === 'gzip-base64'
      && stream.redactionType === 'owned-DevTools-endpoint' && stream.sanitizationEncoding === 'latin1-byte-preserving'
      && Number.isSafeInteger(stream.redactionCount) && stream.redactionCount >= 0 && stream.redactionCount <= stream.originalObservedBytes
      && Number.isSafeInteger(stream.sanitizedBytes) && stream.sanitizedBytes >= 0 && stream.sanitizedBytes <= 65536
      && /^[a-f0-9]{64}$/.test(stream.sanitizedSha256) && Number.isSafeInteger(stream.compressedBytes) && stream.compressedBytes > 0
      && stream.compressedBytes <= 49152 && stream.observedCompressedBytes === stream.compressedBytes
      && typeof stream.data === 'string' && stream.data.length <= 65536, 'native_chrome_sanitized_stream_shape');
    const compressed = Buffer.from(stream.data, 'base64');
    need(compressed.toString('base64') === stream.data && compressed.length === stream.compressedBytes, 'native_chrome_sanitized_gzip');
    const bytes = gunzipSync(compressed, { maxOutputLength: 65536 });
    need(bytes.length === stream.sanitizedBytes && sha(bytes) === stream.sanitizedSha256
      && !/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-f0-9-]{36}/.test(bytes.toString('latin1')), 'native_chrome_sanitized_bytes');
    need(bytes.toString('latin1').split('[OWNED_CDP_ENDPOINT]').length - 1 === stream.redactionCount, 'native_chrome_redaction_inventory');
    if (stream.redactionCount === 0) need(bytes.length === stream.originalObservedBytes && sha(bytes) === stream.originalObservedSha256, 'native_chrome_unredacted_identity');
    else need(bytes.length < stream.originalObservedBytes, 'native_chrome_redaction_counts');
    sanitizedBytes += bytes.length; redactions += stream.redactionCount;
  }
  const closed = owned.closeBasis;
  need(closed?.browserCloseAcknowledged === true && closed.browserDisconnected === true && closed.defaultContextCloseObserved === true
    && closed.defaultPagesClosed === true, 'native_chrome_close_observations');
  report.browser.ownedChromeDiagnostics = { verifiedSanitizedStreams: 2, sanitizedBytes, redactions, originalBytesRetained: false,
    qualification: 'Retained sanitized bytes were independently decompressed and hashed. Original observed digests are recorded but cannot be replayed without the unarchived original bytes.' };
}
function browserResults(bytes) {
  need(bytes.length <= BROWSER_LIMIT, 'browser_output_limit');
  const lines = bytes.toString().split('\n').filter(line => line.startsWith('DRIFTWING_BROWSER_DRIVER='));
  need(lines.length === 1, 'browser_receipt_count');
  const value = JSON.parse(lines[0].slice('DRIFTWING_BROWSER_DRIVER='.length));
  report.browser = { accepted: false, result: value, rawSha256: sha(bytes), rawBytes: bytes.length };
  need(value.schemaVersion === 1 && value.origin === ORIGIN && value.sourceCommit === sourceCommit && value.expectedDeployment === deployment
    && Array.isArray(value.browserVersions) && value.browserVersions.length === 3 && Array.isArray(value.cases) && value.cases.length === 4
    && value.status === 'passed' && Array.isArray(value.errors) && value.errors.length === 0, 'browser_receipt_shape');
  need(new Set(value.browserVersions.map(item => item.profile)).size === 3
    && value.browserVersions.every(item => ['native-default', 'normal', 'storage-disabled'].includes(item.profile) && typeof item.version === 'string'
      && /^\d+\.[\d.]+$/.test(item.version)), 'browser_versions');
  const seen = new Set();
  for (const item of value.cases) {
    need(/^D0[1-4]$/.test(item.id) && !seen.has(item.id), 'browser_case_identity'); seen.add(item.id);
    need(item.title === TITLES[Number(item.id.slice(1)) - 1] && item.accepted === true && item.error === null
      && item.observations && typeof item.observations === 'object', 'browser_case_failure');
  }
  const focus = value.cases.find(item => item.id === 'D01').observations;
  need(focus.focusProfile === 'owned Chromium default context with public noDefaults CDP' && focus.focusCdpSessions === 0
    && focus.actualHiddenAndBlurObserved === true && focus.actualVisibleFocusReturn === true, 'native_focus_profile');
  need(Array.isArray(focus.focusSnapshots) && focus.focusSnapshots.length >= 3 && focus.focusSnapshots.length <= 16
    && focus.focusSnapshots.some(item => item.hidden === true && item.hasFocus === false && item.visibilityState === 'hidden')
    && focus.focusSnapshots.some(item => item.hidden === false && item.hasFocus === true && item.visibilityState === 'visible'), 'native_focus_snapshots');
  for (const key of ['pageErrors', 'consoleErrors', 'unexpectedRequests', 'credentialRequests', 'webSockets', 'requestFailures', 'responseErrors', 'unexpectedDialogs'])
    need(value.boundaries?.[key] === 0, 'browser_boundary');
  const c = value.cleanup;
  need(c && c.browsersCreated === 3 && c.browsersClosed === 3 && c.browserClosed === true
    && c.contextsCreated === 4 && c.contextsClosed === 4 && c.cdpSessionsCreated === 2 && c.cdpSessionsDetached === 1
    && c.cdpSessionsClosedWithBrowser === 1
    && c.cdpSessionsRemaining === 0 && c.lateChecksComplete === true && c.fixtureCleanup === 'passed'
    && Array.isArray(c.failures) && c.failures.length === 0, 'browser_resource_cleanup');
  verifyOwnedChrome(value);
  need(Array.isArray(value.visuals) && value.visuals.length === 2 && new Set(value.visuals.map(item => item.caseId)).size === 2, 'visual_scope');
  for (const item of value.visuals) {
    need(['D02', 'D03'].includes(item.caseId) && item.kind === 'canvas-dom-crop' && item.width === 320 && item.height === 240
      && item.mimeType === 'image/jpeg' && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 65536
      && typeof item.dataBase64 === 'string' && item.dataBase64.length <= 87384 && /^[a-f0-9]{64}$/.test(item.sha256), 'visual_shape');
    const image = Buffer.from(item.dataBase64, 'base64'), dimensions = jpegDimensions(image);
    need(image.toString('base64') === item.dataBase64 && image.length === item.bytes && sha(image) === item.sha256
      && dimensions.width === 320 && dimensions.height === 240, 'visual_bytes');
    need(item.clip && Number.isFinite(item.clip.x) && item.clip.x >= 0 && Number.isFinite(item.clip.y) && item.clip.y >= 0
      && item.clip.width === 320 && item.clip.height === 240, 'visual_clip');
    const h = item.hud;
    need(h && h.mode === 'flying' && ['altitude', 'airspeed', 'score'].every(key => Number.isFinite(h[key]))
      && ['passed', 'distanceKm', 'timeSeconds'].every(key => h[key] === null || Number.isFinite(h[key]))
      && ['windLabel', 'windDetail', 'nextGate'].every(key => typeof h[key] === 'string' && Buffer.byteLength(h[key]) <= 200), 'visual_hud');
  }
  report.browser.accepted = true;
}
try {
  await guard('before');
  need(JSON.parse(read(path.join(repo, 'package.json'), 32768)).name === 'driftwing', 'package_identity');
  prepareManifest();
  report.runtime.nodeSha256 = sha(read(process.execPath, 268435456));
  const npm = fs.realpathSync(path.join(path.dirname(process.execPath), 'npm'));
  need(fs.statSync(npm).isFile(), 'npm_cli_missing'); report.runtime.npmCliSha256 = sha(read(npm, 1048576));
  report.runtime.npm = (await run('npm_version', process.execPath, [npm, '--version'], 15, { cwd: tools })).output[0].toString().trim();
  await run('install_playwright', process.execPath, [npm, 'install', '--prefix', tools, '--no-save', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', 'playwright@1.64.1'], 150, { cwd: tools });
  report.runtime.toolPackages = ['playwright', 'playwright-core'].map(name => {
    const bytes = read(path.join(tools, 'node_modules', name, 'package.json'), 32768), value = JSON.parse(bytes);
    need(value.name === name && value.version === '1.64.1', 'playwright_version');
    return { name, version: value.version, packageJsonSha256: sha(bytes) };
  });
  const cli = path.join(tools, 'node_modules/playwright/cli.js'); report.runtime.playwright = '1.64.1';
  report.runtime.playwrightCliSha256 = sha(read(cli, 1048576));
  await run('install_headed_chromium', process.execPath, [cli, 'install', '--no-shell', 'chromium'], 180, { cwd: tools });
  await prepareXvfb();
  await verifyChromiumProfile();
  generate();
  await verifyServedAssets('before_browser');
  await guard('before_browser');
  need(workEnd - Date.now() >= 497000, 'browser_window_unavailable');
  createXvfbLog();
  x11Before = snapshotX11(); browserAttempted = true;
  const browser = await run('browser_cases', '/usr/bin/xvfb-run', ['--auto-servernum', '--error-file=' + xvfbLog, '--server-args=-screen 0 1600x1200x24 -nolisten tcp', process.execPath, specFile], 490, { cwd: tools, retainFailure: true });
  browserResults(browser.output[0]); need(browser.accepted, 'browser_cli_failed');
  await verifyServedAssets('after_browser');
  await guard('after_browser');
} catch (error) { report.errors.push(finite(error)); }
finally {
  cleanupEnd = Math.min(Date.now() + 90000, workEnd + 90000);
  try { await guard('after', true); } catch (error) { report.errors.push(finite(error)); }
  report.processCleanup = { passed: active.size === 0 && report.commands.every(row => row.released), started: report.commands.length };
  for (const request of activeHttp) request.abort();
  report.networkCleanup = { passed: activeHttp.size === 0 && (report.servedAssets ?? []).every(row => row.readerReleased),
    basis: 'Public asset streams cancelled and reader locks released; no host-wide socket inventory.' };
  try { await cleanupBrowsers(); } catch (error) { report.errors.push(finite(error)); }
  try { await cleanupX11(); } catch (error) { report.errors.push(finite(error)); }
  try { captureXvfbLog(); } catch (error) { report.errors.push(finite(error)); }
  try {
    owner(); need(report.processCleanup.passed && report.browserProcessCleanup?.passed === true && report.x11Cleanup?.passed === true
      && report.xvfbDiagnostics?.complete === true && report.networkCleanup.passed, 'process_cleanup_unverified');
    fs.rmSync(root, { recursive: true }); need(!fs.existsSync(root), 'scratch_still_present'); report.scratchCleanup = 'passed';
  } catch (error) { report.scratchCleanup = 'unverified'; report.errors.push(finite(error)); }
  try { if (report.scratchCleanup === 'passed') await guard('after_cleanup', true, true); } catch (error) { report.errors.push(finite(error)); }
  report.processCleanup = { passed: active.size === 0 && report.commands.every(row => row.released), started: report.commands.length };
  if (interrupted) report.errors.push('interrupted');
  if (globalExpired || Date.now() > workEnd + 90000) report.errors.push('global_deadline');
  report.interrupted = interrupted; report.completedAtUtc = new Date().toISOString();
  report.status = !report.errors.length && report.browser?.accepted === true && report.processCleanup.passed && report.browserProcessCleanup?.passed === true
    && report.x11Cleanup?.passed === true && report.xvfbDiagnostics?.complete === true && report.networkCleanup.passed
    && report.servedAssets?.length === 18 && report.servedAssets.every(row => row.matchesExpected && row.complete)
    && report.scratchCleanup === 'passed' ? 'passed' : 'failed';
  let text = JSON.stringify(report);
  if (Buffer.byteLength(text) > REPORT_LIMIT) { text = JSON.stringify({ schemaVersion: report.schemaVersion, sourceCommit, expectedDeployment: deployment, status: 'failed', errors: ['report_limit'] }); report.status = 'failed'; }
  const outputTimer = setTimeout(() => { process.stderr.write('controller_stdout_deadline\n'); process.exit(1); }, Math.max(1, Math.min(2000, workEnd + 92000 - Date.now())));
  process.stdout.write('DRIFTWING_BROWSER_REPORT=' + text + '\n', () => {
    clearTimeout(outputTimer); clearTimeout(globalTimer);
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    process.exitCode = report.status === 'passed' && !interrupted && !globalExpired && Date.now() <= workEnd + 92000 ? 0 : 1;
  });
}
