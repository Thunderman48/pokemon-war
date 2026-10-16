// Authoritative game simulation. DOM-free so it can run headless (tests) or on the host.
import {
  TILE, TICK, MAX_POP, UNITS, FORMS, BUILDINGS, RESEARCH, RESOURCES, ABILITIES, EVO_XP, EVO_MULT,
  UNIT_KEYS, FORM_KEYS, BUILDING_KEYS, RES_KEYS, effectiveness, researchCost, researchTime,
} from './config.js';
import { generateMap, tileBlocked } from './map.js';
import { Pathfinder } from './path.js';

const CELL = 32;
const circleCache = new Map();
function circle(r) {
  if (!circleCache.has(r)) {
    const pts = [];
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) pts.push([x, y]);
    circleCache.set(r, pts);
  }
  return circleCache.get(r);
}

export function isFlying(u) {
  return u.kind === 'unit' && !!(UNITS[u.type].flying || FORMS[u.form].flying);
}

// Effective stats for a unit given its form and its owner's research.
export function unitStats(u, research) {
  const d = UNITS[u.type];
  const f = FORMS[u.form];
  const m = f.mult || EVO_MULT[f.stage];
  const r = research || {};
  return {
    maxHp: Math.round(d.hp * m.hp),
    dmg: d.dmg * m.dmg * (1 + 0.15 * (r.attack || 0)),
    range: (d.range >= 1 ? d.range + (m.range || 0) : d.range) * TILE,
    speed: d.speed * (m.speed || 1) * TILE,
    sight: d.sight + f.stage,
    cd: d.cd * (m.cd || 1),
    proj: f.proj || d.proj,
    type: f.type,
  };
}

export class World {
  constructor({ seed, players, sim = true }) {
    this.seed = seed;
    this.sim = sim;
    this.map = generateMap(seed);
    const { w, h } = this.map;
    this.w = w; this.h = h;
    this.terrainBlocked = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) this.terrainBlocked[i] = tileBlocked(this.map.tiles[i]) ? 1 : 0;
    this.occ = new Int32Array(w * h);
    this.ents = new Map();
    this.nextId = 1;
    this.players = players.map((p, i) => ({
      id: i, name: p.name || `Player ${i + 1}`, b: 250, c: 50, pop: 0, cap: 0,
      research: {}, gatherMult: p.gatherMult || 1, alive: true, ai: !!p.ai,
      stats: { trained: 0, killed: 0, lost: 0, gathered: 0 }, lastAlert: -99, hinted: {},
    }));
    this.time = 0; this.tick = 0; this.winner = -1;
    this.fx = [];
    this.notes = players.map(() => []);
    this.vis = players.map(() => new Uint8Array(w * h));
    this.explored = players.map(() => new Uint8Array(w * h));
    this.pf = new Pathfinder(w, h, (i) => this.terrainBlocked[i] === 1 || this.occ[i] !== 0);
    this.hash = new Map();
    this.projectiles = [];
    this.effects = [];
    this.pathBudget = 0;
    this.version = 0; // bumps when buildings/resources change (renderer cache)
    if (sim) this.setup();
    this.updateFog();
  }

  // ------------------------------------------------------------------ setup
  setup() {
    for (const r of this.map.resources) this.addResource(r.kind, r.tx, r.ty);
    this.players.forEach((p, pid) => {
      const s = this.map.starts[pid];
      const b = this.addBuilding('center', pid, s.tx, s.ty, true);
      for (let i = 0; i < 5; i++) {
        const spot = this.spawnSpot(b, i);
        this.addUnit('machop', pid, spot.x, spot.y);
      }
    });
    this.updateFog();
    for (const u of this.ents.values()) {
      if (u.kind !== 'unit') continue;
      const r = this.nearestResource(u, 'berry', 20);
      if (r) this.setGather(u, r);
    }
    this.recount();
  }

  // ------------------------------------------------------------------ entity factories
  addUnit(type, owner, x, y, id) {
    const def = UNITS[type];
    const u = {
      id: id || this.nextId++, kind: 'unit', type, form: type, owner, x, y, px: x, py: y,
      xp: 0, hp: def.hp, maxHp: def.hp, radius: def.radius,
      order: { type: 'idle' }, path: null, cd: 0, carry: { kind: null, amt: 0 },
      face: owner === 0 ? 1 : -1, moving: false, anim: 0, scanT: Math.random() * 0.5, repathT: 0,
      gatherT: 0, stuckT: 0, lastX: x, lastY: y, sleep: 0, acd: 0, evoReady: false,
    };
    this.ents.set(u.id, u);
    return u;
  }

  addBuilding(type, owner, tx, ty, built, id) {
    const def = BUILDINGS[type];
    const maxHp = Math.round(def.hp * (this.rlevel(owner, 'fortify') ? 1.5 : 1));
    const b = {
      id: id || this.nextId++, kind: 'building', type, owner, tx, ty, w: def.w, h: def.h,
      x: (tx + def.w / 2) * TILE, y: (ty + def.h / 2) * TILE, px: 0, py: 0,
      radius: (Math.max(def.w, def.h) * TILE) / 2,
      hp: built ? maxHp : maxHp * 0.1, maxHp, built, progress: built ? 1 : 0,
      queue: [], rally: null, cd: 0, healT: 0,
    };
    b.px = b.x; b.py = b.y;
    this.ents.set(b.id, b);
    this.markOcc(b, b.id);
    this.version++;
    return b;
  }

  addResource(kind, tx, ty, id, amount) {
    const r = {
      id: id || this.nextId++, kind: 'res', type: kind, tx, ty, w: 1, h: 1,
      x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, radius: 7,
      amount: amount ?? RESOURCES[kind].amount, max: RESOURCES[kind].amount,
    };
    r.px = r.x; r.py = r.y;
    this.ents.set(r.id, r);
    this.markOcc(r, r.id);
    this.version++;
    return r;
  }

  markOcc(e, val) {
    for (let y = e.ty; y < e.ty + e.h; y++)
      for (let x = e.tx; x < e.tx + e.w; x++) this.occ[y * this.w + x] = val;
  }

  remove(e) {
    this.ents.delete(e.id);
    if (e.kind !== 'unit') { this.markOcc(e, 0); this.version++; }
  }

  // ------------------------------------------------------------------ queries
  rlevel(pid, key) { const p = this.players[pid]; return (p && p.research[key]) || 0; }
  stats(u) { return unitStats(u, this.players[u.owner] && this.players[u.owner].research); }

  blockedTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    const i = ty * this.w + tx;
    return this.terrainBlocked[i] === 1 || this.occ[i] !== 0;
  }
  blockedAt(x, y) { return this.blockedTile(Math.floor(x / TILE), Math.floor(y / TILE)); }
  // flyers only need to stay on the map
  blockedFor(u, x, y) {
    if (isFlying(u)) return x < 4 || y < 4 || x > this.w * TILE - 4 || y > this.h * TILE - 4;
    return this.blockedAt(x, y);
  }

  isVisible(pid, e) {
    if (pid < 0) return true;
    if (e.owner === pid) return true;
    const v = e.kind === 'unit' ? this.vis[pid] : this.explored[pid];
    if (e.kind === 'unit') return v[Math.floor(e.y / TILE) * this.w + Math.floor(e.x / TILE)] > 0;
    for (let y = e.ty; y < e.ty + e.h; y++)
      for (let x = e.tx; x < e.tx + e.w; x++) if (v[y * this.w + x]) return true;
    return false;
  }
  tileVisible(pid, tx, ty) { return this.vis[pid][ty * this.w + tx] > 0; }

  edgeDist(u, t) {
    if (t.kind === 'unit') return Math.hypot(t.x - u.x, t.y - u.y) - t.radius - u.radius;
    const x0 = t.tx * TILE, y0 = t.ty * TILE, x1 = x0 + t.w * TILE, y1 = y0 + t.h * TILE;
    const dx = Math.max(x0 - u.x, 0, u.x - x1), dy = Math.max(y0 - u.y, 0, u.y - y1);
    return Math.hypot(dx, dy) - u.radius;
  }

  // melee attackers can't reach flying Pokémon
  canHit(a, t) {
    if (!isFlying(t)) return true;
    if (a.kind === 'building') return true;
    return UNITS[a.type].range >= 1;
  }

  unitsOf(pid) { const out = []; for (const e of this.ents.values()) if (e.kind === 'unit' && e.owner === pid) out.push(e); return out; }
  buildingsOf(pid) { const out = []; for (const e of this.ents.values()) if (e.kind === 'building' && e.owner === pid) out.push(e); return out; }

  hasBuilt(pid, type) {
    for (const e of this.ents.values()) if (e.kind === 'building' && e.owner === pid && e.type === type && e.built) return true;
    return false;
  }
  reqMet(pid, req) { return !req || this.hasBuilt(pid, req); }
  canAfford(pid, cost) { const p = this.players[pid]; return p.b >= (cost.b || 0) && p.c >= (cost.c || 0); }
  pay(pid, cost, sign = 1) { const p = this.players[pid]; p.b -= sign * (cost.b || 0); p.c -= sign * (cost.c || 0); }

  // Can this research be started now? Returns null if OK, otherwise a reason.
  researchBlock(pid, key) {
    const r = RESEARCH[key];
    if (!r) return 'Unknown research';
    const lvl = this.rlevel(pid, key);
    if (lvl >= (r.levels || 1)) return 'Already researched';
    if (this.researching(pid, key)) return 'Already researching';
    if (r.req && !this.rlevel(pid, r.req)) return `Research ${RESEARCH[r.req].name} first`;
    if (r.reqB && !this.hasBuilt(pid, r.reqB)) return `Requires ${BUILDINGS[r.reqB].name}`;
    return null;
  }

  unitCount(pid, type) {
    let n = 0;
    for (const e of this.ents.values()) {
      if (e.owner !== pid) continue;
      if (e.kind === 'unit' && e.type === type) n++;
      if (e.kind === 'building') n += e.queue.filter((q) => q.u === type).length;
    }
    return n;
  }

  notify(pid, text, kind = 'info', x, y) {
    if (pid >= 0 && pid < this.notes.length) {
      const n = this.notes[pid];
      n.push({ text, kind, x, y });
      if (n.length > 30) n.shift();
    }
  }

  nearestResource(u, kind, maxTiles = 14, avoid = 0) {
    let best = null, bd = maxTiles * TILE;
    for (const e of this.ents.values()) {
      if (e.kind !== 'res' || e.type !== kind || e.id === avoid) continue;
      if (!this.explored[u.owner][e.ty * this.w + e.tx]) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  nearestDropoff(u) {
    let best = null, bd = Infinity;
    for (const e of this.ents.values()) {
      if (e.kind !== 'building' || e.owner !== u.owner || !e.built || !BUILDINGS[e.type].dropoff) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  canPlace(type, tx, ty, pid) {
    const def = BUILDINGS[type];
    if (!def) return false;
    if (tx < 1 || ty < 1 || tx + def.w > this.w - 1 || ty + def.h > this.h - 1) return false;
    for (let y = ty; y < ty + def.h; y++)
      for (let x = tx; x < tx + def.w; x++) {
        const i = y * this.w + x;
        if (this.terrainBlocked[i] || this.occ[i]) return false;
        if (pid >= 0 && !this.players[pid].noFog && !this.explored[pid][i]) return false;
      }
    // keep enemy ground units from being built on top of
    for (const e of this.ents.values()) {
      if (e.kind !== 'unit' || e.owner === pid || isFlying(e)) continue;
      if (e.x > tx * TILE - 4 && e.x < (tx + def.w) * TILE + 4 && e.y > ty * TILE - 4 && e.y < (ty + def.h) * TILE + 4) return false;
    }
    return true;
  }

  recount() {
    for (const p of this.players) { p.pop = 0; p.cap = 0; }
    for (const e of this.ents.values()) {
      if (e.owner < 0 || e.owner === undefined) continue;
      const p = this.players[e.owner];
      if (!p) continue;
      if (e.kind === 'unit') p.pop += UNITS[e.type].pop;
      else if (e.kind === 'building') {
        let pop = BUILDINGS[e.type].pop || 0;
        if (e.type === 'mart' && p.research.martplus) pop = 15;
        if (e.built) p.cap += pop;
        for (const q of e.queue) if (q.u) p.pop += UNITS[q.u].pop;
      }
    }
    for (const p of this.players) p.cap = Math.min(MAX_POP, p.cap);
  }

  // ------------------------------------------------------------------ commands
  issue(pid, cmd) {
    if (!this.sim || this.winner >= 0 || !cmd) return;
    const own = (ids) => (ids || []).map((id) => this.ents.get(id)).filter((e) => e && e.kind === 'unit' && e.owner === pid);
    const ownB = (id) => { const b = this.ents.get(id); return b && b.kind === 'building' && b.owner === pid ? b : null; };
    switch (cmd.c) {
      case 'move': {
        const units = own(cmd.ids);
        const slots = this.formation(units, cmd.x, cmd.y);
        units.forEach((u, i) => {
          u.order = { type: 'move', x: slots[i].x, y: slots[i].y, attack: !!cmd.attack && !UNITS[u.type].worker };
          this.clearPath(u);
        });
        break;
      }
      case 'target': {
        const t = this.ents.get(cmd.target);
        if (!t) return;
        for (const u of own(cmd.ids)) {
          const worker = UNITS[u.type].worker;
          if (t.kind === 'res') {
            if (worker) this.setGather(u, t);
            else { u.order = { type: 'move', x: t.x, y: t.y + TILE, attack: true }; this.clearPath(u); }
          } else if (t.owner !== pid) {
            if (this.canHit(u, t)) { u.order = { type: 'attack', target: t.id }; this.clearPath(u); }
            else { u.order = { type: 'move', x: t.x, y: t.y, attack: true }; this.clearPath(u); }
          } else if (t.kind === 'building' && worker && !t.built) {
            u.order = { type: 'build', target: t.id }; this.clearPath(u);
          } else if (t.kind === 'building' && worker && u.carry.amt > 0 && BUILDINGS[t.type].dropoff) {
            u.order = { type: 'gather', res: 0, kind: u.carry.kind, phase: 'back' }; this.clearPath(u);
          } else {
            u.order = { type: 'move', x: t.x, y: t.y + (t.kind === 'building' ? t.h * TILE / 2 + 8 : 0), attack: false };
            this.clearPath(u);
          }
        }
        break;
      }
      case 'stop':
        for (const u of own(cmd.ids)) { u.order = { type: 'idle' }; this.clearPath(u); }
        break;
      case 'build': {
        const def = BUILDINGS[cmd.type];
        const workers = own(cmd.ids).filter((u) => UNITS[u.type].worker);
        if (!def || !workers.length) return;
        if (!this.reqMet(pid, def.req)) return this.notify(pid, `Requires ${BUILDINGS[def.req].name}`, 'warn');
        if (!this.canAfford(pid, def.cost)) return this.notify(pid, 'Not enough resources', 'warn');
        if (!this.canPlace(cmd.type, cmd.tx, cmd.ty, pid)) return this.notify(pid, "Can't build there", 'warn');
        this.pay(pid, def.cost);
        const b = this.addBuilding(cmd.type, pid, cmd.tx, cmd.ty, false);
        for (const u of workers) { u.order = { type: 'build', target: b.id }; this.clearPath(u); }
        break;
      }
      case 'train': {
        const b = ownB(cmd.id);
        const def = UNITS[cmd.type];
        if (!b || !b.built || !def || !(BUILDINGS[b.type].trains || []).includes(cmd.type)) return;
        if (b.queue.length >= 5) return this.notify(pid, 'Queue is full', 'warn');
        if (!this.reqMet(pid, def.req)) return this.notify(pid, `Requires ${BUILDINGS[def.req].name}`, 'warn');
        if (def.limit && this.unitCount(pid, cmd.type) >= def.limit) return this.notify(pid, `Only ${def.limit} ${def.name} allowed`, 'warn');
        if (!this.canAfford(pid, def.cost)) return this.notify(pid, 'Not enough resources', 'warn');
        const p = this.players[pid];
        if (p.pop + def.pop > p.cap) return this.notify(pid, 'Need more supply — build a Poké Mart', 'warn');
        this.pay(pid, def.cost);
        b.queue.push({ u: cmd.type, t: 0 });
        this.recount();
        break;
      }
      case 'research': {
        const b = ownB(cmd.id);
        if (!b || !b.built || !(BUILDINGS[b.type].research || []).includes(cmd.key)) return;
        const why = this.researchBlock(pid, cmd.key);
        if (why) return this.notify(pid, why, 'warn');
        if (b.queue.length >= 5) return this.notify(pid, 'Queue is full', 'warn');
        const lvl = this.rlevel(pid, cmd.key);
        const cost = researchCost(cmd.key, lvl);
        if (!this.canAfford(pid, cost)) return this.notify(pid, 'Not enough resources', 'warn');
        this.pay(pid, cost);
        b.queue.push({ r: cmd.key, t: 0, lvl });
        break;
      }
      case 'cancel': {
        const b = ownB(cmd.id);
        if (!b) return;
        if (!b.built) {
          this.pay(pid, BUILDINGS[b.type].cost, -0.75);
          this.remove(b);
          break;
        }
        const i = cmd.i ?? b.queue.length - 1;
        const q = b.queue[i];
        if (!q) return;
        this.pay(pid, q.u ? UNITS[q.u].cost : researchCost(q.r, q.lvl), -1);
        b.queue.splice(i, 1);
        this.recount();
        break;
      }
      case 'rally': {
        const b = ownB(cmd.id);
        if (b) b.rally = { x: cmd.x, y: cmd.y, target: cmd.target || 0 };
        break;
      }
      case 'evolve': {
        const u = own([cmd.id])[0];
        if (!u || !u.evoReady) return;
        const opt = (FORMS[u.form].next || []).find((n) => n.to === cmd.to);
        if (!opt || !this.rlevel(pid, opt.r)) return;
        this.evolve(u, cmd.to);
        break;
      }
      case 'cast': {
        const ab = ABILITIES[cmd.key];
        if (!ab || !this.rlevel(pid, ab.research)) return;
        const cands = own(cmd.ids).filter((u) => FORMS[u.form].ability === cmd.key && u.acd <= 0 && u.sleep <= 0);
        if (!cands.length) return this.notify(pid, `${ab.name} is not ready`, 'warn');
        cands.sort((a, b) => Math.hypot(a.x - cmd.x, a.y - cmd.y) - Math.hypot(b.x - cmd.x, b.y - cmd.y));
        const u = cands[0];
        const prev = u.order.type === 'cast' ? u.order.prev : u.order;
        u.order = { type: 'cast', key: cmd.key, x: cmd.x, y: cmd.y, prev };
        this.clearPath(u);
        break;
      }
      case 'surrender':
        this.players[pid].alive = false;
        this.checkWin(true);
        break;
    }
  }

  researching(pid, key) {
    for (const e of this.ents.values())
      if (e.kind === 'building' && e.owner === pid && e.queue.some((q) => q.r === key)) return true;
    return false;
  }

  setGather(u, r) {
    u.order = { type: 'gather', res: r.id, kind: r.type, phase: u.carry.amt > 0 && u.carry.kind !== r.type ? 'back' : 'to' };
    if (u.order.phase === 'back') u.order.after = r.type;
    this.clearPath(u);
  }

  formation(units, x, y) {
    const n = units.length;
    if (!n) return [];
    const r = units.reduce((s, u) => s + u.radius, 0) / n;
    const sp = r * 2 + 3;
    const side = Math.ceil(Math.sqrt(n));
    const slots = [];
    for (let i = 0; i < n; i++) {
      const gx = (i % side) - (side - 1) / 2, gy = Math.floor(i / side) - (Math.ceil(n / side) - 1) / 2;
      slots.push({ x: x + gx * sp, y: y + gy * sp });
    }
    // greedy assignment: each unit takes nearest free slot
    const out = new Array(n);
    const used = new Array(n).fill(false);
    const order = units.map((u, i) => i).sort((a, b) =>
      Math.hypot(units[b].x - x, units[b].y - y) - Math.hypot(units[a].x - x, units[a].y - y));
    for (const i of order) {
      let best = -1, bd = Infinity;
      for (let s = 0; s < n; s++) {
        if (used[s]) continue;
        const d = Math.hypot(slots[s].x - units[i].x, slots[s].y - units[i].y);
        if (d < bd) { bd = d; best = s; }
      }
      used[best] = true;
      out[i] = slots[best];
    }
    return out;
  }

  // ------------------------------------------------------------------ movement
  clearPath(u) { u.path = null; u.pathKey = null; u.repathT = 0; }

  // Ensure u has a path toward target (entity or point). Returns false if waiting for path budget.
  ensurePath(u, key, target) {
    if (u.pathKey === key && u.path) return true;
    if (isFlying(u)) {
      // flyers go straight there
      const W = this.w * TILE, H = this.h * TILE;
      u.path = [{ x: Math.max(6, Math.min(W - 6, target.x)), y: Math.max(6, Math.min(H - 6, target.y)) }];
      u.pathKey = key;
      u.pathComplete = true;
      return true;
    }
    // can't repath yet: keep following the old path if we have one
    if (u.repathT > 0 || this.pathBudget <= 0) return !!(u.path && u.path.length);
    this.pathBudget--;
    u.repathT = 0.4;
    const sx = Math.floor(u.x / TILE), sy = Math.floor(u.y / TILE);
    let res, final = null;
    if (target.kind === 'building' || target.kind === 'res') {
      const x0 = target.tx, y0 = target.ty, x1 = target.tx + target.w - 1, y1 = target.ty + target.h - 1;
      const goal = (x, y) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1 && !(x >= x0 && x <= x1 && y >= y0 && y <= y1);
      res = this.pf.find(sx, sy, goal, (x0 + x1) / 2, (y0 + y1) / 2);
    } else {
      let gx = Math.floor(target.x / TILE), gy = Math.floor(target.y / TILE);
      if (this.blockedTile(gx, gy)) {
        const f = this.nearestFree(gx, gy, 6);
        if (f) { gx = f.x; gy = f.y; }
      } else final = { x: target.x, y: target.y };
      res = this.pf.find(sx, sy, (x, y) => x === gx && y === gy, gx, gy);
      if (!res.complete) final = null;
    }
    const pts = this.pf.smooth(u.x, u.y, res.tiles, Math.min(u.radius, 6));
    if (final) {
      if (pts.length) pts[pts.length - 1] = final; else pts.push(final);
    }
    u.path = pts;
    u.pathKey = key;
    u.pathComplete = res.complete;
    return true;
  }

  nearestFree(tx, ty, maxR) {
    for (let r = 1; r <= maxR; r++)
      for (let y = ty - r; y <= ty + r; y++)
        for (let x = tx - r; x <= tx + r; x++) {
          if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
          if (!this.blockedTile(x, y)) return { x, y };
        }
    return null;
  }

  // Move along path. Returns true when the path is exhausted.
  step(u, dt, speed) {
    if (!u.path || !u.path.length) { u.moving = false; return true; }
    let budget = speed * dt;
    while (budget > 0 && u.path.length) {
      const wp = u.path[0];
      const dx = wp.x - u.x, dy = wp.y - u.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.5) u.face = dx > 0 ? 1 : -1;
      if (d <= budget) {
        u.x = wp.x; u.y = wp.y; budget -= d; u.path.shift();
      } else {
        const nx = u.x + (dx / d) * budget, ny = u.y + (dy / d) * budget;
        if (this.blockedFor(u, nx, ny) && !this.blockedFor(u, u.x, u.y)) {
          // something appeared in the way: try sliding, then repath
          if (!this.blockedFor(u, nx, u.y)) u.x = nx;
          else if (!this.blockedFor(u, u.x, ny)) u.y = ny;
          else { u.path = null; u.pathKey = null; }
        } else { u.x = nx; u.y = ny; }
        budget = 0;
      }
    }
    u.moving = true;
    return !u.path || u.path.length === 0;
  }

  // Walk toward an entity until within `reach` px (edge distance). Returns true when in reach.
  approach(u, t, reach, dt, st) {
    if (this.edgeDist(u, t) <= reach) { u.moving = false; u.path = null; u.pathKey = null; return true; }
    const key = 'e' + t.id + (t.kind === 'unit' ? ':' + Math.floor(t.x / 32) + ',' + Math.floor(t.y / 32) : '');
    if (!this.ensurePath(u, key, t)) { u.moving = false; return false; }
    if (this.step(u, dt, st.speed)) {
      // path ended but not in reach: walk directly if close, else repath later
      if (t.kind === 'unit' || this.edgeDist(u, t) < TILE || isFlying(u)) {
        const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1;
        const nx = u.x + (dx / d) * st.speed * dt, ny = u.y + (dy / d) * st.speed * dt;
        if (!this.blockedFor(u, nx, ny)) { u.x = nx; u.y = ny; u.moving = true; }
        u.face = dx > 0 ? 1 : -1;
      }
      u.pathKey = null; u.path = null;
    }
    return false;
  }

  // ------------------------------------------------------------------ simulation
  update(dt = TICK) {
    if (!this.sim) return;
    this.tick++;
    this.time += dt;
    this.pathBudget = 40;
    for (const e of this.ents.values()) { e.px = e.x; e.py = e.y; }
    this.buildHash();
    for (const e of [...this.ents.values()]) {
      if (!this.ents.has(e.id)) continue;
      if (e.kind === 'unit') this.updateUnit(e, dt);
      else if (e.kind === 'building') this.updateBuilding(e, dt);
    }
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.separate();
    if (this.tick % 4 === 0) this.updateFog();
    if (this.tick % 10 === 0) { this.recount(); this.checkWin(); }
  }

  buildHash() {
    this.hash.clear();
    for (const e of this.ents.values()) {
      if (e.kind !== 'unit') continue;
      const k = Math.floor(e.x / CELL) + Math.floor(e.y / CELL) * 1000;
      let a = this.hash.get(k);
      if (!a) this.hash.set(k, (a = []));
      a.push(e);
    }
  }

  nearUnits(x, y, r, fn) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const a = this.hash.get(cx + cy * 1000);
        if (a) for (const e of a) fn(e);
      }
  }

  findEnemy(u, radius, includeBuildings = true) {
    let best = null, bs = Infinity;
    const pid = u.owner;
    this.nearUnits(u.x, u.y, radius, (e) => {
      if (e.owner === pid || !this.ents.has(e.id) || !this.isVisible(pid, e) || !this.canHit(u, e)) return;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d > radius) return;
      const s = d + (UNITS[e.type].worker ? 40 : 0);
      if (s < bs) { bs = s; best = e; }
    });
    if (!best && includeBuildings) {
      for (const e of this.ents.values()) {
        if (e.kind !== 'building' || e.owner === pid) continue;
        const d = this.edgeDist(u, e);
        if (d < radius && d + 200 < bs && this.isVisible(pid, e)) { bs = d + 200; best = e; }
      }
    }
    return best;
  }

  updateUnit(u, dt) {
    const def = UNITS[u.type];
    const st = this.stats(u);
    if (u.cd > 0) u.cd -= dt;
    if (u.acd > 0) u.acd -= dt;
    if (u.anim > 0) u.anim -= dt;
    if (u.repathT > 0) u.repathT -= dt;
    u.scanT -= dt;
    u.moving = false;
    if (u.sleep > 0) { u.sleep -= dt; return; }
    // pushed into a building footprint? pop out
    if (!isFlying(u) && this.blockedAt(u.x, u.y)) {
      const f = this.nearestFree(Math.floor(u.x / TILE), Math.floor(u.y / TILE), 5);
      if (f) { u.x = f.x * TILE + TILE / 2; u.y = f.y * TILE + TILE / 2; u.path = null; u.pathKey = null; }
    }
    const o = u.order;
    switch (o.type) {
      case 'idle':
        if (!def.worker && u.scanT <= 0) {
          u.scanT = 0.4;
          const e = this.findEnemy(u, st.sight * TILE);
          if (e) u.order = { type: 'attack', target: e.id, auto: true, home: { x: u.x, y: u.y } };
        }
        break;
      case 'move': {
        if (o.attack && u.scanT <= 0) {
          u.scanT = 0.3;
          const e = this.findEnemy(u, st.sight * TILE);
          if (e) { u.order = { type: 'attack', target: e.id, auto: true, resume: o }; this.clearPath(u); break; }
        }
        if (!this.ensurePath(u, 'p' + o.x + ',' + o.y, o)) break;
        const done = this.step(u, dt, st.speed);
        if (done) {
          if (!u.pathComplete && Math.hypot(o.x - u.x, o.y - u.y) > TILE * 2 && (u.tries = (u.tries || 0) + 1) < 4) {
            u.pathKey = null; u.path = null;
          } else { u.tries = 0; u.order = { type: 'idle' }; }
        }
        this.checkStuck(u, dt, o);
        break;
      }
      case 'attack': {
        const t = this.ents.get(o.target);
        const lost = !t || t.owner === u.owner || (t.kind === 'unit' && !this.isVisible(u.owner, t)) || !this.canHit(u, t);
        const leash = o.auto && t && o.home && Math.hypot(t.x - o.home.x, t.y - o.home.y) > (st.sight + 4) * TILE;
        if (lost || leash) {
          if (o.resume) { u.order = o.resume; this.clearPath(u); }
          else if (o.home && leash) { u.order = { type: 'move', x: o.home.x, y: o.home.y, attack: false }; this.clearPath(u); }
          else {
            u.order = { type: 'idle' }; u.scanT = 0;
            // keep fighting: look for another target close by
            if (!def.worker) {
              const e = this.findEnemy(u, st.sight * TILE);
              if (e) u.order = { type: 'attack', target: e.id, auto: true };
            }
          }
          break;
        }
        // auto-targets: switch to a closer threat if current target is a building
        if (o.auto && t.kind === 'building' && u.scanT <= 0) {
          u.scanT = 0.5;
          const e = this.findEnemy(u, st.range + TILE * 2, false);
          if (e) { o.target = e.id; break; }
        }
        if (this.approach(u, t, st.range, dt, st)) {
          u.face = t.x > u.x ? 1 : -1;
          if (u.cd <= 0) { this.strike(u, t, st); u.cd = st.cd; }
        }
        this.checkStuck(u, dt, o);
        break;
      }
      case 'cast': {
        const ab = ABILITIES[o.key];
        if (u.acd > 0) { u.order = o.prev || { type: 'idle' }; this.clearPath(u); break; }
        if (Math.hypot(o.x - u.x, o.y - u.y) <= ab.range * TILE) {
          this.performAbility(u, o.key, o.x, o.y);
          u.acd = ab.cd;
          u.anim = 0.4;
          u.order = o.prev && o.prev.type !== 'cast' ? o.prev : { type: 'idle' };
          this.clearPath(u);
        } else {
          if (this.ensurePath(u, 'c' + o.x + ',' + o.y, o) && this.step(u, dt, st.speed)) u.pathKey = null;
          this.checkStuck(u, dt, o);
        }
        break;
      }
      case 'gather': this.updateGather(u, dt, st); break;
      case 'build': {
        const b = this.ents.get(o.target);
        if (!b || b.built || b.owner !== u.owner) {
          u.order = { type: 'idle' };
          // go back to work automatically
          const r = this.nearestResource(u, 'berry', 12);
          if (r && b && b.built) this.setGather(u, r);
          break;
        }
        if (this.approach(u, b, 6, dt, st)) {
          const bd = BUILDINGS[b.type];
          // extra builders help, with diminishing returns (1, +0.6, +0.36, ...)
          if (b.buildTick !== this.tick) { b.buildTick = this.tick; b.builders = 0; }
          const rate = Math.pow(0.6, b.builders++);
          b.progress += (dt * rate) / bd.time;
          b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * dt * rate) / bd.time);
          u.anim = 0.2;
          if (b.progress >= 1) this.completeBuilding(b);
        }
        break;
      }
    }
  }

  checkStuck(u, dt, o) {
    u.stuckT += dt;
    if (u.stuckT < 1) return;
    const moved = Math.hypot(u.x - u.lastX, u.y - u.lastY);
    u.lastX = u.x; u.lastY = u.y; u.stuckT = 0;
    if (u.path && moved < 4) {
      u.stuck = (u.stuck || 0) + 1;
      if (o.type === 'move' && u.stuck >= 3 && Math.hypot(o.x - u.x, o.y - u.y) < TILE * 3) {
        u.order = { type: 'idle' }; this.clearPath(u); u.stuck = 0;
      } else { u.path = null; u.pathKey = null; }
    } else u.stuck = 0;
  }

  updateGather(u, dt, st) {
    const o = u.order;
    const rdef = RESOURCES[o.kind];
    const p = this.players[u.owner];
    const per = Math.round(rdef.per * (p.research.bigbag ? 1.5 : 1));
    const time = rdef.time * (1 - 0.2 * (p.research.harvest || 0));
    if (o.phase !== 'back') {
      let r = this.ents.get(o.res);
      if (!r || r.kind !== 'res') {
        r = this.nearestResource(u, o.kind, 14);
        if (!r) { if (u.carry.amt > 0) o.phase = 'back'; else u.order = { type: 'idle' }; return; }
        o.res = r.id; this.clearPath(u);
      }
      if (u.carry.amt >= per) { o.phase = 'back'; this.clearPath(u); return; }
      if (this.approach(u, r, 6, dt, st)) {
        u.face = r.x > u.x ? 1 : -1;
        u.gatherT += dt;
        u.anim = 0.2;
        o.phase = 'mine';
        if (u.gatherT >= time) {
          u.gatherT = 0;
          const amt = Math.min(per, r.amount);
          r.amount -= amt;
          u.carry = { kind: o.kind, amt };
          if (r.amount <= 0) this.remove(r);
          o.phase = 'back';
          this.clearPath(u);
        }
      } else u.gatherT = 0;
      this.checkStuck(u, dt, o);
    } else {
      const d = this.nearestDropoff(u);
      if (!d) { u.order = { type: 'idle' }; return; }
      if (this.approach(u, d, 6, dt, st)) {
        if (u.carry.amt > 0) {
          const amt = Math.round(u.carry.amt * p.gatherMult);
          if (u.carry.kind === 'berry') p.b += amt; else p.c += amt;
          p.stats.gathered += amt;
        }
        u.carry = { kind: null, amt: 0 };
        if (o.after) { o.kind = o.after; o.after = null; }
        if (!o.res || !this.ents.has(o.res)) {
          const r = this.nearestResource(u, o.kind, 14);
          if (!r) { u.order = { type: 'idle' }; return; }
          o.res = r.id;
        }
        o.phase = 'to';
        this.clearPath(u);
      }
      this.checkStuck(u, dt, o);
    }
  }

  strike(u, t, st) {
    u.anim = 0.25;
    const isB = u.kind === 'building';
    const def = isB ? BUILDINGS[u.type] : UNITS[u.type];
    const atkType = isB ? def.type : st.type;
    let dmg = st.dmg * effectiveness(atkType, t.kind === 'unit' ? FORMS[t.form].type : 'building');
    if (t.kind === 'building' && def.siege) dmg *= def.siege;
    const proj = isB ? def.proj : st.proj;
    if (proj) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      const dur = Math.max(0.12, d / (proj === 'breath' ? 200 : 260));
      const lift = isFlying(u) ? 12 : 6;
      this.projectiles.push({ t: t.id, dmg, src: u.id, owner: u.owner, left: dur, splash: def.splash || 0, atkType, x: t.x, y: t.y });
      this.fx.push({ k: 'p', x1: u.x | 0, y1: (u.y - lift) | 0, x2: t.x | 0, y2: (t.y - (isFlying(t) ? 12 : 4)) | 0, d: dur, s: proj });
    } else {
      this.fx.push({ k: 'hit', x: ((u.x + t.x) / 2) | 0, y: ((u.y + t.y) / 2 - 4) | 0 });
      this.damage(t, dmg, u.id, u.owner);
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.left -= dt;
      if (p.left > 0) continue;
      this.projectiles.splice(i, 1);
      const t = this.ents.get(p.t);
      if (p.splash) {
        const cx = t ? t.x : p.x, cy = t ? t.y : p.y, r = p.splash * TILE;
        this.fx.push({ k: 'boom', x: cx | 0, y: cy | 0, r: r | 0 });
        if (t && t.kind === 'building' && t.owner !== p.owner) this.damage(t, p.dmg, p.src, p.owner);
        this.nearUnits(cx, cy, r + 12, (e) => {
          if (e.owner === p.owner || !this.ents.has(e.id)) return;
          if (Math.hypot(e.x - cx, e.y - cy) > r + e.radius) return;
          const dmg = p.dmg * effectiveness(p.atkType, FORMS[e.form].type) / effectiveness(p.atkType, t && t.kind === 'unit' ? FORMS[t.form].type : 'building');
          this.damage(e, e === t ? p.dmg : dmg * 0.7, p.src, p.owner);
        });
      } else if (t && t.owner !== p.owner) this.damage(t, p.dmg, p.src, p.owner);
    }
  }

  performAbility(u, key, x, y) {
    const ab = ABILITIES[key];
    const stage = FORMS[u.form].stage;
    const r = ab.radius * TILE;
    if (key === 'thunder') {
      const dmg = ab.dmg * (1 + 0.5 * stage) * (1 + 0.15 * this.rlevel(u.owner, 'attack'));
      this.effects.push({ k: 'thunder', x, y, r, t: ab.delay, owner: u.owner, src: u.id, dmg });
      this.fx.push({ k: 'zap', x: x | 0, y: y | 0, r: r | 0 });
    } else if (key === 'heal') {
      const amt = ab.amount * (1 + 0.3 * stage);
      this.nearUnits(x, y, r + 8, (e) => {
        if (e.owner !== u.owner || Math.hypot(e.x - x, e.y - y) > r + e.radius) return;
        e.hp = Math.min(e.maxHp, e.hp + amt);
      });
      this.fx.push({ k: 'healp', x: x | 0, y: y | 0, r: r | 0 });
    } else if (key === 'sleep') {
      const dur = ab.dur + stage;
      this.nearUnits(x, y, r + 8, (e) => {
        if (e.owner === u.owner || Math.hypot(e.x - x, e.y - y) > r + e.radius) return;
        e.sleep = UNITS[e.type].limit ? dur / 2 : dur; // legendaries resist
        e.path = null; e.pathKey = null;
      });
      this.fx.push({ k: 'sleep', x: x | 0, y: y | 0, r: r | 0 });
    }
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t -= dt;
      if (e.t > 0) continue;
      this.effects.splice(i, 1);
      if (e.k === 'thunder') {
        this.fx.push({ k: 'bolt', x: e.x | 0, y: e.y | 0, r: e.r | 0 });
        this.nearUnits(e.x, e.y, e.r + 12, (t) => {
          if (t.owner === e.owner || !this.ents.has(t.id) || Math.hypot(t.x - e.x, t.y - e.y) > e.r + t.radius) return;
          this.damage(t, e.dmg * effectiveness('electric', FORMS[t.form].type), e.src, e.owner);
        });
      }
    }
  }

  damage(t, dmg, srcId, srcOwner) {
    if (t.kind === 'unit') dmg *= 1 - 0.12 * this.rlevel(t.owner, 'defense');
    t.hp -= dmg;
    const src = this.ents.get(srcId);
    if (src && src.kind === 'unit') {
      src.xp += dmg;
      this.tryEvolve(src);
    }
    const p = this.players[t.owner];
    if (p && this.time - p.lastAlert > 15 && !(src && this.isVisible(t.owner, src) && this.nearOwnArmy(t))) {
      p.lastAlert = this.time;
      this.notify(t.owner, t.kind === 'building' ? 'Your base is under attack!' : 'Your Pokémon are under attack!', 'alert', t.x, t.y);
    }
    // retaliate
    if (t.kind === 'unit' && src && t.order.type === 'idle' && this.canHit(t, src)) {
      t.order = { type: 'attack', target: src.id, auto: true, home: { x: t.x, y: t.y } };
    }
    if (t.hp <= 0) {
      this.fx.push({ k: 'die', x: t.x | 0, y: t.y | 0, b: t.kind === 'building' ? 1 : 0 });
      this.remove(t);
      if (p) p.stats.lost++;
      if (srcOwner >= 0 && this.players[srcOwner]) this.players[srcOwner].stats.killed++;
      if (t.kind === 'building') { this.recount(); this.notify(t.owner, `${BUILDINGS[t.type].name} destroyed!`, 'alert', t.x, t.y); }
    }
  }

  nearOwnArmy(t) {
    let n = 0;
    this.nearUnits(t.x, t.y, TILE * 6, (e) => { if (e.owner === t.owner && !UNITS[e.type].worker) n++; });
    return n >= 3;
  }

  // Evolve when XP is reached AND the evolution has been researched.
  tryEvolve(u) {
    const f = FORMS[u.form];
    if (!f.next || u.evoReady) return;
    const need = EVO_XP[f.stage + 1];
    if (u.xp < need) return;
    const p = this.players[u.owner];
    const ready = f.next.filter((n) => p.research[n.r]);
    if (!ready.length) {
      // teach the player once per research
      const r = f.next[0].r;
      if (!p.hinted[r]) {
        p.hinted[r] = 1;
        const at = Object.keys(BUILDINGS).find((k) => (BUILDINGS[k].research || []).includes(r));
        this.notify(u.owner, `${f.name} is ready to evolve! Research ${RESEARCH[r].name} at the ${BUILDINGS[at].name}.`, 'evo', u.x, u.y);
      }
      return;
    }
    if (f.next[0].choice) {
      if (p.ai) this.evolve(u, ready[Math.floor(Math.random() * ready.length)].to);
      else {
        u.evoReady = true;
        this.notify(u.owner, `${f.name} can evolve! Select it and choose an evolution.`, 'evo', u.x, u.y);
      }
      return;
    }
    this.evolve(u, ready[0].to);
  }

  evolve(u, to) {
    const before = FORMS[u.form].name;
    const ratio = u.hp / u.maxHp;
    u.form = to;
    u.evoReady = false;
    const st = this.stats(u);
    u.maxHp = st.maxHp;
    u.hp = Math.min(u.maxHp, u.maxHp * ratio + u.maxHp * 0.25);
    u.radius = UNITS[u.type].radius + FORMS[to].stage * 1.5;
    this.clearPath(u);
    this.fx.push({ k: 'evo', x: u.x | 0, y: u.y | 0, id: u.id });
    this.notify(u.owner, `${before} evolved into ${FORMS[to].name}!`, 'evo', u.x, u.y);
    this.tryEvolve(u);
  }

  completeBuilding(b) {
    b.built = true;
    b.progress = 1;
    b.hp = Math.max(b.hp, b.maxHp * 0.95);
    this.recount();
    this.notify(b.owner, `${BUILDINGS[b.type].name} complete`, 'done', b.x, b.y);
    this.fx.push({ k: 'done', x: b.x | 0, y: b.y | 0 });
  }

  completeResearch(pid, key) {
    const p = this.players[pid];
    p.research[key] = (p.research[key] || 0) + 1;
    const r = RESEARCH[key];
    this.notify(pid, `${r.name}${r.levels > 1 ? ' ' + p.research[key] : ''} researched!`, 'done');
    if (key === 'fortify') {
      for (const b of this.buildingsOf(pid)) { b.maxHp = Math.round(b.maxHp * 1.5); b.hp *= 1.5; }
    }
    if (key === 'martplus') this.recount();
    // Pokémon that already have the XP evolve right away
    for (const u of this.unitsOf(pid)) this.tryEvolve(u);
  }

  spawnSpot(b, n = 0) {
    // ring of tiles around the building, starting below it
    const spots = [];
    for (let x = b.tx - 1; x <= b.tx + b.w; x++) spots.push([x, b.ty + b.h]);
    for (let y = b.ty + b.h - 1; y >= b.ty - 1; y--) spots.push([b.tx + b.w, y], [b.tx - 1, y]);
    for (let x = b.tx; x < b.tx + b.w; x++) spots.push([x, b.ty - 1]);
    const free = spots.filter(([x, y]) => !this.blockedTile(x, y));
    const [x, y] = free.length ? free[n % free.length] : [b.tx, b.ty + b.h];
    return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
  }

  updateBuilding(b, dt) {
    if (!b.built) return;
    const def = BUILDINGS[b.type];
    const p = this.players[b.owner];
    if (def.dmg) {
      b.cd -= dt;
      if (b.cd <= 0) {
        const lvl = p.research.towerup || 0;
        const fake = { x: b.x, y: b.y, radius: 0, owner: b.owner, kind: 'building' };
        const t = this.findEnemy(fake, (def.range + lvl) * TILE, false);
        if (t) {
          const st = { dmg: def.dmg * (1 + 0.4 * lvl) * (1 + 0.15 * (p.research.attack || 0)) };
          this.strike(b, t, st);
          b.cd = def.cd;
        }
      }
    }
    if (def.heal) {
      b.healT -= dt;
      if (b.healT <= 0) {
        b.healT = 1;
        this.nearUnits(b.x, b.y, TILE * 5, (u) => {
          if (u.owner === b.owner && u.hp < u.maxHp) {
            u.hp = Math.min(u.maxHp, u.hp + 4);
            if (this.tick % 40 < 20) this.fx.push({ k: 'heal', x: u.x | 0, y: u.y | 0 });
          }
        });
      }
    }
    const q = b.queue[0];
    if (!q) return;
    if (q.u) {
      const ud = UNITS[q.u];
      q.t += dt;
      if (q.t >= ud.time * (p.research.drill ? 0.75 : 1)) {
        b.queue.shift();
        const s = this.spawnSpot(b, Math.floor(Math.random() * 6));
        const u = this.addUnit(q.u, b.owner, s.x, s.y);
        p.stats.trained++;
        if (b.rally) {
          const rt = b.rally.target && this.ents.get(b.rally.target);
          if (ud.worker && rt && rt.kind === 'res') this.setGather(u, rt);
          else u.order = { type: 'move', x: b.rally.x, y: b.rally.y, attack: !ud.worker };
        } else if (ud.worker) {
          const r = this.nearestResource(u, 'berry', 14);
          if (r) this.setGather(u, r);
        }
      }
    } else if (q.r) {
      q.t += dt;
      if (q.t >= researchTime(q.r, q.lvl)) {
        b.queue.shift();
        this.completeResearch(b.owner, q.r);
      }
    }
  }

  separate() {
    for (const a of this.ents.values()) {
      if (a.kind !== 'unit') continue;
      const fa = isFlying(a);
      this.nearUnits(a.x, a.y, a.radius + 14, (b) => {
        if (b.id <= a.id || b.kind !== 'unit' || isFlying(b) !== fa) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.radius + b.radius + 1;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 0.01;
        const push = Math.min(1.6, (min - d) / 2);
        const ux = d2 ? dx / d : Math.random() - 0.5, uy = d2 ? dy / d : Math.random() - 0.5;
        // moving units shove idle ones more
        const wa = a.moving && !b.moving ? 0.25 : !a.moving && b.moving ? 1.75 : 1;
        const wb = 2 - wa;
        const ax = a.x - ux * push * wa, ay = a.y - uy * push * wa;
        const bx = b.x + ux * push * wb, by = b.y + uy * push * wb;
        if (!this.blockedFor(a, ax, ay)) { a.x = ax; a.y = ay; }
        if (!this.blockedFor(b, bx, by)) { b.x = bx; b.y = by; }
      });
    }
  }

  updateFog(only) {
    const { w, h } = this;
    this.players.forEach((p, pid) => {
      if (only !== undefined && pid !== only) return;
      const vis = this.vis[pid], exp = this.explored[pid];
      vis.fill(0);
      for (const e of this.ents.values()) {
        if (e.owner !== pid) continue;
        let r;
        if (e.kind === 'unit') r = UNITS[e.type].sight + FORMS[e.form].stage;
        else r = BUILDINGS[e.type].sight;
        const cx = Math.floor(e.x / TILE), cy = Math.floor(e.y / TILE);
        for (const [ox, oy] of circle(r)) {
          const x = cx + ox, y = cy + oy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          vis[y * w + x] = 1;
          exp[y * w + x] = 1;
        }
      }
    });
  }

  checkWin(force) {
    this.players.forEach((p, pid) => {
      if (!p.alive) return;
      if (!this.buildingsOf(pid).length) p.alive = false;
    });
    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1 && this.winner < 0 && (force || alive.length < this.players.length)) {
      this.winner = alive.length ? alive[0].id : 0;
    }
  }

  // ------------------------------------------------------------------ networking
  snapshot() {
    const e = [];
    const r1 = (v) => Math.round(v * 10) / 10;
    for (const x of this.ents.values()) {
      if (x.kind === 'unit') {
        const flags = (x.moving ? 1 : 0) | (x.anim > 0 ? 2 : 0) | (x.carry.kind === 'berry' && x.carry.amt ? 4 : 0) |
          (x.carry.kind === 'crystal' && x.carry.amt ? 8 : 0) | (x.order.type === 'idle' ? 16 : 0) |
          (x.order.type === 'gather' ? 32 : 0) | (x.order.type === 'build' ? 64 : 0) | (x.order.type === 'attack' ? 128 : 0) |
          (x.sleep > 0 ? 256 : 0) | (x.evoReady ? 512 : 0) | (x.order.type === 'cast' ? 1024 : 0);
        e.push([0, x.id, UNIT_KEYS.indexOf(x.type), x.owner, r1(x.x), r1(x.y), Math.ceil(x.hp), x.maxHp,
          FORM_KEYS.indexOf(x.form), Math.floor(x.xp), flags, x.face, x.acd > 0 ? r1(x.acd) : 0]);
      } else if (x.kind === 'building') {
        e.push([1, x.id, BUILDING_KEYS.indexOf(x.type), x.owner, x.tx, x.ty, Math.ceil(x.hp), x.maxHp,
          x.built ? 1 : Math.round(x.progress * 1000) / 1000,
          x.queue.map((q) => (q.u ? [0, q.u, r1(q.t)] : [1, q.r, r1(q.t), q.lvl])), x.rally ? [x.rally.x | 0, x.rally.y | 0] : 0]);
      } else {
        e.push([2, x.id, RES_KEYS.indexOf(x.type), x.tx, x.ty, x.amount]);
      }
    }
    return {
      tick: this.tick, time: r1(this.time), winner: this.winner,
      p: this.players.map((p) => [Math.floor(p.b), Math.floor(p.c), p.pop, p.cap, p.research,
        p.alive ? 1 : 0, p.stats.trained, p.stats.killed, p.stats.lost, p.stats.gathered]),
      e,
    };
  }

  applySnapshot(s, viewPid) {
    this.tick = s.tick; this.time = s.time; this.winner = s.winner;
    s.p.forEach((a, i) => {
      const p = this.players[i];
      [p.b, p.c, p.pop, p.cap, p.research] = a;
      p.alive = !!a[5];
      p.stats = { trained: a[6], killed: a[7], lost: a[8], gathered: a[9] };
    });
    const seen = new Set();
    let structural = false;
    for (const a of s.e) {
      const id = a[1];
      seen.add(id);
      let x = this.ents.get(id);
      if (a[0] === 0) {
        const type = UNIT_KEYS[a[2]];
        if (!x) x = this.addUnit(type, a[3], a[4], a[5], id);
        x.px = x.x; x.py = x.y;
        x.x = a[4]; x.y = a[5]; x.hp = a[6]; x.maxHp = a[7];
        const form = FORM_KEYS[a[8]];
        if (x.form !== form) { x.form = form; x.radius = UNITS[type].radius + FORMS[form].stage * 1.5; }
        x.xp = a[9];
        const f = a[10];
        x.moving = !!(f & 1); x.anim = f & 2 ? 0.2 : 0;
        x.carry = { kind: f & 4 ? 'berry' : f & 8 ? 'crystal' : null, amt: f & 12 ? 1 : 0 };
        x.order = { type: f & 16 ? 'idle' : f & 32 ? 'gather' : f & 64 ? 'build' : f & 128 ? 'attack' : f & 1024 ? 'cast' : 'move' };
        x.sleep = f & 256 ? 1 : 0;
        x.evoReady = !!(f & 512);
        x.face = a[11];
        x.acd = a[12];
      } else if (a[0] === 1) {
        if (!x) { x = this.addBuilding(BUILDING_KEYS[a[2]], a[3], a[4], a[5], a[8] === 1, id); structural = true; }
        x.hp = a[6]; x.maxHp = a[7];
        x.built = a[8] === 1; x.progress = a[8];
        x.queue = a[9].map((q) => (q[0] === 0 ? { u: q[1], t: q[2] } : { r: q[1], t: q[2], lvl: q[3] }));
        x.rally = a[10] ? { x: a[10][0], y: a[10][1] } : null;
      } else {
        if (!x) { x = this.addResource(RES_KEYS[a[2]], a[3], a[4], id, a[5]); structural = true; }
        x.amount = a[5];
      }
    }
    for (const e of [...this.ents.values()]) if (!seen.has(e.id)) { this.remove(e); structural = true; }
    if (structural) this.version++;
    this.updateFog(viewPid);
  }
}
