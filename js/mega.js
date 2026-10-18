// Mega Evolution: a squad leader transforms (invincible), then stays Mega for a while with a special effect.
import { FORMS, UNITS, TILE, MEGA, ITEMS, effectiveness } from './config.js';
import { applyStatus, addBuff, unitMods } from './skills.js';

// Special effect of each Mega: an entrance `burst`, then an ongoing effect while Mega.
export const MEGA_FX = {
  megarayquaza: {
    burst: { radius: 4.5, dmg: 30, knock: 30 },
    // Delta Stream: a storm around Rayquaza strikes random enemies with lightning, and the sky goes dark
    storm: { radius: 7, every: 1.4, dmg: 55 }, sky: true,
  },
  megacharizard: {
    burst: { radius: 3.5, dmg: 40, knock: 22, burn: { t: 3, dps: 5 } },
    // Drought: harsh sunlight scorches enemies nearby and powers up allied Fire attacks
    sun: { radius: 5, every: 2, burn: { t: 2.5, dps: 6 }, ally: { firedmg: 1.3 } },
  },
  megablastoise: {
    burst: { radius: 3.5, dmg: 30, knock: 26 },
    // Mega Launcher: cannon shots at random enemies; the splash heals allies
    cannon: { radius: 7, every: 1.8, dmg: 50, splash: 1.6, heal: 20 },
  },
  megavenusaur: {
    burst: { radius: 4, dmg: 25, stun: 1.6 },
    // pollen field: drains nearby enemies and heals allies
    pollen: { radius: 4.5, dps: 7, heal: 0.02 },
  },
  megagengar: {
    burst: { radius: 4, dmg: 40, slow: { t: 3, m: 0.5 } },
    // Shadow Tag: darkness around Mega Gengar slows every enemy nearby so they can't get away
    shade: { radius: 5, slow: 0.55, dps: 4 },
  },
  megaalakazam: {
    burst: { radius: 4, dmg: 30, knock: 26 },
    // confusion: random enemies nearby freeze up; its attacks chain to more targets (form mods)
    confuse: { radius: 6, every: 1.2, count: 2, stun: 0.7 },
  },
  megamewtwox: {
    burst: { radius: 4, dmg: 55, knock: 18, stun: 0.8 },
  },
  megamewtwoy: {
    burst: { radius: 4, dmg: 30, stun: 1.5 },
    // Psystrike orbs fly at random enemies
    orbs: { radius: 7, every: 1.1, dmg: 55 },
  },
  megapidgeot: {
    burst: { radius: 4, dmg: 25, knock: 32 },
    // a tornado pulls enemies in and grinds them; No Guard: its attacks never miss
    tornado: { radius: 5, pull: 14, dps: 5 }, noguard: true,
  },
};

// Why this squad can't Mega Evolve right now (null if it can).
export function megaBlock(W, sq) {
  const lead = W.leaderOf(sq);
  if (!lead) return 'No Pokémon';
  const f = FORMS[lead.form];
  if (lead.mega) return 'Already Mega Evolved';
  if (!f.mega) {
    const line = f.line;
    const can = Object.values(FORMS).some((x) => x.line === line && x.mega);
    return can ? 'Evolve it fully first' : `${f.name} can't Mega Evolve`;
  }
  if (!W.rlevel(sq.owner, 'keystone')) return 'Research the Key Stone at the Lab';
  if (!megaTarget(W, lead)) return `Needs its Mega Stone as the held item`;
  if (sq.megaCd > 0) return `Mega Evolution recharging (${Math.ceil(sq.megaCd)}s)`;
  if (lead.sleep > 0 || lead.stun > 0 || lead.ascend || lead.dash) return 'Busy';
  return null;
}

// The Mega form this Pokémon would become with its held item (Rayquaza needs no stone; Mewtwo's stone picks X or Y).
export function megaTarget(W, u) {
  const f = FORMS[u.form];
  if (!f.mega) return null;
  if (f.line === 'rayquaza') return f.mega;
  const slot = W.players[u.owner].deck.slots.find((s) => s.line === f.line);
  const item = slot && slot.item;
  if (!item || !ITEMS[item] || ITEMS[item].mega !== f.line) return null;
  return typeof f.mega === 'string' ? f.mega : f.mega[item] || null;
}

export function startMega(W, sq) {
  const lead = W.leaderOf(sq);
  lead.mega = { phase: 'transform', t: MEGA.transform, prev: lead.form, to: megaTarget(W, lead), tick: 0 };
  sq.megaId = lead.id;
  sq.megaCd = MEGA.transform + MEGA.time + MEGA.cd;
  lead.path = null; lead.pathKey = null;
  lead.burn = lead.poison = null; lead.stun = 0; lead.slow = null;
  W.fx.push({ k: 'megaevo', id: lead.id, x: lead.x | 0, y: lead.y | 0, d: MEGA.transform, s: lead.mega.to });
  W.notify(sq.owner, `${FORMS[lead.form].name} is Mega Evolving!`, 'evo', lead.x, lead.y);
}

// Per tick for a Mega (or transforming) unit. Returns true if it can't act this tick.
export function updateMega(W, u, dt) {
  const m = u.mega;
  m.t -= dt;
  if (m.phase === 'transform') {
    u.moving = false;
    u.anim = 0.2;
    if (m.t > 0) return true;
    // transformation complete
    const ratio = u.hp / u.maxHp;
    u.form = m.to;
    u.maxHp = W.stats(u).maxHp;
    u.hp = Math.min(u.maxHp, u.maxHp * ratio + u.maxHp * 0.15);
    u.radius = UNITS[u.type].radius + FORMS[u.form].stage * 1.5;
    m.phase = 'on';
    m.t = MEGA.time;
    W.fx.push({ k: 'megaburst', x: u.x | 0, y: u.y | 0, r: ((MEGA_FX[u.form] || {}).burst || { radius: 3 }).radius * TILE | 0, s: u.form });
    W.notify(u.owner, `${FORMS[m.prev].name} Mega Evolved into ${FORMS[u.form].name}!`, 'evo', u.x, u.y);
    burst(W, u);
    return false;
  }
  if (m.t <= 0) { endMega(W, u); return false; }
  ongoing(W, u, dt);
  return false;
}

export function endMega(W, u) {
  const m = u.mega;
  if (!m) return;
  if (m.phase === 'on') {
    const ratio = u.hp / u.maxHp;
    u.form = m.prev;
    u.maxHp = W.stats(u).maxHp;
    u.hp = Math.max(1, u.maxHp * ratio);
    u.radius = UNITS[u.type].radius + FORMS[u.form].stage * 1.5;
    W.fx.push({ k: 'evo', x: u.x | 0, y: u.y | 0, id: u.id });
  }
  u.mega = null;
}

function power(W, u) { return 1 + 0.15 * W.rlevel(u.owner, 'attack'); }

function enemiesIn(W, u, r, fn) {
  W.nearUnits(u.x, u.y, r + 16, (t) => {
    if (t.owner === u.owner || t.owner < 0 || !W.ents.has(t.id) || t.ascend) return;
    if (Math.hypot(t.x - u.x, t.y - u.y) > r + t.radius) return;
    fn(t);
  });
}

function burst(W, u) {
  const F = MEGA_FX[u.form];
  if (!F) return;
  const b = F.burst, r = b.radius * TILE, type = FORMS[u.form].type;
  enemiesIn(W, u, r, (t) => {
    if (b.dmg) W.damage(t, b.dmg * power(W, u) * effectiveness(type, FORMS[t.form].type), u.id, u.owner, { skill: true, type });
    if (!W.ents.has(t.id)) return;
    if (b.knock) knockFrom(W, t, u.x, u.y, b.knock);
    const st = {};
    if (b.burn) st.burn = b.burn;
    if (b.stun) st.stun = b.stun;
    if (b.slow) st.slow = b.slow;
    if (b.burn || b.stun || b.slow) applyStatus(W, t, st, u.id, u.owner);
  });
}

function ongoing(W, u, dt) {
  const F = MEGA_FX[u.form];
  if (!F) return;
  const m = u.mega, type = FORMS[u.form].type;
  m.tick -= dt;
  if (F.sky) W.sky = Math.max(W.sky, m.t);
  const pick = (r) => {
    const list = [];
    enemiesIn(W, u, r, (t) => { if (W.isVisible(u.owner, t)) list.push(t); });
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  };
  if (F.storm && m.tick <= 0) {
    m.tick = F.storm.every;
    const t = pick(F.storm.radius * TILE);
    if (t) {
      W.fx.push({ k: 'stormbolt', x: t.x | 0, y: t.y | 0 });
      W.damage(t, F.storm.dmg * power(W, u) * effectiveness('electric', FORMS[t.form].type), u.id, u.owner, { skill: true, type: 'electric' });
      if (W.ents.has(t.id) && Math.random() < 0.3) applyStatus(W, t, { stun: 0.8 }, u.id, u.owner);
    }
  }
  if (F.cannon && m.tick <= 0) {
    m.tick = F.cannon.every;
    const t = pick(F.cannon.radius * TILE);
    if (t) {
      const c = F.cannon, sr = c.splash * TILE;
      W.fx.push({ k: 'p', x1: u.x | 0, y1: (u.y - 14) | 0, x2: t.x | 0, y2: (t.y - 4) | 0, d: 0.45, s: 'cannon' });
      W.effects.push({ k: 'cannon', t: 0.45, x: t.x, y: t.y, r: sr, owner: u.owner, src: u.id, dmg: c.dmg * power(W, u), heal: c.heal });
    }
  }
  if (F.sun && m.tick <= 0) {
    m.tick = F.sun.every;
    const r = F.sun.radius * TILE;
    enemiesIn(W, u, r, (t) => applyStatus(W, t, { burn: F.sun.burn }, u.id, u.owner));
    W.nearUnits(u.x, u.y, r, (a) => { if (a.owner === u.owner && Math.hypot(a.x - u.x, a.y - u.y) <= r) addBuff(a, 'sun', F.sun.every + 0.2, F.sun.ally); });
  }
  if (F.pollen) {
    const r = F.pollen.radius * TILE;
    if (m.tick <= 0) {
      m.tick = 0.5;
      enemiesIn(W, u, r, (t) => W.damage(t, F.pollen.dps * 0.5 * power(W, u), u.id, u.owner, { skill: true, dot: true }));
      W.nearUnits(u.x, u.y, r, (a) => {
        if (a.owner === u.owner && Math.hypot(a.x - u.x, a.y - u.y) <= r) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * F.pollen.heal * 0.5);
      });
    }
  }
  if (F.shade) {
    const r = F.shade.radius * TILE;
    enemiesIn(W, u, r, (t) => { if (!t.slow || t.slow.m > F.shade.slow) applyStatus(W, t, { slow: { t: 0.6, m: F.shade.slow } }, u.id, u.owner); });
    if (m.tick <= 0) {
      m.tick = 0.5;
      enemiesIn(W, u, r, (t) => W.damage(t, F.shade.dps * 0.5 * power(W, u), u.id, u.owner, { skill: true, dot: true }));
    }
  }
  if (F.confuse && m.tick <= 0) {
    m.tick = F.confuse.every;
    for (let i = 0; i < F.confuse.count; i++) {
      const t = pick(F.confuse.radius * TILE);
      if (t) { applyStatus(W, t, { stun: F.confuse.stun }, u.id, u.owner); W.fx.push({ k: 'sk_hit', x: t.x | 0, y: t.y | 0, r: 10, s: 'psychic' }); }
    }
  }
  if (F.orbs && m.tick <= 0) {
    m.tick = F.orbs.every;
    const t = pick(F.orbs.radius * TILE);
    if (t) {
      W.fx.push({ k: 'p', x1: u.x | 0, y1: (u.y - 20) | 0, x2: t.x | 0, y2: (t.y - 4) | 0, d: 0.35, s: 'psyorb' });
      W.effects.push({ k: 'orb', t: 0.35, id: t.id, owner: u.owner, src: u.id, dmg: F.orbs.dmg * power(W, u) });
    }
  }
  if (F.tornado) {
    const r = F.tornado.radius * TILE;
    enemiesIn(W, u, r, (t) => {
      if (UNITS[t.type].limit || unitMods(W, t).stalwart) return;
      const d = Math.hypot(u.x - t.x, u.y - t.y);
      if (d < u.radius + t.radius + 6) return;
      const nx = t.x + (u.x - t.x) / d * F.tornado.pull * dt, ny = t.y + (u.y - t.y) / d * F.tornado.pull * dt;
      if (!W.blockedFor(t, nx, ny)) { t.x = nx; t.y = ny; }
    });
    if (m.tick <= 0) {
      m.tick = 0.5;
      enemiesIn(W, u, r, (t) => W.damage(t, F.tornado.dps * 0.5 * power(W, u), u.id, u.owner, { skill: true, dot: true }));
    }
  }
}

// Mega Mewtwo Y's Psystrike orbs landing
export function resolveOrb(W, e) {
  const t = W.ents.get(e.id);
  if (!t) return;
  W.fx.push({ k: 'sk_hit', x: t.x | 0, y: t.y | 0, r: 12, s: 'psystrike' });
  W.damage(t, e.dmg * effectiveness('psychic', FORMS[t.form].type), e.src, e.owner, { skill: true, type: 'psychic' });
}

// Blastoise cannon shells landing
export function resolveCannon(W, e) {
  W.fx.push({ k: 'sk_hit', x: e.x | 0, y: e.y | 0, r: e.r | 0, s: 'hydropump' });
  W.nearUnits(e.x, e.y, e.r + 16, (t) => {
    if (!W.ents.has(t.id) || Math.hypot(t.x - e.x, t.y - e.y) > e.r + t.radius) return;
    if (t.owner === e.owner) t.hp = Math.min(t.maxHp, t.hp + e.heal);
    else W.damage(t, e.dmg * effectiveness('water', FORMS[t.form].type), e.src, e.owner, { skill: true, type: 'water' });
  });
}

function knockFrom(W, t, x, y, amt) {
  const d = Math.hypot(t.x - x, t.y - y) || 1;
  const ux = (t.x - x) / d, uy = (t.y - y) / d;
  const k = UNITS[t.type].limit ? 0.3 : 1;
  for (let s = 0; s < 4; s++) {
    const nx = t.x + ux * amt * k / 4, ny = t.y + uy * amt * k / 4;
    if (W.blockedFor(t, nx, ny)) break;
    t.x = nx; t.y = ny;
  }
  t.path = null; t.pathKey = null;
}
