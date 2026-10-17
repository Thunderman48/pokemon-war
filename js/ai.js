// Computer opponent. Plays through world.issue() just like a human would.
import { UNITS, FORMS, BUILDINGS, RESEARCH, ABILITIES, TILE, DIFFICULTY, researchCost, effectiveness } from './config.js';

// enemy's most common type -> good counters
const COUNTER = {
  fire: ['squirtle', 'geodude'], water: ['bulbasaur', 'pikachu'], grass: ['charmander', 'pidgey'],
  electric: ['geodude', 'bulbasaur'], normal: ['geodude', 'charmander'], fighting: ['pidgey', 'charmander'],
  flying: ['geodude', 'pikachu'], rock: ['squirtle', 'bulbasaur'], dragon: ['pikachu', 'geodude'],
};
// research the AI wants for each line it owns, in order
const LINE_RESEARCH = {
  charmander: ['evo_charmeleon', 'evo_charizard'], squirtle: ['evo_wartortle', 'evo_blastoise', 'move_heal'],
  bulbasaur: ['evo_ivysaur', 'evo_venusaur', 'move_sleep'], geodude: ['evo_graveler', 'evo_golem'],
  pidgey: ['evo_pidgeotto', 'evo_pidgeot'], pikachu: ['thunderstone', 'move_thunder'],
  eevee: ['waterstone', 'thunderstone', 'firestone'], rayquaza: ['megastone', 'move_ascent'],
};

export class AI {
  constructor(world, pid, difficulty = 'normal') {
    this.w = world;
    this.pid = pid;
    this.key = difficulty;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    const me = world.players[pid];
    me.gatherMult = this.d.gather;
    me.noFog = true;
    me.ai = true;
    this.timer = 1;
    this.wave = this.d.firstWave;
    this.state = 'build'; // build -> stage -> attack
    this.stageT = 0;
    this.retreat = new Set(); // wounded units pulled back to heal
    this.enemy = 1 - pid;
    const s = world.map.starts[pid];
    this.homeT = { x: s.tx + 1, y: s.ty + 1 };
    this.home = { x: this.homeT.x * TILE + 8, y: this.homeT.y * TILE + 8 };
    const ex = { x: 10, y: world.h - 14 };
    this.expansion = pid === 0 ? ex : { x: world.w - 1 - ex.x, y: world.h - 1 - ex.y };
    this.seed = pid * 7919 + 13;
    this.researchT = 0;
  }

  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  update(dt) {
    this.w.notes[this.pid].length = 0;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.d.think;
    this.think();
  }

  think() {
    const W = this.w, pid = this.pid, me = W.players[pid];
    if (!me.alive || W.winner >= 0) return;
    const units = W.unitsOf(pid), blds = W.buildingsOf(pid);
    const workers = units.filter((u) => UNITS[u.type].worker);
    const army = units.filter((u) => !UNITS[u.type].worker);
    const count = (t, builtOnly) => blds.filter((b) => b.type === t && (!builtOnly || b.built)).length;
    const queued = (t) => blds.reduce((s, b) => s + b.queue.filter((q) => q.u === t).length, 0);
    const centers = blds.filter((b) => b.type === 'center' && b.built);
    this.built = false;

    // --- economy
    if (centers.length && workers.length + queued('machop') < this.d.workers * Math.min(2, centers.length)) {
      const c = centers.find((x) => x.queue.length < 2);
      if (c && W.canAfford(pid, UNITS.machop.cost) && me.pop + 1 <= me.cap) W.issue(pid, { c: 'train', id: c.id, type: 'machop' });
    }
    const hasGym = count('gym') > 0;
    let crystalW = workers.filter((u) => u.order.type === 'gather' && u.order.kind === 'crystal').length;
    const wantCrystal = !hasGym ? 1 : Math.ceil(workers.length * (me.c > me.b + 300 ? 0.15 : me.b > me.c + 300 ? 0.5 : 0.35));
    for (const u of workers) {
      if (u.order.type !== 'idle') continue;
      const kind = crystalW < wantCrystal ? 'crystal' : 'berry';
      const r = W.nearestResource(u, kind, 40) || W.nearestResource(u, kind === 'crystal' ? 'berry' : 'crystal', 40);
      if (r) { W.issue(pid, { c: 'target', ids: [u.id], target: r.id }); if (r.type === 'crystal') crystalW++; }
    }
    if (crystalW < wantCrystal - 1) {
      const u = workers.find((x) => x.order.type === 'gather' && x.order.kind === 'berry' && !x.carry.amt);
      const r = u && W.nearestResource(u, 'crystal', 40);
      if (r) W.issue(pid, { c: 'target', ids: [u.id], target: r.id });
    }
    // finish abandoned foundations
    for (const b of blds) {
      if (b.built) continue;
      if (!workers.some((u) => u.order.type === 'build' && u.order.target === b.id)) {
        const u = this.pickWorker(workers, b);
        if (u) W.issue(pid, { c: 'target', ids: [u.id], target: b.id });
      }
    }

    // --- buildings
    const pendingMart = blds.some((b) => b.type === 'mart' && !b.built);
    if (me.cap < 120 && me.cap - me.pop <= 4 + 3 * count('gym', true) && !pendingMart) this.build('mart', workers);
    if (!hasGym && workers.length >= 8) this.build('gym', workers);
    if (count('gym', true) && !count('lab') && workers.length >= 11 && W.time > (this.key === 'easy' ? 420 : 220)) this.build('lab', workers);
    if (this.key !== 'easy' && count('gym', true) === 1 && count('gym') === 1 && W.time > 330 && me.b > 300) this.build('gym', workers);
    const towers = this.key === 'hard' ? 2 : this.key === 'normal' ? 1 : 0;
    if (count('gym', true) && count('tower') < towers && W.time > 260) this.build('tower', workers, true);
    if (this.key !== 'easy' && count('lab', true) && !count('skypillar') && W.time > 540 && me.b > 350 && me.c > 300) this.build('skypillar', workers);
    // expand when the home berries run low
    const homeBerries = [...W.ents.values()].filter((e) => e.kind === 'res' && e.type === 'berry' &&
      Math.hypot(e.tx - this.homeT.x, e.ty - this.homeT.y) < 12).length;
    if (homeBerries <= 2 && count('center') < 2 && W.time > 240) this.build('center', workers, false, this.expansion);
    // smarter players expand before running dry
    if (this.key !== 'easy' && count('center') < 2 && W.time > (this.key === 'hard' ? 300 : 420) && me.b > 450) this.build('center', workers, false, this.expansion);
    // floating resources: turn them into more production
    const maxGyms = this.key === 'hard' ? 4 : this.key === 'normal' ? 3 : 1;
    if (count('gym', true) === count('gym') && count('gym') < maxGyms && W.time > 240 && me.b > 650) this.build('gym', workers);

    // --- research
    this.researchT -= this.d.think * this.d.research;
    if (this.researchT <= 0) this.doResearch(blds, army, me);

    // --- army production
    const enemyTypes = {};
    for (const e of W.unitsOf(this.enemy)) if (!UNITS[e.type].worker) {
      const t = FORMS[e.form].type;
      enemyTypes[t] = (enemyTypes[t] || 0) + UNITS[e.type].pop;
    }
    const lab = blds.find((b) => b.type === 'lab' && b.built);
    for (const g of blds.filter((b) => b.type === 'gym' && b.built)) {
      if (g.queue.length >= 2) continue;
      let t = this.pickUnit(enemyTypes, !!lab, false);
      if (lab && army.length >= 6 && this.rand() < 0.15 && W.canAfford(pid, UNITS.snorlax.cost) && me.pop + 6 <= me.cap) t = 'snorlax';
      if (W.canAfford(pid, UNITS[t].cost) && me.pop + UNITS[t].pop <= me.cap) W.issue(pid, { c: 'train', id: g.id, type: t });
      if (!g.rally) this.setRally(g);
    }
    const pillar = blds.find((b) => b.type === 'skypillar' && b.built);
    if (pillar && !pillar.queue.some((q) => q.u)) {
      if (!pillar.rally) this.setRally(pillar);
      if (W.unitCount(pid, 'rayquaza') < 1 && W.canAfford(pid, UNITS.rayquaza.cost) && me.pop + 10 <= me.cap)
        W.issue(pid, { c: 'train', id: pillar.id, type: 'rayquaza' });
      else if (this.rand() < 0.5 && W.canAfford(pid, { b: UNITS.pidgey.cost.b + 150, c: UNITS.pidgey.cost.c + 100 }) && me.pop + 2 <= me.cap)
        W.issue(pid, { c: 'train', id: pillar.id, type: 'pidgey' });
    }

    // --- special moves
    if (this.d.moves) this.useMoves(army);
    // Eevees are evolved automatically by the world for AI players

    // --- combat
    this.combat(army, blds);
  }

  // hp x dps: a rough measure of how hard a group hits and how long it lasts
  power(e) {
    if (e.kind === 'building') {
      const d = BUILDINGS[e.type];
      return d.dmg ? e.hp * d.dmg / d.cd : 0;
    }
    if (UNITS[e.type].worker) return 0;
    const st = this.w.stats(e);
    return Math.max(0, e.hp) * st.dmg / st.cd;
  }

  // Lanchester-ish strength of everything owned by `owner` within r of (x, y)
  strength(owner, x, y, r, skip) {
    let hp = 0, dps = 0;
    const add = (e) => {
      if (e.owner !== owner || (skip && skip.has(e.id)) || Math.hypot(e.x - x, e.y - y) > r) return;
      const p = this.power(e);
      if (!p) return;
      hp += e.hp; dps += p / Math.max(1, e.hp);
    };
    this.w.nearUnits(x, y, r, add);
    for (const b of this.w.buildingsOf(owner)) if (b.built) add(b);
    return hp * dps;
  }

  centroid(list) {
    let x = 0, y = 0;
    for (const u of list) { x += u.x; y += u.y; }
    return { x: x / list.length, y: y / list.length };
  }

  combat(army, blds) {
    const W = this.w, pid = this.pid, smart = this.key !== 'easy';
    const ids = (list) => list.map((u) => u.id);
    const pop = (list) => list.reduce((s, u) => s + UNITS[u.type].pop, 0);
    const homeD = (u) => Math.hypot(u.x - this.home.x, u.y - this.home.y);

    // wounded Pokémon fall back to the Center to regenerate, then rejoin
    for (const id of this.retreat) {
      const u = W.ents.get(id);
      if (!u || u.hp >= u.maxHp * 0.85) this.retreat.delete(id);
    }
    if (smart) for (const u of army) {
      if (this.retreat.has(u.id) || u.ascend || u.hp > u.maxHp * 0.3 || homeD(u) < 16 * TILE) continue;
      this.retreat.add(u.id);
      W.issue(pid, { c: 'move', ids: [u.id], x: this.home.x, y: this.home.y, attack: false });
    }
    const ready = army.filter((u) => !this.retreat.has(u.id));

    // enemies close to our buildings
    const intruders = W.unitsOf(this.enemy).filter((e) => !UNITS[e.type].worker &&
      blds.some((b) => Math.hypot(e.x - b.x, e.y - b.y) < 12 * TILE));
    if (intruders.length) {
      const c = this.centroid(intruders);
      const threatS = this.strength(this.enemy, c.x, c.y, 10 * TILE);
      const nearHome = ready.filter((u) => homeD(u) < 22 * TILE);
      const homeS = this.strength(pid, c.x, c.y, 22 * TILE, this.retreat);
      // the base is in real danger: call the attack back
      if (this.state !== 'build' && (!smart || threatS > homeS * 0.8)) {
        this.state = 'build';
        const away = ready.filter((u) => homeD(u) >= 22 * TILE);
        if (away.length) W.issue(pid, { c: 'move', ids: ids(away), x: c.x, y: c.y, attack: true });
      }
      const defenders = (this.state === 'build' ? ready : nearHome).filter((u) => u.order.type !== 'attack' && u.order.type !== 'cast');
      if (defenders.length) W.issue(pid, { c: 'move', ids: ids(defenders), x: c.x, y: c.y, attack: true });
      // retreating units help too if the fight is at the door
      const hurt = army.filter((u) => this.retreat.has(u.id) && u.order.type === 'idle');
      if (hurt.length) W.issue(pid, { c: 'move', ids: ids(hurt), x: c.x, y: c.y, attack: true });
    } else if (this.state === 'build') {
      if (pop(ready) >= this.wave) {
        // gather at a forward point first so the army arrives together
        this.state = 'stage';
        this.stageT = 0;
        this.wave += this.d.waveGrow;
        this.stagePt = this.stagePoint();
        W.issue(pid, { c: 'move', ids: ids(ready), x: this.stagePt.x, y: this.stagePt.y, attack: true });
      }
    } else if (this.state === 'stage') {
      this.stageT += this.d.think;
      const p = this.stagePt;
      const there = ready.filter((u) => Math.hypot(u.x - p.x, u.y - p.y) < 7 * TILE).length;
      if (there >= ready.length * 0.8 || this.stageT > 25) {
        this.state = 'attack';
        const t = this.enemyTarget();
        if (t) W.issue(pid, { c: 'move', ids: ids(ready), x: t.x, y: t.y, attack: true });
      } else {
        const idle = ready.filter((u) => u.order.type === 'idle' && Math.hypot(u.x - p.x, u.y - p.y) >= 7 * TILE);
        if (idle.length) W.issue(pid, { c: 'move', ids: ids(idle), x: p.x, y: p.y, attack: true });
      }
    } else if (this.state === 'attack') {
      const front = ready.filter((u) => homeD(u) > 20 * TILE);
      const lowPop = pop(ready) < (this.wave - this.d.waveGrow) * 0.3;
      let outmatched = false;
      if (smart && front.length) {
        const c = this.centroid(front);
        const mine = this.strength(pid, c.x, c.y, 12 * TILE, this.retreat);
        const theirs = this.strength(this.enemy, c.x, c.y, 13 * TILE);
        outmatched = theirs > mine * 1.5;
      }
      if (lowPop || outmatched) {
        // losing fight: save the army and come back bigger
        this.state = 'build';
        W.issue(pid, { c: 'move', ids: ids(ready), x: this.home.x, y: this.home.y, attack: false });
      } else {
        const t = this.enemyTarget();
        const idleFront = front.filter((u) => u.order.type === 'idle');
        if (idleFront.length && t) W.issue(pid, { c: 'move', ids: ids(idleFront), x: t.x, y: t.y, attack: true });
        // reinforcements join the army in groups instead of trickling in one by one
        const fresh = ready.filter((u) => homeD(u) <= 20 * TILE && u.order.type === 'idle');
        if (pop(fresh) >= 6 || (fresh.length && !front.length)) {
          const to = front.length ? this.centroid(front) : t;
          if (to) W.issue(pid, { c: 'move', ids: ids(fresh), x: to.x, y: to.y, attack: true });
        }
      }
    }

    if (smart) this.focusFire(ready);
  }

  stagePoint() {
    const e = this.w.map.starts[this.enemy];
    const ex = e.tx * TILE, ey = e.ty * TILE;
    const dx = ex - this.home.x, dy = ey - this.home.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(10 * TILE, d * 0.3);
    return { x: this.home.x + (dx / d) * k, y: this.home.y + (dy / d) * k };
  }

  // pick targets that die fastest to our type: low HP, dangerous, super-effective; avoid overkill
  focusFire(units) {
    const W = this.w, pid = this.pid;
    const planned = new Map();
    for (const u of units) {
      if (u.order.type === 'cast' || u.ascend || u.sleep > 0) continue;
      const cur = u.order.type === 'attack' ? W.ents.get(u.order.target) : null;
      if (u.order.type !== 'attack' && u.order.type !== 'move') continue;
      if (u.order.type === 'move' && !u.order.attack) continue;
      const st = W.stats(u);
      const reach = st.range + 1.5 * TILE + u.radius;
      let best = null, bs = 0, curS = 0;
      W.nearUnits(u.x, u.y, reach + 16, (e) => {
        if (e.owner === pid || e.owner < 0 || !W.ents.has(e.id) || !W.canHit(u, e) || !W.isVisible(pid, e)) return;
        if (Math.hypot(e.x - u.x, e.y - u.y) > reach + e.radius) return;
        const left = e.hp - (planned.get(e.id) || 0);
        if (left <= 0) return; // already dying
        const eff = effectiveness(st.type, FORMS[e.form].type);
        const danger = UNITS[e.type].worker ? 0.15 : this.power(e) / Math.max(1, e.hp) + 1;
        const s = eff * danger / Math.max(15, left);
        if (cur === e) curS = s;
        if (s > bs) { bs = s; best = e; }
      });
      if (!best) continue;
      const hit = st.dmg * effectiveness(st.type, FORMS[best.form].type) * (1 + this.d.think / st.cd);
      if (best === cur || (cur && cur.kind === 'unit' && bs < curS * 1.4)) {
        if (cur && cur.kind === 'unit') planned.set(cur.id, (planned.get(cur.id) || 0) + hit);
        continue;
      }
      planned.set(best.id, (planned.get(best.id) || 0) + hit);
      W.issue(pid, { c: 'target', ids: [u.id], target: best.id });
    }
  }

  setRally(b) {
    const dx = Math.sign(this.w.map.starts[this.enemy].tx - this.homeT.x);
    this.w.issue(this.pid, { c: 'rally', id: b.id, x: this.home.x + dx * 5 * TILE, y: this.home.y + dx * 5 * TILE });
  }

  doResearch(blds, army, me) {
    const W = this.w, pid = this.pid;
    // what to research next, by priority
    const wants = [];
    const lines = new Set(army.map((u) => u.type));
    for (const l of lines) for (const k of LINE_RESEARCH[l] || []) wants.push(k);
    wants.push('harvest', 'attack', 'defense', 'drill', 'bigbag');
    if (this.key === 'hard') wants.push('fortify', 'towerup', 'martplus');
    for (const k of wants) {
      if (k.startsWith('move_') && !this.d.moves) continue;
      if (W.researchBlock(pid, k)) continue;
      const at = blds.find((b) => b.built && (BUILDINGS[b.type].research || []).includes(k) && !b.queue.some((q) => q.r));
      if (!at) continue;
      const cost = researchCost(k, W.rlevel(pid, k));
      // keep some money for the army
      if (me.b < cost.b + 150 || me.c < cost.c + 50) return;
      W.issue(pid, { c: 'research', id: at.id, key: k });
      this.researchT = RESEARCH[k].time * 0.5;
      return;
    }
  }

  useMoves(army) {
    const W = this.w, pid = this.pid;
    for (const u of army) {
      const key = FORMS[u.form].ability;
      if (!key || u.acd > 0 || u.sleep > 0 || u.order.type === 'cast' || !W.rlevel(pid, ABILITIES[key].research)) continue;
      const ab = ABILITIES[key];
      const reach = (ab.range + 2) * TILE, r = ab.radius * TILE;
      if (key === 'heal') {
        let hurt = 0, sx = 0, sy = 0;
        W.nearUnits(u.x, u.y, reach, (e) => {
          if (e.owner === pid && e.hp < e.maxHp * 0.6) { hurt++; sx += e.x; sy += e.y; }
        });
        if (hurt >= 2) W.issue(pid, { c: 'cast', ids: [u.id], key, x: sx / hurt, y: sy / hurt });
      } else {
        // aim at the densest enemy group in reach
        let best = null, bn = 1;
        W.nearUnits(u.x, u.y, reach, (e) => {
          if (e.owner === pid || UNITS[e.type].worker || e.sleep > 0 || (key === 'thunder' && FORMS[e.form].type === 'rock')) return;
          let n = 0;
          W.nearUnits(e.x, e.y, r, (f) => { if (f.owner !== pid && Math.hypot(f.x - e.x, f.y - e.y) <= r) n++; });
          if (n > bn) { bn = n; best = e; }
        });
        let tx = best && best.x, ty = best && best.y;
        if (key === 'ascent') {
          // Dragon Ascent: weigh groups by the HP it can drain, and dive on buildings too
          let bv = 0;
          const value = (x, y) => {
            let v = 0;
            W.nearUnits(x, y, r + 12, (f) => {
              if (f.owner !== pid && Math.hypot(f.x - x, f.y - y) <= r + f.radius) v += Math.min(f.hp, ab.dmg) / ab.dmg * (UNITS[f.type].worker ? 0.5 : 1);
            });
            for (const b of W.buildingsOf(this.enemy)) if (Math.hypot(b.x - x, b.y - y) <= r + b.radius) v += b.type === 'center' ? 1.5 : 0.8;
            return v;
          };
          W.nearUnits(u.x, u.y, reach, (e) => { if (e.owner !== pid) { const v = value(e.x, e.y); if (v > bv) { bv = v; tx = e.x; ty = e.y; } } });
          for (const b of W.buildingsOf(this.enemy)) {
            if (Math.hypot(b.x - u.x, b.y - u.y) > reach) continue;
            const v = value(b.x, b.y);
            if (v > bv) { bv = v; tx = b.x; ty = b.y; }
          }
          // when badly hurt, the life steal is worth a smaller target
          if (bv < (u.hp < u.maxHp * 0.5 ? 1 : 2)) continue;
        } else if (!best) continue;
        W.issue(pid, { c: 'cast', ids: [u.id], key, x: tx, y: ty });
      }
    }
  }

  enemyTarget() {
    let best = null, bd = Infinity;
    // go for the Pokémon Centers: destroying them all wins the game
    const all = this.w.buildingsOf(this.enemy);
    const centers = all.filter((b) => b.type === 'center');
    for (const b of centers.length ? centers : all) {
      const d = Math.hypot(b.x - this.home.x, b.y - this.home.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      // aim at the near side of the building so units path to it
      const dx = this.home.x - best.x, dy = this.home.y - best.y, d = Math.hypot(dx, dy) || 1;
      return { x: best.x + (dx / d) * best.radius * 1.2, y: best.y + (dy / d) * best.radius * 1.2 };
    }
    return null;
  }

  pickUnit(enemyTypes, hasLab) {
    const opts = ['charmander', 'squirtle', 'bulbasaur', 'geodude', 'eevee'];
    if (hasLab) opts.push('pikachu');
    const ok = (t) => t !== 'pidgey' && (t !== 'pikachu' || hasLab);
    if (this.d.counter && this.rand() < 0.6) {
      let top = null, tv = 0;
      for (const [k, v] of Object.entries(enemyTypes)) if (v > tv) { tv = v; top = k; }
      const c = top && (COUNTER[top] || []).filter(ok);
      if (c && c.length) return c[Math.floor(this.rand() * c.length)];
    }
    return opts[Math.floor(this.rand() * opts.length)];
  }

  pickWorker(workers, near) {
    let best = null, bd = Infinity;
    for (const u of workers) {
      if (u.order.type === 'build') continue;
      const d = Math.hypot(u.x - near.x, u.y - near.y) + (u.carry.amt ? 60 : 0);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  build(type, workers, forward = false, around) {
    if (this.built) return; // one building per think
    const W = this.w, pid = this.pid;
    const def = BUILDINGS[type];
    if (!W.canAfford(pid, def.cost) || !W.reqMet(pid, def.req)) return;
    let c = around || this.homeT;
    if (forward) {
      const e = W.map.starts[this.enemy];
      const dx = Math.sign(e.tx - this.homeT.x), dy = Math.sign(e.ty - this.homeT.y);
      c = { x: this.homeT.x + dx * 6, y: this.homeT.y + dy * 6 };
    }
    const spot = this.findSpot(type, c);
    if (!spot) return;
    const u = this.pickWorker(workers, { x: spot.tx * TILE, y: spot.ty * TILE });
    if (!u) return;
    W.issue(pid, { c: 'build', ids: [u.id], type, tx: spot.tx, ty: spot.ty });
    this.built = true;
  }

  findSpot(type, c) {
    const W = this.w;
    const def = BUILDINGS[type];
    const res = [...W.ents.values()].filter((e) => e.kind === 'res');
    for (let r = 2; r <= 14; r++) {
      const cands = [];
      for (let y = c.y - r; y <= c.y + r; y++)
        for (let x = c.x - r; x <= c.x + r; x++)
          if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) === r) cands.push({ tx: x - (def.w >> 1), ty: y - (def.h >> 1) });
      for (let i = cands.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [cands[i], cands[j]] = [cands[j], cands[i]];
      }
      for (const s of cands) {
        if (!W.canPlace(type, s.tx, s.ty, this.pid)) continue;
        // keep a 1-tile gap around buildings and 2 tiles from resources
        let ok = true;
        for (let y = s.ty - 1; y <= s.ty + def.h && ok; y++)
          for (let x = s.tx - 1; x <= s.tx + def.w && ok; x++)
            if (W.blockedTile(x, y) && W.occ[y * W.w + x]) ok = false;
        if (!ok) continue;
        if (res.some((e) => e.tx >= s.tx - 2 && e.tx <= s.tx + def.w + 1 && e.ty >= s.ty - 2 && e.ty <= s.ty + def.h + 1)) continue;
        return s;
      }
    }
    return null;
  }
}

