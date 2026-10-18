// Computer opponent. Plays through world.issue() just like a human would.
import { UNITS, FORMS, BUILDINGS, RESEARCH, SKILLS, TILE, DIFFICULTY, AI_DECKS, researchCost, effectiveness, squadPop, skillResearch } from './config.js';
import { megaBlock } from './mega.js';

// enemy's most common type -> good counters
const COUNTER = {
  fire: ['squirtle', 'geodude'], water: ['bulbasaur', 'pikachu'], grass: ['charmander', 'pidgey'],
  electric: ['geodude', 'bulbasaur'], normal: ['geodude', 'machopf', 'gastly'], fighting: ['pidgey', 'abra', 'gastly'],
  flying: ['geodude', 'pikachu'], rock: ['squirtle', 'bulbasaur', 'machopf'], dragon: ['pikachu', 'geodude', 'duraludon'],
  psychic: ['gastly', 'duraludon'], ghost: ['gastly', 'abra'], steel: ['charmander', 'machopf'],
};
// evolution research the AI wants for each line it owns, in order (skills come from its deck)
const LINE_RESEARCH = {
  charmander: ['evo_charmeleon', 'evo_charizard'], squirtle: ['evo_wartortle', 'evo_blastoise'],
  bulbasaur: ['evo_ivysaur', 'evo_venusaur'], geodude: ['evo_graveler', 'evo_golem'],
  pidgey: ['evo_pidgeotto', 'evo_pidgeot'], pikachu: ['thunderstone'],
  eevee: ['waterstone', 'thunderstone', 'firestone'], rayquaza: [],
  gastly: ['evo_haunter', 'evo_gengar'], machopf: ['evo_machoke', 'evo_machamp'], abra: ['evo_kadabra', 'evo_alakazam'],
  duraludon: ['evo_archaludon'], mewtwo: [],
};

export class AI {
  // the deck the computer brings: Easy keeps to the classic one, harder levels pick any
  static deckFor(difficulty, seed = 0) {
    const i = difficulty === 'easy' ? 0 : Math.abs(seed) % AI_DECKS.length;
    return JSON.parse(JSON.stringify(AI_DECKS[i]));
  }

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
    this.retreat = new Set(); // wounded squads (by squad key) pulled back to heal and refill
    this.enemy = 1 - pid;
    const s = world.map.starts[pid];
    this.homeT = { x: s.tx + 1, y: s.ty + 1 };
    this.home = { x: this.homeT.x * TILE + 8, y: this.homeT.y * TILE + 8 };
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
    // workers: up to the difficulty's count per Center (max 3 Centers' worth), whichever deck worker we have fewer of
    const wts = W.workerTypes(pid);
    const nW = (t) => workers.filter((u) => u.type === t).length + queued(t);
    const wt = wts.reduce((a, b) => (nW(b) < nW(a) ? b : a));
    const wantWorkers = this.d.workers * Math.max(1, Math.min(3, centers.length));
    if (centers.length && workers.length + wts.reduce((n, t) => n + queued(t), 0) < wantWorkers) {
      const c = centers.filter((x) => x.queue.length < 2).sort((x, y) => x.queue.length - y.queue.length)[0];
      if (c && W.canAfford(pid, UNITS[wt].cost) && me.pop + 1 <= me.cap) W.issue(pid, { c: 'train', id: c.id, type: wt });
    }
    this.balanceWorkers(workers, count('gym') > 0, me);
    // finish abandoned foundations; give up on ones that stopped making progress (e.g. unreachable)
    this.stuck = this.stuck || new Map();
    for (const b of blds) {
      if (b.built) { this.stuck.delete(b.id); continue; }
      const st = this.stuck.get(b.id) || { p: b.progress, t: W.time };
      if (b.progress > st.p + 0.001) { st.p = b.progress; st.t = W.time; }
      this.stuck.set(b.id, st);
      if (W.time - st.t > 25) {
        W.issue(pid, { c: 'cancel', id: b.id });
        this.badSpots = this.badSpots || new Set();
        this.badSpots.add(b.tx + ',' + b.ty);
        this.stuck.delete(b.id);
        continue;
      }
      if (!workers.some((u) => u.order.type === 'build' && u.order.target === b.id)) {
        const u = this.pickWorker(workers, b);
        if (u) W.issue(pid, { c: 'target', ids: [u.id], target: b.id });
      }
    }

    // --- buildings: work down a priority list, saving up for the first one we can't afford yet
    this.reserve = { b: 0, c: 0 };
    const threatened = W.unitsOf(this.enemy).some((e) => !UNITS[e.type].worker && blds.some((b) => Math.hypot(e.x - b.x, e.y - b.y) < 12 * TILE));
    for (const want of this.buildWants(blds, workers, count, me)) {
      const def = BUILDINGS[want.type];
      if (!W.reqMet(pid, def.req)) continue;
      if (W.canAfford(pid, def.cost)) {
        if (this.build(want.type, workers, want.forward, want.at)) break;
        continue; // no room there: try the next one
      }
      // can't afford it yet: hold back army spending until we can (unless we're under attack)
      if (!threatened && !want.cheap) this.reserve = { b: def.cost.b || 0, c: def.cost.c || 0 };
      break;
    }

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
      const t = this.pickUnit(enemyTypes, army.length);
      if (t && this.canSpend(UNITS[t].cost) && me.pop + squadPop(t) <= me.cap) W.issue(pid, { c: 'train', id: g.id, type: t });
      if (!g.rally) this.setRally(g);
    }
    const pillar = blds.find((b) => b.type === 'skypillar' && b.built);
    if (pillar && !pillar.queue.some((q) => q.u)) {
      if (!pillar.rally) this.setRally(pillar);
      const lg = W.legendType(pid);
      if (lg && W.unitCount(pid, lg) < (UNITS[lg].limit || 1) && this.canSpend(UNITS[lg].cost) && me.pop + squadPop(lg) <= me.cap)
        W.issue(pid, { c: 'train', id: pillar.id, type: lg });
    }

    // special moves are auto-cast by the world for every squad
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
    // squads retreat and rejoin together; they also refill their fallen members at home
    const key = (u) => u.sq || 'u' + u.id;
    const groups = new Map();
    for (const u of army) {
      if (!groups.has(key(u))) groups.set(key(u), []);
      groups.get(key(u)).push(u);
    }
    for (const k of this.retreat) {
      const g = groups.get(k);
      const sq = g && W.squadOf(g[0]);
      if (!g || (g.every((u) => u.hp >= u.maxHp * 0.85) && (!sq || g.length >= sq.size || sq.warned))) this.retreat.delete(k);
    }
    if (smart) for (const [k, g] of groups) {
      const lead = g[0], sq = W.squadOf(lead);
      if (this.retreat.has(k) || g.some((u) => u.ascend) || homeD(lead) < 16 * TILE) continue;
      const hp = g.reduce((s, u) => s + u.hp, 0), max = lead.maxHp * (sq ? sq.size : 1);
      if (hp > max * 0.3) continue;
      this.retreat.add(k);
      W.issue(pid, { c: 'move', ids: g.map((u) => u.id), x: this.home.x, y: this.home.y, attack: false });
    }
    this.retreatIds = new Set(army.filter((u) => this.retreat.has(key(u))).map((u) => u.id));
    const ready = army.filter((u) => !this.retreatIds.has(u.id));

    // enemies close to our buildings
    const intruders = W.unitsOf(this.enemy).filter((e) => !UNITS[e.type].worker &&
      blds.some((b) => Math.hypot(e.x - b.x, e.y - b.y) < 12 * TILE));
    if (intruders.length) {
      const c = this.centroid(intruders);
      const threatS = this.strength(this.enemy, c.x, c.y, 10 * TILE);
      const nearHome = ready.filter((u) => homeD(u) < 22 * TILE);
      const homeS = this.strength(pid, c.x, c.y, 22 * TILE, this.retreatIds);
      // the base is in real danger: call the attack back
      if (this.state !== 'build' && (!smart || threatS > homeS * 0.8)) {
        this.state = 'build';
        const away = ready.filter((u) => homeD(u) >= 22 * TILE);
        if (away.length) W.issue(pid, { c: 'move', ids: ids(away), x: c.x, y: c.y, attack: true });
      }
      const defenders = (this.state === 'build' ? ready : nearHome).filter((u) => u.order.type !== 'attack' && u.order.type !== 'cast');
      if (defenders.length) W.issue(pid, { c: 'move', ids: ids(defenders), x: c.x, y: c.y, attack: true });
      // retreating units help too if the fight is at the door
      const hurt = army.filter((u) => this.retreatIds.has(u.id) && u.order.type === 'idle');
      if (hurt.length) W.issue(pid, { c: 'move', ids: ids(hurt), x: c.x, y: c.y, attack: true });
    } else if (this.state === 'build') {
      // no attacks before the difficulty's grace period is over
      if (pop(ready) >= this.wave && W.time >= this.d.firstAttack) {
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
        const mine = this.strength(pid, c.x, c.y, 12 * TILE, this.retreatIds);
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
        if (pop(fresh) >= 8 || (fresh.length && !front.length)) {
          const to = front.length ? this.centroid(front) : t;
          if (to) W.issue(pid, { c: 'move', ids: ids(fresh), x: to.x, y: to.y, attack: true });
        }
      }
    }

    if (smart) this.focusFire(ready);
    // Mega Evolve squads that are fighting
    if (this.key !== 'easy' && W.rlevel(pid, 'keystone')) {
      for (const [, g] of groups) {
        const sq = W.squadOf(g[0]);
        if (!sq || !g.some((u) => u.order.type === 'attack') || megaBlock(W, sq)) continue;
        W.issue(pid, { c: 'mega', ids: [g[0].id] });
      }
    }
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

  // can we pay for this and still keep what we're saving for a building?
  canSpend(cost) {
    const p = this.w.players[this.pid], r = this.reserve || { b: 0, c: 0 };
    return p.b >= (cost.b || 0) + r.b && p.c >= (cost.c || 0) + r.c;
  }

  // Buildings the AI wants, most important first.
  buildWants(blds, workers, count, me) {
    const W = this.w, t = W.time, easy = this.key === 'easy', hard = this.key === 'hard';
    const wants = [];
    const gyms = count('gym'), centers = count('center');
    // rebuild what was lost
    if (!centers) wants.push({ type: 'center', at: this.homeT });
    if (!gyms && workers.length >= 4) wants.push({ type: 'gym' });
    // supply (cheap, always first when tight)
    const pendingMart = blds.some((b) => b.type === 'mart' && !b.built);
    if (me.cap < 200 && me.cap - me.pop <= 6 + 5 * count('gym', true) && !pendingMart) wants.push({ type: 'mart', cheap: true });
    // expand to fresh resources: early on harder levels, or when the bases are running dry
    const dry = this.nearBerries(blds) <= 3;
    const maxCenters = easy ? 2 : 3;
    if (centers && centers < maxCenters && !blds.some((b) => b.type === 'center' && !b.built)) {
      const time = centers === 1 ? (easy ? 600 : hard ? 300 : 420) : 900;
      if (dry || t > time) {
        const at = this.expansionSpot(blds);
        if (at) wants.push({ type: 'center', at });
      }
    }
    if (gyms === 1 && count('gym', true) === 1 && !easy && t > 330) wants.push({ type: 'gym' });
    if (count('gym', true) && !count('lab') && t > (easy ? 420 : 220)) wants.push({ type: 'lab' });
    const towers = hard ? 2 : easy ? 0 : 1;
    if (count('gym', true) && count('tower') < towers && t > 260) wants.push({ type: 'tower', forward: true, cheap: true });
    if (!easy && count('lab', true) && !count('skypillar') && t > 540) wants.push({ type: 'skypillar' });
    const maxGyms = hard ? 4 : easy ? 1 : 3;
    if (gyms < maxGyms && count('gym', true) === gyms && t > 600) wants.push({ type: 'gym' });
    return wants;
  }

  // berry bushes left near our Centers
  nearBerries(blds) {
    const cs = blds.filter((b) => b.type === 'center');
    let n = 0;
    for (const e of this.w.ents.values()) {
      if (e.kind === 'res' && e.type === 'berry' && cs.some((c) => Math.hypot(e.x - c.x, e.y - c.y) < 12 * TILE)) n++;
    }
    return n;
  }

  // the closest patch of berries that has no Center of ours nearby and is away from the enemy
  expansionSpot(blds) {
    const W = this.w;
    const mine = blds.filter((b) => b.type === 'center');
    const theirs = W.buildingsOf(this.enemy);
    let best = null, bs = Infinity;
    for (const e of W.ents.values()) {
      if (e.kind !== 'res' || e.type !== 'berry') continue;
      if (mine.some((c) => Math.hypot(e.x - c.x, e.y - c.y) < 13 * TILE)) continue;
      if (theirs.some((b) => Math.hypot(e.x - b.x, e.y - b.y) < 16 * TILE)) continue;
      // prefer rich spots (several bushes together) close to home
      let near = 0;
      for (const f of W.ents.values()) if (f.kind === 'res' && Math.hypot(f.x - e.x, f.y - e.y) < 5 * TILE) near++;
      const s = Math.hypot(e.x - this.home.x, e.y - this.home.y) - near * 3 * TILE;
      if (s < bs) { bs = s; best = e; }
    }
    return best ? { x: best.tx, y: best.ty } : null;
  }

  // Keep the berry/crystal split sensible and move workers over when one resource piles up.
  balanceWorkers(workers, hasGym, me) {
    const W = this.w, pid = this.pid;
    const gath = workers.filter((u) => u.order.type === 'gather' || u.order.type === 'idle');
    let frac = hasGym ? 0.35 : 0.1;
    if (me.c > me.b + 250 || me.b < 60) frac = 0.12;
    else if (me.b > me.c + 250 || me.c < 40) frac = 0.55;
    const want = Math.max(hasGym ? 1 : 0, Math.round(gath.length * frac));
    let crystalW = workers.filter((u) => u.order.type === 'gather' && u.order.kind === 'crystal').length;
    for (const u of workers) {
      if (u.order.type !== 'idle') continue;
      const kind = crystalW < want ? 'crystal' : 'berry';
      const r = W.nearestResource(u, kind, 60) || W.nearestResource(u, kind === 'crystal' ? 'berry' : 'crystal', 60);
      if (r) { W.issue(pid, { c: 'target', ids: [u.id], target: r.id }); if (r.type === 'crystal') crystalW++; }
    }
    // shift up to two workers per think toward the resource we're short of
    for (let i = 0; i < 2; i++) {
      const from = crystalW > want + 1 ? 'crystal' : crystalW < want - 1 ? 'berry' : null;
      if (!from) break;
      const u = workers.find((x) => x.order.type === 'gather' && x.order.kind === from && !x.carry.amt);
      const r = u && W.nearestResource(u, from === 'crystal' ? 'berry' : 'crystal', 60);
      if (!r) break;
      W.issue(pid, { c: 'target', ids: [u.id], target: r.id });
      crystalW += from === 'crystal' ? -1 : 1;
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
    for (const l of lines) {
      // skills first (actives only on smarter difficulties), then evolutions
      const sk = W.loadout(pid, l).filter((k) => this.d.moves || SKILLS[k].kind === 'p');
      wants.push(sk[0] && skillResearch(sk[0]), ...(LINE_RESEARCH[l] || []).slice(0, 1), ...sk.slice(1).map(skillResearch), ...(LINE_RESEARCH[l] || []).slice(1));
    }
    for (const wt of W.workerTypes(pid)) wants.push(...W.loadout(pid, wt).map(skillResearch));
    // Mega Evolution once something can use it
    if (this.key !== 'easy' && army.some((u) => FORMS[u.form].mega)) wants.unshift('keystone');
    wants.push('harvest', 'attack', 'defense', 'drill', 'bigbag');
    if (this.key === 'hard') wants.push('fortify', 'towerup', 'martplus');
    for (const k of wants) {
      if (!k || W.researchBlock(pid, k)) continue;
      const at = blds.find((b) => b.built && (BUILDINGS[b.type].research || []).includes(k) && b.queue.filter((q) => q.r).length < 2);
      if (!at) continue;
      const cost = researchCost(k, W.rlevel(pid, k));
      // keep some money for the army
      if (!this.canSpend({ b: cost.b + 100, c: cost.c + 40 })) return;
      W.issue(pid, { c: 'research', id: at.id, key: k });
      this.researchT = RESEARCH[k].time * 0.3;
      return;
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

  // a fighter from the AI's deck: often a counter to the enemy's most common type
  pickUnit(enemyTypes, armySize) {
    const W = this.w, pid = this.pid;
    const opts = W.players[pid].deck.slots.map((s) => s.line).filter((t) => !UNITS[t].worker && !UNITS[t].limit)
      .filter((t) => W.reqMet(pid, UNITS[t].req) && (squadPop(t) < 8 || armySize >= 6));
    if (!opts.length) return null;
    const ok = (t) => opts.includes(t);
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

  // Place a building. Returns true if a worker was sent.
  build(type, workers, forward = false, around) {
    if (this.built) return true; // one building per think
    const W = this.w, pid = this.pid;
    const def = BUILDINGS[type];
    if (!W.canAfford(pid, def.cost) || !W.reqMet(pid, def.req)) return false;
    // home first, then around our other Centers when the main base is full
    const centers = [this.homeT, ...W.buildingsOf(pid).filter((b) => b.type === 'center').map((b) => ({ x: b.tx + 1, y: b.ty + 1 }))];
    let tries = around ? [around] : centers;
    if (forward) {
      const e = W.map.starts[this.enemy];
      const dx = Math.sign(e.tx - this.homeT.x), dy = Math.sign(e.ty - this.homeT.y);
      tries = [{ x: this.homeT.x + dx * 6, y: this.homeT.y + dy * 6 }, ...centers];
    }
    let spot = null;
    for (const c of tries) if ((spot = this.findSpot(type, c))) break;
    if (!spot) return false;
    const u = this.pickWorker(workers, { x: spot.tx * TILE, y: spot.ty * TILE });
    if (!u) return false;
    W.issue(pid, { c: 'build', ids: [u.id], type, tx: spot.tx, ty: spot.ty });
    this.built = true;
    return true;
  }

  findSpot(type, c) {
    const W = this.w;
    const def = BUILDINGS[type];
    const res = [...W.ents.values()].filter((e) => e.kind === 'res');
    for (let r = 2; r <= 18; r++) {
      const cands = [];
      for (let y = c.y - r; y <= c.y + r; y++)
        for (let x = c.x - r; x <= c.x + r; x++)
          if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) === r) cands.push({ tx: x - (def.w >> 1), ty: y - (def.h >> 1) });
      for (let i = cands.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [cands[i], cands[j]] = [cands[j], cands[i]];
      }
      for (const s of cands) {
        if (this.badSpots && this.badSpots.has(s.tx + ',' + s.ty)) continue;
        if (!W.canPlace(type, s.tx, s.ty, this.pid)) continue;
        // keep a 1-tile gap around buildings and 2 tiles from resources
        let ok = true;
        for (let y = s.ty - 1; y <= s.ty + def.h && ok; y++)
          for (let x = s.tx - 1; x <= s.tx + def.w && ok; x++)
            if (W.blockedTile(x, y) && W.occ[y * W.w + x]) ok = false;
        if (!ok) continue;
        if (res.some((e) => e.tx >= s.tx - 2 && e.tx <= s.tx + def.w + 1 && e.ty >= s.ty - 2 && e.ty <= s.ty + def.h + 1)) continue;
        // workers must be able to reach it: a free tile next to it that opens onto the rest of the map
        let reach = false;
        for (let x = s.tx - 1; x <= s.tx + def.w && !reach; x++)
          for (const y of [s.ty - 1, s.ty + def.h]) if (!W.blockedTile(x, y) && W.openArea(x, y, 60)) { reach = true; break; }
        if (!reach) continue;
        return s;
      }
    }
    return null;
  }
}

