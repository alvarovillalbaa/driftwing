import { terrainHeight } from './flight.js';

const TAU = Math.PI * 2;
const NEAR = 7;
const FAR = 4200;
const CELL = 140;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const mix = (a, b, amount) => a + (b - a) * amount;
const fract = value => value - Math.floor(value);
const noise = (x, z = 0) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);

function rgb(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const hex = value.replace('#', '');
  if (/^[\da-f]{6}$/i.test(hex)) return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  if (/^[\da-f]{3}$/i.test(hex)) return [...hex].map(digit => parseInt(digit + digit, 16));
  const values = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i.exec(value);
  return values ? values.slice(1, 4).map(Number) : fallback;
}
const tint = (a, b, amount) => a.map((value, index) => mix(value, b[index], clamp(amount, 0, 1)));
const color = (values, alpha = 1) => `rgba(${values.map(value => Math.round(clamp(value, 0, 255))).join(',')},${clamp(alpha, 0, 1)})`;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
function unit(point) {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

export function createRenderer(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new Error('Driftwing needs a canvas to draw its flight view.');
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); }
  catch { try { ctx = canvas.getContext('2d'); } catch { ctx = null; } }
  if (!ctx) throw new Error('The flight view could not start. Try a browser with Canvas 2D enabled.');

  let width = 960, height = 600, ratio = 1, destroyed = false;
  let previous = null, historyKey = '', paletteKey = '', palette;
  const gateHistory = new Map();

  function resize(nextWidth, nextHeight, pixelRatio = 1) {
    if (destroyed) return;
    width = clamp(number(nextWidth, 960), 1, 8192);
    height = clamp(number(nextHeight, 600), 1, 8192);
    ratio = Math.min(clamp(number(pixelRatio, 1), 0.75, 2), 4096 / Math.max(width, height), Math.sqrt(8000000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
  }

  function getPalette(course) {
    const key = JSON.stringify(course.colors);
    if (key !== paletteKey) {
      paletteKey = key;
      palette = {
        sky: rgb(course.colors?.sky, [93, 169, 190]),
        horizon: rgb(course.colors?.horizon, [222, 232, 213]),
        sea: rgb(course.colors?.sea, [37, 105, 130]),
        land: rgb(course.colors?.land, [108, 129, 100]),
        accent: rgb(course.colors?.accent, [199, 239, 141]),
        navy: [17, 39, 57], sand: [222, 206, 161], white: [248, 250, 235],
      };
    }
    return palette;
  }

  function cameraFor(state, steady, preview) {
    const x = number(state.x), y = number(state.y, 110), z = number(state.z);
    const time = number(state.time);
    const gust = clamp(Math.hypot(number(state.wind?.x), number(state.wind?.y)) / 24, 0, 1);
    const eye = {
      x: x + (steady ? 0 : Math.sin(time * 7.3) * gust * 0.24),
      y: y + 31 + (steady ? 0 : Math.sin(time * 5.7) * gust * 0.14),
      z: z - 88,
    };
    const target = { x: x + clamp(number(state.vx) * 0.9, -36, 36), y: y + 12, z: z + 270 };
    const forward = unit({ x: target.x - eye.x, y: target.y - eye.y, z: target.z - eye.z });
    const right = unit(cross({ x: 0, y: 1, z: 0 }, forward));
    const up = cross(forward, right);
    const focal = height * 0.87;
    const camera = { eye, forward, right, up, focal, cx: width * (preview ? 0.7 : 0.5), cy: height * 0.43, roll: steady ? 0 : -number(state.roll) * 0.065 };
    camera.horizon = camera.cy + focal * forward.y / Math.hypot(forward.x, forward.z);
    return camera;
  }

  function inCamera(point, camera) {
    const relative = { x: point.x - camera.eye.x, y: point.y - camera.eye.y, z: point.z - camera.eye.z };
    return { x: dot(relative, camera.right), y: dot(relative, camera.up), z: dot(relative, camera.forward) };
  }
  function screen(point, camera) {
    if (point.z < NEAR) return null;
    return { x: camera.cx + point.x * camera.focal / point.z, y: camera.cy - point.y * camera.focal / point.z, depth: point.z };
  }
  const project = (point, camera) => screen(inCamera(point, camera), camera);

  function clipDepth(points, limit, keepGreater) {
    const result = [];
    for (let index = 0; index < points.length; index++) {
      const a = points[index], b = points[(index + 1) % points.length];
      const aInside = keepGreater ? a.z >= limit : a.z <= limit;
      const bInside = keepGreater ? b.z >= limit : b.z <= limit;
      if (aInside) result.push(a);
      if (aInside !== bInside) {
        const amount = (limit - a.z) / (b.z - a.z);
        result.push({ x: mix(a.x, b.x, amount), y: mix(a.y, b.y, amount), z: limit });
      }
    }
    return result;
  }
  function polygon(points, camera, fill, stroke = null, lineWidth = 1) {
    let clipped = clipDepth(points.map(point => inCamera(point, camera)), NEAR, true);
    if (clipped.length < 3) return;
    clipped = clipDepth(clipped, FAR, false);
    if (clipped.length < 3) return;
    const projected = clipped.map(point => screen(point, camera));
    if (projected.every(point => point.x < -80) || projected.every(point => point.x > width + 80)
      || projected.every(point => point.y < -80) || projected.every(point => point.y > height + 80)) return;
    ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(a, b, camera, stroke, lineWidth = 1) {
    let p = inCamera(a, camera), q = inCamera(b, camera);
    if ((p.z < NEAR && q.z < NEAR) || (p.z > FAR && q.z > FAR)) return;
    if (p.z < NEAR) { const amount = (NEAR - p.z) / (q.z - p.z); p = { x: mix(p.x, q.x, amount), y: mix(p.y, q.y, amount), z: NEAR }; }
    if (q.z < NEAR) { const amount = (NEAR - q.z) / (p.z - q.z); q = { x: mix(q.x, p.x, amount), y: mix(q.y, p.y, amount), z: NEAR }; }
    if (p.z > FAR) { const amount = (FAR - p.z) / (q.z - p.z); p = { x: mix(p.x, q.x, amount), y: mix(p.y, q.y, amount), z: FAR }; }
    if (q.z > FAR) { const amount = (FAR - q.z) / (p.z - q.z); q = { x: mix(q.x, p.x, amount), y: mix(q.y, p.y, amount), z: FAR }; }
    const start = screen(p, camera), end = screen(q, camera);
    if (!start || !end || Math.max(Math.abs(start.x - camera.cx), Math.abs(end.x - camera.cx)) > 20000) return;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke();
  }

  function sky(camera, p) {
    const horizon = camera.horizon;
    const gradient = ctx.createLinearGradient(0, -height * 0.2, 0, horizon + 30);
    gradient.addColorStop(0, color(tint(p.sky, p.navy, 0.57)));
    gradient.addColorStop(0.68, color(p.sky));
    gradient.addColorStop(1, color(p.horizon));
    ctx.fillStyle = gradient; ctx.fillRect(-width, -height, width * 3, height * 3);
    const sea = ctx.createLinearGradient(0, horizon, 0, height * 1.2);
    sea.addColorStop(0, color(tint(p.sea, p.horizon, 0.38)));
    sea.addColorStop(0.36, color(p.sea)); sea.addColorStop(1, color(tint(p.sea, p.navy, 0.68)));
    ctx.fillStyle = sea; ctx.fillRect(-width, horizon, width * 3, height * 2);
    const glowX = width * 0.74 - camera.forward.x * width * 0.4, glowY = horizon - height * 0.08;
    const glow = ctx.createRadialGradient(glowX, glowY, 1, glowX, glowY, height * 0.42);
    glow.addColorStop(0, color(p.sand, 0.24)); glow.addColorStop(1, color(p.sand, 0));
    ctx.fillStyle = glow; ctx.fillRect(glowX - height / 2, glowY - height / 2, height, height);
    ctx.fillStyle = color(p.white, 0.68); ctx.beginPath(); ctx.arc(glowX, glowY - 12, Math.max(2, height * 0.006), 0, TAU); ctx.fill();
  }

  function distantCoast(state, course, camera, p) {
    for (const distance of [6000, 4400]) {
      const z = Math.floor((number(state.z) + distance) / 700) * 700;
      const points = [];
      for (let index = -18; index <= 18; index++) {
        const x = Math.floor(number(state.x) / 300) * 300 + index * 300;
        const point = project({ x, y: terrainHeight(course, x, z), z }, camera);
        if (point) points.push(point);
      }
      if (points.length < 3) continue;
      ctx.beginPath(); ctx.moveTo(points[0].x, camera.horizon + 12);
      points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.lineTo(points.at(-1).x, camera.horizon + 12); ctx.closePath();
      ctx.fillStyle = color(tint(p.land, p.horizon, distance === 6000 ? 0.88 : 0.73), 0.8); ctx.fill();
    }
  }

  function clouds(state, camera, p) {
    const baseZ = Math.floor(number(state.z) / 1100) * 1100;
    for (let row = 0; row < 5; row++) for (let column = -2; column <= 2; column++) {
      const z = baseZ + row * 1100 + noise(column + 17, row + Math.floor(baseZ / 1100)) * 500;
      const x = column * 900 + (noise(column, Math.floor(z / 1000)) - 0.5) * 900;
      const altitude = 430 + noise(column + 3, Math.floor(z / 900)) * 420;
      const point = project({ x, y: altitude, z }, camera);
      if (!point || point.depth > FAR || point.depth < 180) continue;
      const size = clamp(camera.focal * 90 / point.depth, 4, width * 0.4);
      if (point.x < -size * 3 || point.x > width + size * 3 || point.y < -size * 2 || point.y > height + size * 2) continue;
      for (let puff = 0; puff < 4; puff++) {
        const px = point.x + (puff - 1.5) * size * 0.65, py = point.y + Math.sin(puff * 2) * size * 0.13;
        const radial = ctx.createRadialGradient(px, py, 0, px, py, size);
        radial.addColorStop(0, color(p.white, 0.18)); radial.addColorStop(0.6, color(tint(p.white, p.horizon, 0.3), 0.12)); radial.addColorStop(1, color(p.white, 0));
        ctx.fillStyle = radial; ctx.beginPath(); ctx.ellipse(px, py, size, size * 0.48, 0, 0, TAU); ctx.fill();
      }
    }
  }

  function ocean(state, course, camera, p) {
    const baseZ = Math.floor(number(state.z) / 90) * 90;
    for (let row = 1; row < 30; row++) {
      const z = baseZ + row * 90;
      const depth = z - camera.eye.z;
      const alpha = clamp(0.18 - depth / 16000, 0.015, 0.16);
      for (let column = -4; column <= 4; column++) {
        const x = Math.floor(number(state.x) / 260) * 260 + column * 260 + noise(column, row) * 90;
        if (terrainHeight(course, x, z) > 0.8) continue;
        const shift = Math.sin(number(state.time) * 0.65 + x * 0.03 + z * 0.01) * 3;
        line({ x: x - 30, y: 0.25 + shift * 0.02, z }, { x: x + 30, y: 0.25, z: z + number(state.wind?.x) * 0.6 }, camera, color(p.horizon, alpha), 0.8);
      }
    }
  }

  function terrain(state, course, camera, p) {
    const xBase = Math.floor(number(state.x) / CELL) * CELL;
    const zBase = Math.floor(camera.eye.z / CELL) * CELL;
    const vertices = [];
    for (let row = 0; row <= 30; row++) {
      const strip = [];
      for (let column = -16; column <= 16; column++) {
        const x = xBase + column * CELL, z = zBase + row * CELL;
        strip.push({ x, y: terrainHeight(course, x, z), z });
      }
      vertices.push(strip);
    }
    const faces = [];
    const sun = unit({ x: -0.6, y: 0.9, z: -0.25 });
    for (let row = 0; row < 30; row++) for (let column = 0; column < 32; column++) {
      const a = vertices[row][column], b = vertices[row][column + 1], c = vertices[row + 1][column], d = vertices[row + 1][column + 1];
      for (const triangle of [[a, c, b], [b, c, d]]) {
        const average = triangle.reduce((sum, point) => sum + point.y, 0) / 3;
        if (average <= 0.65) continue;
        const normal = unit(cross({ x: triangle[1].x - triangle[0].x, y: triangle[1].y - triangle[0].y, z: triangle[1].z - triangle[0].z },
          { x: triangle[2].x - triangle[0].x, y: triangle[2].y - triangle[0].y, z: triangle[2].z - triangle[0].z }));
        const shade = clamp(dot(normal, sun) * 0.22 + 0.78, 0.44, 1.06);
        let base = average < 7 ? tint(p.sand, p.land, average / 25) : tint(p.land, p.navy, clamp((average - 80) / 620, 0, 0.42));
        base = base.map(value => value * shade);
        const depth = triangle.reduce((sum, point) => sum + inCamera(point, camera).z, 0) / 3;
        faces.push({ triangle, depth, fill: color(tint(base, p.horizon, clamp((depth - 400) / FAR, 0, 0.91) ** 1.3)) });
      }
    }
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) polygon(face.triangle, camera, face.fill, face.fill, 0.55);
  }

  function thermal(field, state, camera, p) {
    if (!(field.radius > 0) || !(field.top > field.base) || !(field.strength > 0)) return;
    const center = project({ x: field.x, y: (field.base + field.top) / 2, z: field.z }, camera);
    if (!center || center.depth > FAR || center.x < -width || center.x > width * 2) return;
    const alpha = clamp((1 - center.depth / FAR) * field.strength / 32, 0.05, 0.33);
    const tone = tint(p.accent, [106, 225, 224], 0.65);
    const ring = (y, radius, opacity) => {
      for (let segment = 0; segment < 28; segment++) {
        const a = segment / 28 * TAU, b = (segment + 1) / 28 * TAU;
        line({ x: field.x + Math.cos(a) * radius, y, z: field.z + Math.sin(a) * radius },
          { x: field.x + Math.cos(b) * radius, y, z: field.z + Math.sin(b) * radius }, camera, color(tone, opacity), 1);
      }
    };
    for (let index = 0; index <= 4; index++) ring(mix(field.base, field.top, index / 4), field.radius, alpha * 0.55);
    for (let side = 0; side < 4; side++) {
      const angle = side / 4 * TAU;
      line({ x: field.x + Math.cos(angle) * field.radius, y: field.base, z: field.z + Math.sin(angle) * field.radius },
        { x: field.x + Math.cos(angle) * field.radius, y: field.top, z: field.z + Math.sin(angle) * field.radius }, camera, color(tone, alpha * 0.38), 0.8);
    }
    for (let index = 0; index < 28; index++) {
      const progress = fract(noise(index + 31, field.z) + number(state.time) * field.strength / (field.top - field.base) * 0.7);
      const angle = noise(index, field.x) * TAU + progress * TAU * 1.8;
      const radius = field.radius * (0.25 + noise(index + 7, field.z) * 0.5);
      const point = project({ x: field.x + Math.cos(angle) * radius, y: mix(field.base, field.top, progress), z: field.z + Math.sin(angle) * radius }, camera);
      if (!point || point.x < -10 || point.x > width + 10 || point.y < -10 || point.y > height + 10) continue;
      const size = clamp(camera.focal * 0.65 / point.depth, 0.7, 3);
      ctx.fillStyle = color(tone, alpha + 0.18); ctx.beginPath(); ctx.arc(point.x, point.y, size, 0, TAU); ctx.fill();
    }
  }

  function boundaries(state, course, camera, p, preview) {
    const halfWidth = course.bounds.halfWidth, ceiling = course.bounds.ceiling;
    const baseZ = Math.floor(number(state.z) / 180) * 180;
    const edgeDistance = halfWidth - Math.abs(number(state.x));
    const high = ceiling - number(state.y) < 45;
    const warning = [242, 164, 109];
    for (let row = 0; row < 14; row++) {
      const z = baseZ + row * 180;
      const fade = (1 - row / 16) * (preview ? 0.65 : 1);
      for (const side of [-1, 1]) {
        const x = side * halfWidth;
        const close = edgeDistance < 55 && Math.sign(number(state.x)) === side;
        const tone = close ? warning : p.white;
        const ground = terrainHeight(course, x, z) + 2;
        line({ x, y: ground, z }, { x, y: ground + 18, z }, camera, color(tone, fade * (close ? 0.65 : 0.25)), 1.2);
        line({ x: x - 4, y: ground + 18, z }, { x: x + 4, y: ground + 18, z }, camera, color(tone, fade * 0.4), 1.2);
        line({ x, y: ground, z }, { x, y: terrainHeight(course, x, z + 75) + 2, z: z + 75 }, camera, color(tone, fade * (close ? 0.55 : 0.19)), 1);
        line({ x, y: ceiling, z }, { x, y: ceiling, z: z + 75 }, camera, color(high ? warning : p.white, fade * (high ? 0.5 : 0.12)), 1);
        if (close) {
          for (let y = ground + 35; y < ceiling - 12; y += 38) line({ x, y, z }, { x, y: Math.min(y + 12, ceiling), z }, camera, color(warning, fade * 0.18), 1);
        }
      }
      if (row % 4 === 1) {
        for (let x = -halfWidth; x < halfWidth; x += 65) line({ x, y: ceiling, z }, { x: Math.min(x + 25, halfWidth), y: ceiling, z }, camera, color(high ? warning : p.white, fade * (high ? 0.38 : 0.1)), 1);
      }
    }
  }

  function landmarks(state, course, camera, p) {
    if (course.id !== 'coast') return;
    const baseZ = Math.floor(number(state.z) / 900) * 900;
    // Shore beacons sit beyond the playable corridor, on the shared ground.
    for (let index = 3; index >= 0; index--) {
      const z = baseZ + index * 900 + 460, x = course.bounds.halfWidth + 85;
      const ground = terrainHeight(course, x, z), radius = 3.5, top = ground + 23;
      const center = project({ x, y: top, z }, camera);
      if (!center || center.depth > FAR || center.x < -20 || center.x > width + 20) continue;
      const fog = clamp(center.depth / FAR, 0, 0.88);
      for (let side = 0; side < 6; side++) {
        const a = side / 6 * TAU, b = (side + 1) / 6 * TAU;
        const first = { x: x + Math.cos(a) * radius, z: z + Math.sin(a) * radius };
        const second = { x: x + Math.cos(b) * radius, z: z + Math.sin(b) * radius };
        polygon([{ ...first, y: ground }, { ...second, y: ground }, { ...second, y: top }, { ...first, y: top }], camera,
          color(tint(tint(p.white, p.navy, side / 20), p.horizon, fog)));
        polygon([{ ...first, y: top - 6 }, { ...second, y: top - 6 }, { ...second, y: top - 3 }, { ...first, y: top - 3 }], camera,
          color(tint(p.accent, p.horizon, fog)));
        polygon([{ ...first, y: top }, { ...second, y: top }, { x, y: top + 4, z }], camera,
          color(tint(p.navy, p.horizon, fog)));
      }
      const light = project({ x, y: top - 1.5, z }, camera);
      if (light) { ctx.fillStyle = color(p.sand, 0.8 * (1 - fog)); ctx.beginPath(); ctx.arc(light.x, light.y, clamp(camera.focal / light.depth, 0.8, 2), 0, TAU); ctx.fill(); }
    }
  }

  function updateGateHistory(state, course) {
    const key = `${state.courseId}:${state.mode}`;
    if (historyKey !== key || (previous && (state.time < previous.time || state.gateIndex < previous.gateIndex))) { gateHistory.clear(); previous = null; historyKey = key; }
    const index = Math.max(0, Math.floor(number(state.gateIndex)));
    if (previous && index > previous.gateIndex) {
      const passed = state.passed - previous.passed, missed = state.missed - previous.missed;
      for (let gate = previous.gateIndex; gate < Math.min(index, course.gates.length); gate++) {
        gateHistory.set(gate, passed > 0 && missed === 0 ? 'passed' : missed > 0 && passed === 0 ? 'missed' : 'past');
      }
      const type = state.lastEvent?.type ?? '';
      if (passed > 0 && missed > 0 && index) gateHistory.set(index - 1, /miss|skip/i.test(type) ? 'missed' : /pass|gate|ring/i.test(type) ? 'passed' : 'past');
    } else if (!previous && index && (state.passed === index || state.missed === index)) {
      for (let gate = 0; gate < Math.min(index, course.gates.length); gate++) gateHistory.set(gate, state.passed === index ? 'passed' : 'missed');
    }
    previous = { time: state.time, gateIndex: index, passed: state.passed, missed: state.missed };
  }

  function gates(state, course, camera, p, preview) {
    for (let index = course.gates.length - 1; index >= 0; index--) {
      const gate = course.gates[index];
      const center = project(gate, camera);
      if (!center || center.depth > 3000 || center.depth < 12) continue;
      const next = index === state.gateIndex && state.mode !== 'free';
      const past = index < state.gateIndex;
      const outcome = gateHistory.get(index);
      const tone = outcome === 'passed' ? [153, 229, 157] : outcome === 'missed' ? [242, 139, 113] : next ? p.accent : p.white;
      const alpha = past ? 0.48 : next ? 0.95 : clamp(0.5 - center.depth / 6000, 0.12, 0.4);
      const radius = Math.max(1, number(gate.radius, 18));
      const thickness = next ? 2.5 : 1.5;
      for (let segment = 0; segment < 48; segment++) {
        const a = segment / 48 * TAU, b = (segment + 1) / 48 * TAU;
        line({ x: gate.x + Math.cos(a) * radius, y: gate.y + Math.sin(a) * radius, z: gate.z },
          { x: gate.x + Math.cos(b) * radius, y: gate.y + Math.sin(b) * radius, z: gate.z }, camera, color(tone, alpha), thickness);
      }
      if (next) {
        for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) line(
          { x: gate.x + Math.cos(angle) * radius * 1.1, y: gate.y + Math.sin(angle) * radius * 1.1, z: gate.z },
          { x: gate.x + Math.cos(angle) * radius * 1.32, y: gate.y + Math.sin(angle) * radius * 1.32, z: gate.z }, camera, color(tone, 0.9), 2);
        const projectedRadius = clamp(radius * camera.focal / center.depth, 3, height * 0.6);
        const labelY = center.y - projectedRadius - 19;
        if (!preview && center.x > 35 && center.x < width - 35 && labelY > 20 && labelY < height - 20) {
          ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = color(p.navy, 0.7); ctx.fillRect(center.x - 29, labelY - 11, 58, 19);
          ctx.fillStyle = color(p.accent); ctx.fillText('NEXT', center.x, labelY + 2);
        }
      }
      if (outcome === 'missed') {
        const size = radius * 0.32;
        line({ x: gate.x - size, y: gate.y - size, z: gate.z }, { x: gate.x + size, y: gate.y + size, z: gate.z }, camera, color(tone, 0.75), 2);
        line({ x: gate.x - size, y: gate.y + size, z: gate.z }, { x: gate.x + size, y: gate.y - size, z: gate.z }, camera, color(tone, 0.75), 2);
      }
    }
  }

  function wind(state, camera, p) {
    const vector = { x: number(state.wind?.x), y: number(state.wind?.y), z: number(state.wind?.z) };
    const magnitude = Math.hypot(vector.x, vector.y, vector.z);
    if (magnitude < 0.5) return;
    const scale = 1.5;
    for (let index = 0; index < 30; index++) {
      const x = number(state.x) + (noise(index, 7) - 0.5) * 650;
      const y = Math.max(8, number(state.y) + (noise(index, 11) - 0.5) * 180);
      const z = Math.floor(number(state.z) / 100) * 100 + 110 + noise(index, 17) * 750;
      const start = { x, y, z }, end = { x: x + vector.x * scale, y: y + vector.y * scale, z: z + vector.z * scale };
      const opacity = clamp(magnitude / 120, 0.06, 0.19);
      line(start, end, camera, color(vector.y > 2 ? p.accent : p.white, opacity), 1);
    }
  }

  function plane(state, course, camera, p) {
    const pitch = clamp(number(state.pitch), -0.7, 0.7), roll = clamp(number(state.roll), -1.35, 1.35);
    const yaw = clamp(Math.atan2(number(state.vx), Math.max(1, number(state.vz, 30))) * 0.45, -0.5, 0.5);
    const transform = vertex => {
      const y = vertex[1] * Math.cos(pitch) + vertex[2] * Math.sin(pitch);
      const z = -vertex[1] * Math.sin(pitch) + vertex[2] * Math.cos(pitch);
      const x = vertex[0] * Math.cos(roll) + y * Math.sin(roll);
      const bankY = -vertex[0] * Math.sin(roll) + y * Math.cos(roll);
      return { x: number(state.x) + x * Math.cos(yaw) + z * Math.sin(yaw), y: number(state.y) + bankY, z: number(state.z) - x * Math.sin(yaw) + z * Math.cos(yaw) };
    };
    const ground = terrainHeight(course, number(state.x), number(state.z));
    const altitude = number(state.y) - ground;
    if (altitude < 260) {
      const shadow = [];
      for (let index = 0; index < 24; index++) shadow.push({ x: number(state.x) + Math.cos(index / 24 * TAU) * 15, y: ground + 0.4, z: number(state.z) + Math.sin(index / 24 * TAU) * 5 });
      polygon(shadow, camera, color(p.navy, clamp(0.2 - altitude / 1600, 0.035, 0.2)));
    }
    const faces = [
      { vertices: [[-0.8, 0, 2], [-12, 0.65, -0.4], [-12, 0.6, -2], [-0.8, 0, -1.8]], fill: color(tint(p.white, p.sky, 0.14)) },
      { vertices: [[0.8, 0, 2], [12, 0.65, -0.4], [12, 0.6, -2], [0.8, 0, -1.8]], fill: color(p.white) },
      { vertices: [[-11, 0.66, -0.2], [-12, 0.66, -0.4], [-12, 0.61, -2], [-11, 0.61, -1.9]], fill: color(p.accent) },
      { vertices: [[11, 0.66, -0.2], [12, 0.66, -0.4], [12, 0.61, -2], [11, 0.61, -1.9]], fill: color(p.accent) },
      { vertices: [[-0.4, 0.1, -5.8], [-3.8, 0.3, -7.4], [-3.8, 0.25, -8.3], [0, 0.1, -7.8]], fill: color(p.white) },
      { vertices: [[0.4, 0.1, -5.8], [3.8, 0.3, -7.4], [3.8, 0.25, -8.3], [0, 0.1, -7.8]], fill: color(p.white) },
      { vertices: [[0, 0, 8], [-0.9, 0.2, 2.2], [-0.55, 0.1, -4], [0, 0.1, -8], [0.55, 0.1, -4], [0.9, 0.2, 2.2]], fill: color(p.white) },
      { vertices: [[0, 0.3, 5], [-0.62, 0.75, 2.2], [-0.45, 0.65, 0.2], [0.45, 0.65, 0.2], [0.62, 0.75, 2.2]], fill: color(tint(p.sea, p.navy, 0.55)) },
      { vertices: [[0, 0.15, -5.3], [0, 2.2, -7.4], [0, 1.8, -8.1], [0, 0.15, -8.1]], fill: color(p.accent) },
    ].map(face => ({ ...face, points: face.vertices.map(transform) }));
    faces.sort((a, b) => b.points.reduce((sum, point) => sum + inCamera(point, camera).z, 0) / b.points.length
      - a.points.reduce((sum, point) => sum + inCamera(point, camera).z, 0) / a.points.length);
    for (const face of faces) polygon(face.points, camera, face.fill, color(p.navy, 0.5), 0.75);
  }

  function render(state, course, { steadyCamera = false, preview = false } = {}) {
    if (destroyed || !state || !course) return;
    const p = getPalette(course), camera = cameraFor(state, steadyCamera || preview, preview);
    updateGateHistory(state, course);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(camera.cx, camera.cy); ctx.rotate(camera.roll); ctx.translate(-camera.cx, -camera.cy);
    sky(camera, p); distantCoast(state, course, camera, p); clouds(state, camera, p); ocean(state, course, camera, p); terrain(state, course, camera, p);
    landmarks(state, course, camera, p);
    boundaries(state, course, camera, p, preview);
    const fields = [...course.thermals].sort((a, b) => b.z - a.z);
    for (const field of fields) thermal(field, state, camera, p);
    if (state.mode !== 'free') gates(state, course, camera, p, preview);
    wind(state, camera, p); plane(state, course, camera, p);
    ctx.restore();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true; gateHistory.clear(); previous = null;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  resize(number(canvas.clientWidth, 960) || 960, number(canvas.clientHeight, 600) || 600, 1);
  return { resize, render, destroy };
}
