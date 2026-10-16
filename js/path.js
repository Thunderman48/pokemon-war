// Grid A* with a node budget, plus line-of-sight path smoothing.
import { TILE } from './config.js';

export class Pathfinder {
  constructor(w, h, blocked) {
    this.w = w; this.h = h;
    this.blocked = blocked; // (tileIndex) => bool
    const n = w * h;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 0;
    this.heap = [];
    this.hf = [];
  }

  // goalTest(x, y) => bool. (gx, gy) is the heuristic target.
  find(sx, sy, goalTest, gx, gy, maxNodes = 2500) {
    const { w, h } = this;
    if (++this.gen > 4e9) { this.gen = 1; this.stamp.fill(0); this.closed.fill(0); }
    const gen = this.gen;
    const start = sy * w + sx;
    const heap = this.heap, hf = this.hf;
    heap.length = 0; hf.length = 0;
    const hfun = (x, y) => {
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
    };
    const push = (i, f) => {
      heap.push(i); hf.push(f);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (hf[p] <= hf[c]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        [hf[p], hf[c]] = [hf[c], hf[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const li = heap.pop(), lf = hf.pop();
      if (heap.length) {
        heap[0] = li; hf[0] = lf;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1;
          let m = c;
          if (l < heap.length && hf[l] < hf[m]) m = l;
          if (r < heap.length && hf[r] < hf[m]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          [hf[m], hf[c]] = [hf[c], hf[m]];
          c = m;
        }
      }
      return top;
    };
    this.g[start] = 0; this.stamp[start] = gen; this.came[start] = -1;
    push(start, hfun(sx, sy));
    let best = start, bestH = hfun(sx, sy), found = -1, count = 0;
    while (heap.length && count++ < maxNodes) {
      const cur = pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      const cx = cur % w, cy = (cur / w) | 0;
      if (goalTest(cx, cy)) { found = cur; break; }
      const hc = hfun(cx, cy);
      if (hc < bestH) { bestH = hc; best = cur; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (this.closed[ni] === gen) continue;
        if (this.blocked(ni) && !goalTest(nx, ny)) continue;
        if (dx && dy && (this.blocked(cy * w + nx) || this.blocked(ny * w + cx))) continue;
        const ng = this.g[cur] + (dx && dy ? 1.4142 : 1);
        if (this.stamp[ni] !== gen || ng < this.g[ni]) {
          this.stamp[ni] = gen; this.g[ni] = ng; this.came[ni] = cur;
          push(ni, ng + hfun(nx, ny));
        }
      }
    }
    let end = found >= 0 ? found : best;
    const out = [];
    while (end !== start && end >= 0) {
      out.push(end);
      end = this.came[end];
    }
    out.reverse();
    return { tiles: out, complete: found >= 0 };
  }

  // Is the straight line between two pixel points walkable for a unit of radius r?
  los(x0, y0, x1, y1, r = 4) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 4);
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const [ox, oy] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) {
        const tx = Math.floor((x + ox) / TILE), ty = Math.floor((y + oy) / TILE);
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
        if (this.blocked(ty * this.w + tx)) return false;
      }
    }
    return true;
  }

  // Convert tile path into smoothed pixel waypoints.
  smooth(sx, sy, tiles, r) {
    const pts = tiles.map((i) => ({ x: (i % this.w) * TILE + TILE / 2, y: ((i / this.w) | 0) * TILE + TILE / 2 }));
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      // only smooth over a limited window to keep it cheap
      j = Math.min(j, i + 12);
      while (j > i && !this.los(ax, ay, pts[j].x, pts[j].y, r)) j--;
      out.push(pts[j]);
      ax = pts[j].x; ay = pts[j].y;
      i = j + 1;
    }
    return out;
  }
}
