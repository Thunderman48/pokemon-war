// Skill engine: passive modifiers, status effects, active skills and auto-casting.
// Functions take the World as their first argument so world.js stays readable.
import { SKILLS, FORMS, UNITS, TILE, ASCENT, ITEMS, effectiveness, skillResearch } from './config.js';

const MULT = ['dmg', 'hp', 'cd', 'speed', 'armor', 'rangedArmor', 'solid', 'regen', 'siege', 'gather', 'carry', 'build', 'pinch', 'eviolite', 'expert', 'firedmg'];
const ADD = ['range', 'sight', 'dodge', 'cregen', 'pickup', 'thorns', 'lifesteal', 'chain'];

// Combine several mod objects into one.
export function mergeMods(list) {
  const out = {};
  for (const m of list) {
    if (!m) continue;
    for (const k of MULT) if (m[k] !== undefined) out[k] = (out[k] ?? 1) * m[k];
    for (const k of ADD) if (m[k] !== undefined) out[k] = (out[k] || 0) + m[k];
    if (m.resist) {
      out.resist = { ...(out.resist || {}) };
      for (const [t, v] of Object.entries(m.resist)) out.resist[t] = (out.resist[t] ?? 1) * v;
    }
    for (const k of ['contact', 'onhit', 'aura']) if (m[k]) (out[k] = out[k] || []).push(m[k]);
    if (m.immune) out.immune = 1;
    for (const k of ['noguard', 'repair', 'magicguard', 'stalwart']) if (m[k]) out[k] = 1;
    if (m.stamina) out.stamina = Math.max(out.stamina || 0, m.stamina);
    if (m.sturdy) out.sturdy = Math.min(out.sturdy || Infinity, m.sturdy);
  }
  return out;
}

// Passive mods a player has for one Pokémon line (deck loadout + finished research + held item).
export function lineMods(W, pid, line) {
  const p = W.players[pid];
  if (!p) return {};
  const key = researchKey(p);
  if (p._modsKey !== key) { p._modsKey = key; p._mods = {}; }
  if (!p._mods[line]) {
    const list = W.loadout(pid, line).filter((k) => SKILLS[k].kind === 'p' && p.research[skillResearch(k)]).map((k) => SKILLS[k].mods);
    const slot = p.deck.slots.find((s) => s.line === line);
    if (slot && slot.item && ITEMS[slot.item] && ITEMS[slot.item].mods) list.push(ITEMS[slot.item].mods);
    p._mods[line] = mergeMods(list);
  }
  return p._mods[line];
}
function researchKey(p) {
  let s = p.deckKey || '';
  for (const k in p.research) s += k + p.research[k];
  return s;
}

// All mods acting on a unit right now: its line's passives plus temporary buffs.
export function unitMods(W, u) {
  if (u.kind !== 'unit') return {};
  const base = lineMods(W, u.owner, FORMS[u.form].line);
  const fm = FORMS[u.form].mods; // e.g. Mega Pidgeot's No Guard
  if ((!u.buffs || !u.buffs.length) && !fm) return base;
  return mergeMods([base, fm, ...(u.buffs || []).map((b) => b.mods)]);
}

// ------------------------------------------------------------------ status effects
export function applyStatus(W, t, st, src, owner, power = 1) {
  if (!t || t.kind !== 'unit' || !W.ents.has(t.id) || (t.mega && t.mega.phase === 'transform')) return;
  const m = unitMods(W, t);
  if (m.immune) return;
  const legend = UNITS[t.type].limit ? 0.5 : 1; // legendaries shrug off control effects faster
  if (st.burn && !m.magicguard) t.burn = { t: st.burn.t, dps: st.burn.dps * power, src, owner };
  if (st.poison && !m.magicguard) t.poison = { t: st.poison.t, dps: st.poison.dps * power, src, owner };
  if (st.stun) { t.stun = Math.max(t.stun || 0, st.stun * legend); t.path = null; t.pathKey = null; }
  if (st.sleep) { t.sleep = Math.max(t.sleep || 0, st.sleep * legend); t.path = null; t.pathKey = null; }
  if (st.slow) t.slow = { t: st.slow.t * legend, m: st.slow.m };
}

// Ticks statuses on a unit. Returns true if the unit can't act this tick.
export function updateStatus(W, u, dt) {
  if (u.slow && (u.slow.t -= dt) <= 0) u.slow = null;
  if (u.buffs && u.buffs.length) {
    for (let i = u.buffs.length - 1; i >= 0; i--) {
      const b = u.buffs[i];
      if ((b.t -= dt) > 0) continue;
      u.buffs.splice(i, 1);
      if (b.after) applyStatus(W, u, b.after, u.id, u.owner);
    }
  }
  for (const k of ['burn', 'poison']) {
    const d = u[k];
    if (!d) continue;
    d.t -= dt;
    d.acc = (d.acc || 0) + d.dps * dt;
    if (d.acc >= 2 || d.t <= 0) {
      const amt = d.acc;
      d.acc = 0;
      if (d.t <= 0) u[k] = null;
      W.damage(u, amt, d.src, d.owner, { dot: true });
      if (!W.ents.has(u.id)) return true;
    }
  }
  if (u.stun > 0) { u.stun -= dt; u.moving = false; return true; }
  return false;
}

// ------------------------------------------------------------------ casting
export function skillPower(W, u) {
  return (1 + 0.35 * FORMS[u.form].stage) * (1 + 0.15 * W.rlevel(u.owner, 'attack'));
}

// The unit(s) that perform a skill: every nearby able member for `each` skills, else the leader.
function casters(W, sq, lead, each) {
  if (!each || !sq) return [lead];
  return W.squadUnits(sq).filter((m) => m === lead || (Math.hypot(m.x - lead.x, m.y - lead.y) < 5 * TILE && !(m.sleep > 0) && !(m.stun > 0) && !m.ascend && !m.dash));
}

// Fire a skill from `lead` (its squad shares the cooldown) at (x, y).
export function performSkill(W, lead, key, x, y) {
  const S = SKILLS[key], e = S.eff;
  const sq = W.squadOf(lead);
  const pid = lead.owner;
  const power = skillPower(W, lead);
  const r = (e.radius || 0) * TILE;
  W.fx.push({ k: 'cast', x: lead.x | 0, y: lead.y | 0, s: key });
  selfAfter(W, lead, sq, e, key);
  switch (e.k) {
    case 'area':
      W.effects.push({ k: 'skill', key, x, y, r, t: e.delay || 0, owner: pid, src: lead.id, power });
      W.fx.push({ k: 'sk_mark', x: x | 0, y: y | 0, r: r | 0, d: e.delay || 0.01, s: key });
      break;
    case 'zone':
      W.zones.push({ key, x, y, r, t: e.t, tick: 0, owner: pid, src: lead.id, sq: sq && sq.id, power });
      W.fx.push({ k: 'zone', x: x | 0, y: y | 0, r: r | 0, d: e.t, s: key });
      break;
    case 'line':
      for (const c of casters(W, sq, lead, e.each)) {
        if (e.charge) {
          c.charge = { t: e.charge, key, x, y, power };
          c.path = null; c.pathKey = null;
          W.fx.push({ k: 'charge', id: c.id, x: c.x | 0, y: c.y | 0, d: e.charge, s: key });
        } else {
          fireLine(W, c, key, x, y, power);
          if (e.selfbuff) addBuff(c, key, e.selfbuff.t, e.selfbuff.mods);
        }
      }
      break;
    case 'cone': fireCone(W, lead, key, x, y, power); break;
    case 'heal': {
      const amt = e.amount * (1 + 0.3 * FORMS[lead.form].stage);
      W.nearUnits(x, y, r + 8, (a) => {
        if (a.owner !== pid || Math.hypot(a.x - x, a.y - y) > r + a.radius) return;
        a.hp = Math.min(a.maxHp, a.hp + amt);
      });
      W.fx.push({ k: 'healp', x: x | 0, y: y | 0, r: r | 0 });
      break;
    }
    case 'buff': {
      const who = e.who === 'squad' ? (sq ? W.squadUnits(sq) : [lead]) : [];
      if (e.who === 'allies') W.nearUnits(lead.x, lead.y, r + 8, (a) => { if (a.owner === pid && !UNITS[a.type].worker && Math.hypot(a.x - lead.x, a.y - lead.y) <= r) who.push(a); });
      for (const a of who) addBuff(a, key, e.t, e.mods, e.after);
      W.fx.push({ k: 'buff', x: lead.x | 0, y: lead.y | 0, r: (r || 2 * TILE) | 0, s: key, ids: who.map((a) => a.id) });
      break;
    }
    case 'dash':
      for (const c of casters(W, sq, lead, e.each)) {
        const ox = c === lead ? 0 : (c.x - lead.x) * 0.5, oy = c === lead ? 0 : (c.y - lead.y) * 0.5;
        startDash(W, c, key, x + ox, y + oy, power);
      }
      break;
    case 'explode': {
      // the member closest to the target rolls in and blows up
      const ms = sq ? W.squadUnits(sq) : [lead];
      ms.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      startDash(W, ms[0], key, x, y, power, true);
      break;
    }
    case 'roost': {
      for (const a of sq ? W.squadUnits(sq) : [lead]) {
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * e.amount);
        W.fx.push({ k: 'heal', x: a.x | 0, y: a.y | 0 });
      }
      W.fx.push({ k: 'buff', x: lead.x | 0, y: lead.y | 0, r: 2 * TILE, s: key, ids: [] });
      break;
    }
    case 'rest':
      for (const a of sq ? W.squadUnits(sq) : [lead]) {
        a.hp = a.maxHp;
        a.sleep = e.t;
        a.burn = a.poison = null; a.stun = 0; a.slow = null;
        a.path = null; a.pathKey = null;
        W.fx.push({ k: 'sleep', x: a.x | 0, y: a.y | 0, r: 10 });
      }
      break;
    case 'teleport': {
      // the whole squad blinks to the target, keeping its formation
      const ms = sq ? W.squadUnits(sq) : [lead];
      const slots = W.formation(ms, x, y);
      ms.forEach((m, i) => {
        let tx = slots[i].x, ty = slots[i].y;
        if (W.blockedFor(m, tx, ty)) {
          const f = W.nearestFree(Math.floor(tx / TILE), Math.floor(ty / TILE), 4);
          if (!f) return;
          tx = f.x * TILE + TILE / 2; ty = f.y * TILE + TILE / 2;
        }
        W.fx.push({ k: 'teleport', x: m.x | 0, y: m.y | 0, x2: tx | 0, y2: ty | 0 });
        m.x = m.px = tx; m.y = m.py = ty;
        m.path = null; m.pathKey = null;
        m.order = { type: 'idle' };
      });
      break;
    }
    case 'ascent': {
      const dmg = e.dmg * power;
      lead.ascend = { t: 0, x, y, phase: 'up', dmg, r, drain: e.drain, m: FORMS[lead.form].stage ? 1 : 0 };
      lead.face = x >= lead.x ? 1 : -1;
      lead.path = null; lead.pathKey = null;
      W.fx.push({ k: 'ascent', x: lead.x | 0, y: lead.y | 0, m: lead.ascend.m });
      W.fx.push({ k: 'mark', x: x | 0, y: y | 0, r: r | 0, d: ASCENT.rise + ASCENT.dive, m: lead.ascend.m });
      break;
    }
  }
}

// Self-inflicted after-effects (Draco Meteor lowers its own damage)
function selfAfter(W, lead, sq, e, key) {
  if (!e.selfdebuff) return;
  for (const m of sq ? W.squadUnits(sq) : [lead]) addBuff(m, key + '_after', e.selfdebuff.t, e.selfdebuff.mods);
}

export function addBuff(u, key, t, mods, after) {
  u.buffs = (u.buffs || []).filter((b) => b.key !== key);
  u.buffs.push({ key, t, mods, after });
}

// hit everything enemy within `r` of (x, y) with skill `key`
function hitArea(W, key, x, y, r, owner, src, power, opts = {}) {
  const S = SKILLS[key], e = S.eff;
  let total = 0;
  W.nearUnits(x, y, r + 16, (t) => {
    if (t.owner === owner || !W.ents.has(t.id) || t.ascend) return;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d > r + t.radius) return;
    total += hitUnit(W, t, key, src, owner, power, opts.mult || 1);
    if (e.knock) knock(W, t, x, y, e.knock);
  });
  if (e.bld) {
    for (const b of [...W.ents.values()]) {
      if (b.kind !== 'building' || b.owner === owner || b.owner < 0) continue;
      if (W.edgeDist({ x, y, radius: 0 }, b) <= r) total += W.damage(b, (e.dmg || 0) * power * e.bld, src, owner, { skill: true });
    }
  }
  return total;
}

function hitUnit(W, t, key, src, owner, power, mult = 1) {
  const S = SKILLS[key], e = S.eff;
  let dealt = 0;
  const caster = W.ents.get(src);
  const boost = caster && caster.kind === 'unit' && S.type === 'fire' ? unitMods(W, caster).firedmg || 1 : 1;
  const eff = e.fixed ? 1 : effectiveness(S.type, FORMS[t.form].type);
  if (e.dmg) dealt = W.damage(t, e.dmg * power * mult * boost * eff, src, owner, { skill: true, type: e.fixed ? null : S.type });
  if (!W.ents.has(t.id)) return dealt;
  if (e.debuff && !(t.mega && t.mega.phase === 'transform')) addBuff(t, key, e.debuff.t, e.debuff.mods);
  const st = {};
  if (e.burn) st.burn = e.burn;
  if (e.poison) st.poison = e.poison;
  if (e.sleep) st.sleep = e.sleep;
  if (e.slow) st.slow = e.slow;
  if (e.stun && (!e.stunChance || Math.random() < e.stunChance)) st.stun = e.stun;
  if (Object.keys(st).length) applyStatus(W, t, st, src, owner);
  return dealt;
}

function knock(W, t, x, y, amt) {
  if ((t.mega && t.mega.phase === 'transform') || unitMods(W, t).stalwart) return;
  const d = Math.hypot(t.x - x, t.y - y) || 1;
  const ux = (t.x - x) / d, uy = (t.y - y) / d;
  const legend = UNITS[t.type].limit ? 0.3 : 1;
  for (let s = 0; s < 4; s++) {
    const nx = t.x + ux * amt * legend / 4, ny = t.y + uy * amt * legend / 4;
    if (W.blockedFor(t, nx, ny)) break;
    t.x = nx; t.y = ny;
  }
  t.path = null; t.pathKey = null;
}

function fireLine(W, c, key, x, y, power) {
  const S = SKILLS[key], e = S.eff;
  const reach = (S.range + 1) * TILE;
  const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const x2 = c.x + ux * reach, y2 = c.y + uy * reach;
  c.face = ux >= 0 ? 1 : -1;
  c.anim = 0.5;
  const w = e.width || 10;
  W.nearUnits((c.x + x2) / 2, (c.y + y2) / 2, reach / 2 + w + 12, (t) => {
    if (t.owner === c.owner || !W.ents.has(t.id) || t.ascend) return;
    const px = t.x - c.x, py = t.y - c.y;
    const along = px * ux + py * uy;
    if (along < 0 || along > reach) return;
    if (Math.abs(px * uy - py * ux) > w / 2 + t.radius) return;
    hitUnit(W, t, key, c.id, c.owner, power);
    if (e.knock) knock(W, t, t.x - ux, t.y - uy, e.knock);
  });
  const lift = c.lift || 0;
  W.fx.push({ k: 'beam', x1: c.x | 0, y1: (c.y - 6 - lift) | 0, x2: x2 | 0, y2: (y2 - 4) | 0, w, s: key, d: 0.5 });
}

function fireCone(W, c, key, x, y, power) {
  const S = SKILLS[key], e = S.eff;
  const len = e.len * TILE;
  const mouth = FORMS[c.form].mouth;
  c.face = x >= c.x ? 1 : -1;
  const ox = mouth ? c.x + mouth[0] * c.face : c.x, oy = mouth ? c.y + mouth[1] : c.y - 6;
  const ang = Math.atan2(y - oy, x - ox);
  c.anim = 0.8;
  W.nearUnits(ox, oy, len + 16, (t) => {
    if (t.owner === c.owner || !W.ents.has(t.id) || t.ascend) return;
    const d = Math.hypot(t.x - ox, t.y - oy);
    if (d > len + t.radius) return;
    let da = Math.atan2(t.y - oy, t.x - ox) - ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > e.ang / 2 + (d ? t.radius / d : 0)) return;
    hitUnit(W, t, key, c.id, c.owner, power);
  });
  W.fx.push({ k: 'cone', x: ox | 0, y: oy | 0, a: Math.round(ang * 100) / 100, len: len | 0, ang: e.ang, s: key, d: 0.7 });
}

function startDash(W, u, key, x, y, power, explode) {
  const S = SKILLS[key];
  const max = (S.range + 1) * TILE;
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, max / d);
  u.dash = { key, x: u.x + dx * k, y: u.y + dy * k, power, hit: [], explode: !!explode };
  u.face = dx >= 0 ? 1 : -1;
  u.path = null; u.pathKey = null;
}

// Move a dashing unit; hits what it passes and what it lands on. Returns true while dashing.
export function updateDash(W, u, dt) {
  const D = u.dash, S = SKILLS[D.key], e = S.eff;
  const speed = (e.speed || 10) * TILE;
  const dx = D.x - u.x, dy = D.y - u.y, d = Math.hypot(dx, dy);
  const step = speed * dt;
  u.moving = true;
  u.anim = 0.2;
  const arrive = d <= step;
  const nx = arrive ? D.x : u.x + (dx / d) * step, ny = arrive ? D.y : u.y + (dy / d) * step;
  // slide along obstacles; only a dead end stops the dash early
  let blocked = false;
  if (!W.blockedFor(u, nx, ny)) { u.x = nx; u.y = ny; }
  else if (!W.blockedFor(u, nx, u.y)) u.x = nx;
  else if (!W.blockedFor(u, u.x, ny)) u.y = ny;
  else blocked = true;
  if ((W.tick + u.id) % 2 === 0) W.fx.push({ k: 'trail', x: u.x | 0, y: (u.y - 4 - (u.lift || 0)) | 0, s: D.key });
  // hit enemies along the way
  if (!D.explode) {
    const w = (e.width || 10) / 2;
    W.nearUnits(u.x, u.y, w + 16, (t) => {
      if (t.owner === u.owner || !W.ents.has(t.id) || t.ascend || D.hit.includes(t.id)) return;
      if (Math.hypot(t.x - u.x, t.y - u.y) > w + t.radius + u.radius) return;
      D.hit.push(t.id);
      const got = hitUnit(W, t, D.key, u.id, u.owner, D.power);
      if (e.recoil && got > 0) W.damage(u, got * e.recoil, t.id, t.owner, { recoil: true });
    });
  }
  if (!W.ents.has(u.id)) return false;
  if (arrive || blocked) {
    u.dash = null;
    u.path = null; u.pathKey = null;
    if (D.explode) {
      const r = e.radius * TILE;
      W.fx.push({ k: 'boom', x: u.x | 0, y: u.y | 0, r: r | 0, m: 0, s: D.key });
      hitArea(W, D.key, u.x, u.y, r, u.owner, u.id, D.power);
      W.damage(u, u.hp + 9999, u.id, -1, { self: true });
    } else if (e.radius) {
      W.fx.push({ k: 'boom', x: u.x | 0, y: u.y | 0, r: (e.radius * TILE) | 0, m: 0, s: D.key });
      hitArea(W, D.key, u.x, u.y, e.radius * TILE, u.owner, u.id, D.power, { mult: 0.6 });
    }
    // keep fighting whatever is nearest
    const t = W.findEnemy(u, W.stats(u).sight * TILE);
    u.order = t ? { type: 'attack', target: t.id, auto: true } : { type: 'idle' };
    return false;
  }
  return true;
}

// Charging (Solar Beam): stand still, then fire.
export function updateCharge(W, u, dt) {
  const c = u.charge;
  c.t -= dt;
  u.moving = false;
  u.anim = 0.2;
  if (c.t > 0) return true;
  u.charge = null;
  fireLine(W, u, c.key, c.x, c.y, c.power);
  const e = SKILLS[c.key].eff;
  if (e.selfbuff) addBuff(u, c.key, e.selfbuff.t, e.selfbuff.mods);
  return false;
}

// Area skills that land after a delay (Thunder, Rock Slide, Yawn...).
export function resolveArea(W, fx) {
  W.fx.push({ k: 'sk_hit', x: fx.x | 0, y: fx.y | 0, r: fx.r | 0, s: fx.key });
  hitArea(W, fx.key, fx.x, fx.y, fx.r, fx.owner, fx.src, fx.power);
}

// Lingering zones (Fire Spin, Leech Seed).
export function updateZones(W, dt) {
  for (let i = W.zones.length - 1; i >= 0; i--) {
    const z = W.zones[i];
    z.t -= dt;
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = 0.5;
      const e = SKILLS[z.key].eff;
      let drained = 0;
      W.nearUnits(z.x, z.y, z.r + 16, (t) => {
        if (t.owner === z.owner || !W.ents.has(t.id) || t.ascend) return;
        if (Math.hypot(t.x - z.x, t.y - z.y) > z.r + t.radius) return;
        drained += W.damage(t, e.dps * 0.5 * z.power * effectiveness(SKILLS[z.key].type, FORMS[t.form].type), z.src, z.owner, { skill: true, type: SKILLS[z.key].type });
        if (W.ents.has(t.id) && (e.burn || e.poison)) applyStatus(W, t, { burn: e.burn, poison: e.poison }, z.src, z.owner);
        if (e.drain) W.fx.push({ k: 'drain', x1: t.x | 0, y1: (t.y - 4) | 0, id: z.src, d: 0.6, m: 2 });
      });
      if (e.drain && drained > 0) {
        const sq = z.sq && W.squads.get(z.sq);
        const ms = sq ? W.squadUnits(sq) : [W.ents.get(z.src)].filter(Boolean);
        for (const m of ms) m.hp = Math.min(m.maxHp, m.hp + (drained * e.drain) / ms.length);
      }
    }
    if (z.t <= 0) W.zones.splice(i, 1);
  }
}

// ------------------------------------------------------------------ auto-cast
// Picks a target for an active skill, or null if it isn't worth using right now.
export function autoTarget(W, sq, lead, key) {
  const S = SKILLS[key], e = S.eff, pid = lead.owner;
  const ms = W.squadUnits(sq);
  const fighting = ms.some((m) => m.order.type === 'attack' || W.time - (m.lastCombat ?? -99) < 3);
  const hpFrac = ms.reduce((s, m) => s + m.hp, 0) / (ms.length * lead.maxHp);
  const reach = (S.range + 1) * TILE;
  if (e.k === 'teleport') return null; // only when the player (or the AI) decides to
  if (S.target === 'self') {
    if (e.k === 'rest') return hpFrac < 0.35 ? lead : null;
    if (e.k === 'roost') return hpFrac < 0.5 && !ms.some((m) => m.order.type === 'attack' && m.hp < m.maxHp * 0.2) ? lead : null;
    if (!fighting) return null;
    if (key === 'protect') return hpFrac < 0.75 && enemiesNear(W, lead, 4 * TILE) >= 2 ? lead : null;
    if (e.who === 'allies') { let n = 0; W.nearUnits(lead.x, lead.y, (e.radius || 4) * TILE, (a) => { if (a.owner === pid && !UNITS[a.type].worker) n++; }); return n >= 5 ? lead : null; }
    return enemiesNear(W, lead, 6 * TILE) >= 2 ? lead : null;
  }
  if (S.target === 'ally') {
    let hurt = 0, sx = 0, sy = 0;
    W.nearUnits(lead.x, lead.y, reach, (a) => { if (a.owner === pid && a.hp < a.maxHp * 0.65) { hurt++; sx += a.x; sy += a.y; } });
    return hurt >= 2 ? { x: sx / hurt, y: sy / hurt } : null;
  }
  // offensive: densest group of visible enemies in reach
  const r = Math.max(1.5, e.radius || 1.5) * TILE;
  let best = null, bn = 0;
  W.nearUnits(lead.x, lead.y, reach, (t) => {
    if (t.owner === pid || t.owner < 0 || t.ascend || !W.isVisible(pid, t) || Math.hypot(t.x - lead.x, t.y - lead.y) > reach) return;
    if ((e.sleep || e.stun) && !e.dmg && (t.sleep > 0 || t.stun > 0)) return;
    let n = 0;
    W.nearUnits(t.x, t.y, r, (f) => { if (f.owner === t.owner && Math.hypot(f.x - t.x, f.y - t.y) <= r) n += UNITS[f.type].worker ? 0.3 : 1; });
    if (n > bn) { bn = n; best = t; }
  });
  const need = e.k === 'explode' ? 3 : e.k === 'zone' || e.sleep || e.k === 'area' && !e.dmg ? 2 : fighting ? 1 : 2;
  if (key === 'ascent') {
    // dive at buildings too, and take smaller targets when hurt (life steal)
    let bv = bn;
    let pt = best && { x: best.x, y: best.y };
    for (const b of W.buildingsOf(1 - pid)) {
      if (Math.hypot(b.x - lead.x, b.y - lead.y) > reach) continue;
      const v = (b.type === 'center' ? 1.5 : 0.8) + countAt(W, pid, b.x, b.y, r);
      if (v > bv) { bv = v; pt = { x: b.x, y: b.y }; }
    }
    return bv >= (hpFrac < 0.5 ? 1 : 2) ? pt : null;
  }
  return best && bn >= need ? { x: best.x, y: best.y } : null;
}

function enemiesNear(W, u, r) {
  let n = 0;
  W.nearUnits(u.x, u.y, r, (t) => { if (t.owner !== u.owner && t.owner >= 0 && !UNITS[t.type].worker) n++; });
  return n;
}
function countAt(W, pid, x, y, r) {
  let n = 0;
  W.nearUnits(x, y, r, (t) => { if (t.owner !== pid && Math.hypot(t.x - x, t.y - y) <= r) n++; });
  return n;
}
