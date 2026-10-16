// Seeded, point-symmetric map generator (fair 1v1 maps).
import { MAP_SIZE } from './config.js';

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const T = { GRASS: 0, GRASS2: 1, FLOWERS: 2, SAND: 3, WATER: 4, TREE: 5, ROCK: 6, TALL: 7 };
export const TILE_NAMES = ['grass', 'grass2', 'flowers', 'sand', 'water', 'tree', 'rock', 'tallgrass'];
export function tileBlocked(t) {
  return t === T.WATER || t === T.TREE || t === T.ROCK;
}

export function generateMap(seed, size = MAP_SIZE) {
  const R = rng(seed);
  const w = size, h = size;
  const tiles = new Uint8Array(w * h);
  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  // ground variation
  for (let i = 0; i < tiles.length; i++) {
    const r = R();
    tiles[i] = r < 0.12 ? T.GRASS2 : r < 0.15 ? T.FLOWERS : T.GRASS;
  }
  function blob(cx, cy, rad, t, noise = 0.35) {
    for (let y = Math.floor(cy - rad - 2); y <= cy + rad + 2; y++)
      for (let x = Math.floor(cx - rad - 2); x <= cx + rad + 2; x++) {
        if (!inb(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy) + (R() - 0.5) * rad * noise * 2;
        if (d < rad) tiles[idx(x, y)] = t;
      }
  }
  for (let i = 0; i < 4; i++) {
    const cx = 6 + R() * (w - 12), cy = 6 + R() * (h - 12), r = 2 + R() * 3;
    blob(cx, cy, r + 1.3, T.SAND, 0.2);
    blob(cx, cy, r, T.WATER, 0.25);
  }
  for (let i = 0; i < 16; i++) blob(R() * w, R() * h, 1.5 + R() * 3.5, T.TREE);
  for (let i = 0; i < 10; i++) blob(R() * w, R() * h, 1 + R() * 2.5, T.TALL, 0.5);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h);
    tiles[idx(x, y)] = T.ROCK;
  }
  // border forest
  for (let i = 0; i < w; i++) {
    tiles[idx(i, 0)] = tiles[idx(i, h - 1)] = T.TREE;
    tiles[idx(0, i)] = tiles[idx(w - 1, i)] = T.TREE;
  }

  const clear = (x, y) => {
    if (inb(x, y) && x > 0 && y > 0 && x < w - 1 && y < h - 1 && tileBlocked(tiles[idx(x, y)]))
      tiles[idx(x, y)] = T.GRASS;
  };
  const clearCircle = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) clear(x, y);
  };
  const carve = (x0, y0, x1, y1) => {
    let x = x0, y = y0, n = 0;
    while ((Math.abs(x - x1) > 0 || Math.abs(y - y1) > 0) && n++ < 400) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) clear(x + dx, y + dy);
      if (R() < 0.7) { x += Math.sign(x1 - x); y += Math.sign(y1 - y); }
      else if (R() < 0.5) x += Math.sign(x1 - x) || (R() < 0.5 ? 1 : -1);
      else y += Math.sign(y1 - y) || (R() < 0.5 ? 1 : -1);
      x = Math.max(1, Math.min(w - 2, x)); y = Math.max(1, Math.min(h - 2, y));
    }
  };

  const s0 = { tx: 8, ty: 8 };
  const c0 = { x: s0.tx + 1, y: s0.ty + 1 };
  const mid = Math.floor(w / 2);
  clearCircle(c0.x, c0.y, 9);
  clearCircle(10, h - 14, 5); // expansion
  clearCircle(mid - 2, mid - 2, 4);
  carve(c0.x, c0.y, mid, mid);
  carve(c0.x, c0.y, 10, h - 14);
  carve(10, h - 14, mid, mid);
  carve(c0.x, c0.y, w - 14, 10);

  // make symmetric: copy top half to bottom half rotated 180 degrees
  for (let y = 0; y < h / 2; y++)
    for (let x = 0; x < w; x++) tiles[idx(w - 1 - x, h - 1 - y)] = tiles[idx(x, y)];

  // resources (placed for player 0 side, mirrored for player 1)
  const resources = [];
  const placed = new Set();
  const addRes = (x, y, kind) => {
    for (const [px, py] of [[x, y], [w - 1 - x, h - 1 - y]]) {
      const k = idx(px, py);
      if (placed.has(k)) continue;
      placed.add(k);
      tiles[k] = T.GRASS;
      resources.push({ tx: px, ty: py, kind });
    }
  };
  // main base
  for (const [dx, dy] of [[6, -4], [7, -3], [7, -1], [7, 1], [6, 2], [8, -2], [8, 0]]) addRes(c0.x + dx, c0.y + dy, 'berry');
  for (const [dx, dy] of [[-3, 6], [-1, 7], [1, 7], [3, 6]]) addRes(c0.x + dx, c0.y + dy, 'crystal');
  // expansion
  for (const [dx, dy] of [[-3, -2], [-3, 0], [-3, 2], [-2, 3], [-2, -3]]) addRes(10 + dx + 1, h - 14 + dy, 'berry');
  for (const [dx, dy] of [[2, 4], [0, 4], [3, 3]]) addRes(10 + dx, h - 14 + dy, 'crystal');
  // contested middle
  for (const [dx, dy] of [[-2, -1], [-1, -2], [-3, 0], [0, -3]]) addRes(mid + dx, mid + dy, 'crystal');

  // connectivity check between bases; carve straight if needed
  const s1c = { x: w - 1 - c0.x, y: h - 1 - c0.y };
  if (!connected(tiles, w, h, c0, s1c)) {
    let x = c0.x, y = c0.y;
    while (x !== s1c.x || y !== s1c.y) {
      x += Math.sign(s1c.x - x); y += Math.sign(s1c.y - y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = idx(x + dx, y + dy);
        if (!placed.has(k) && tileBlocked(tiles[k])) tiles[k] = T.GRASS;
      }
    }
  }
  return {
    w, h, tiles, resources,
    starts: [s0, { tx: w - 3 - s0.tx, ty: h - 3 - s0.ty }],
  };
}

function connected(tiles, w, h, a, b) {
  const seen = new Uint8Array(w * h);
  const q = [a.y * w + a.x];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    const x = i % w, y = (i / w) | 0;
    if (x === b.x && y === b.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!seen[j] && !tileBlocked(tiles[j])) { seen[j] = 1; q.push(j); }
    }
  }
  return false;
}
