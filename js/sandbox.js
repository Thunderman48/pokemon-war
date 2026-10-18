// Sandbox mode: a testing playground. Spawn any Pokémon for either side, skip costs and timers,
// control the enemy AI, the game speed and more from the SANDBOX panel.
import { UNITS, FORMS, FORM_KEYS, RESEARCH } from './config.js';

const $ = (id) => document.getElementById(id);

// every form you can spawn, grouped by Pokémon line
function spawnable() {
  const lines = [];
  for (const k of FORM_KEYS) {
    const line = FORMS[k].line;
    if (!UNITS[line]) continue;
    let g = lines.find((x) => x.line === line);
    if (!g) lines.push((g = { line, forms: [] }));
    g.forms.push(k);
  }
  return lines;
}

export class Sandbox {
  constructor(game) {
    this.g = game;
    this.W = game.world;
    this.open = false;
    this.spawn = null; // form to place on the next map tap
    this.owner = 0;
    this.single = false;
    this.opts = { ai: false, god: false, nocd: false, instant: true, money: true, reveal: true, frozen: false };
    this.speed = 1;
    this.W.cheats = { noEnd: true, god: false };
    this.build();
    this.apply();
  }

  build() {
    const box = document.createElement('div');
    box.id = 'sandbox';
    box.hidden = true;
    $('game').appendChild(box);
    this.box = box;
    const btn = document.createElement('button');
    btn.id = 'btn-sandbox';
    btn.className = 'side-btn sb';
    btn.textContent = 'SANDBOX';
    $('side').appendChild(btn);
    btn.addEventListener('click', () => { this.open = !this.open; this.render(); }, { signal: this.g.abort.signal });
    box.addEventListener('click', (e) => this.click(e), { signal: this.g.abort.signal });
    this.render();
  }

  toggles() {
    const t = (k, label) => `<button class="sbt${this.opts[k] ? ' on' : ''}" data-s="opt" data-v="${k}">${label}</button>`;
    return t('ai', 'ENEMY AI') + t('frozen', 'FREEZE ENEMY') + t('god', 'GOD MODE') + t('nocd', 'NO COOLDOWNS') +
      t('instant', 'INSTANT BUILD') + t('money', 'FREE MONEY') + t('reveal', 'NO FOG');
  }

  render() {
    this.box.hidden = !this.open;
    $('btn-sandbox').classList.toggle('on', this.open || !!this.spawn);
    if (!this.open) return;
    const groups = spawnable();
    this.box.innerHTML = `
      <div class="sbhead"><b>SANDBOX</b><button class="sbt" data-s="close">✕</button></div>
      <div class="sbrow">${this.toggles()}</div>
      <div class="sbrow">SPEED ${[0.25, 0.5, 1, 2, 4].map((s) => `<button class="sbt${this.speed === s ? ' on' : ''}" data-s="speed" data-v="${s}">${s}×</button>`).join('')}</div>
      <div class="sbrow">
        <button class="sbt" data-s="research">RESEARCH ALL</button>
        <button class="sbt" data-s="evolve">MAX XP (SELECTED)</button>
        <button class="sbt" data-s="heal">HEAL SELECTED</button>
        <button class="sbt" data-s="kill">KILL SELECTED</button>
        <button class="sbt" data-s="clear">CLEAR ENEMY ARMY</button>
        <button class="sbt" data-s="base">ENEMY BUILDINGS</button>
      </div>
      <div class="sbrow">SPAWN FOR
        <button class="sbt${this.owner === 0 ? ' on blue' : ''}" data-s="owner" data-v="0">YOU</button>
        <button class="sbt${this.owner === 1 ? ' on red' : ''}" data-s="owner" data-v="1">ENEMY</button>
        <button class="sbt${this.single ? ' on' : ''}" data-s="single">${this.single ? 'ONE POKÉMON' : 'FULL SQUAD'}</button>
        <span class="sbhint">${this.spawn ? `Tap the map to place ${FORMS[this.spawn].name} (tap again to keep placing)` : 'Pick a Pokémon, then tap the map'}</span>
      </div>
      <div class="sbmons">${groups.map((g) => `${g.forms.map((f) =>
        `<button class="sbmon${this.spawn === f ? ' on' : ''}" data-s="pick" data-v="${f}" title="${FORMS[f].name}"><img src="assets/units/${f}.png" alt=""><span>${FORMS[f].name}</span></button>`).join('')}`).join('<i class="sbsep"></i>')}</div>`;
  }

  click(e) {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const a = b.dataset.s, v = b.dataset.v;
    const W = this.W, g = this.g;
    switch (a) {
      case 'close': this.open = false; break;
      case 'opt': this.opts[v] = !this.opts[v]; this.apply(); break;
      case 'speed': this.speed = +v; g.speed = this.speed; break;
      case 'owner': this.owner = +v; break;
      case 'single': this.single = !this.single; break;
      case 'pick': this.spawn = this.spawn === v ? null : v; if (this.spawn) { this.open = false; g.select([]); } break;
      case 'research': this.researchAll(); g.toast('Everything researched'); break;
      case 'evolve': for (const u of g.selectedUnits()) this.maxXp(u); break;
      case 'heal': for (const u of g.selectedUnits()) { u.hp = u.maxHp; u.burn = u.poison = null; u.stun = 0; u.sleep = 0; } break;
      case 'kill': for (const u of g.selectedEnts()) if (u.kind !== 'res') W.damage(u, 1e9, 0, -1, { self: true }); break;
      case 'clear': for (const u of W.unitsOf(1)) W.remove(u); W.recount(); break;
      case 'base': this.enemyBase(); break;
    }
    this.render();
  }

  apply() {
    const W = this.W, me = W.players[0];
    W.cheats.god = this.opts.god;
    me.reveal = this.opts.reveal;
    this.g.aiOff = !this.opts.ai;
    if (this.opts.money) { me.b = Math.max(me.b, 99999); me.c = Math.max(me.c, 99999); }
    W.updateFog();
  }

  // runs every frame after the simulation
  tick() {
    const W = this.W, me = W.players[0], o = this.opts;
    if (o.money) { me.b = 99999; me.c = 99999; }
    for (const sq of W.squads.values()) {
      if (o.nocd && sq.owner === 0) { sq.cds = {}; if (!W.squadUnits(sq).some((m) => m.mega)) sq.megaCd = 0; }
    }
    if (o.frozen) for (const u of W.unitsOf(1)) { u.order = { type: 'idle' }; u.scanT = 1; u.path = null; }
    if (o.instant) {
      for (const b of W.buildingsOf(0)) {
        if (!b.built) W.completeBuilding(b);
        if (b.queue[0]) b.queue[0].t = 1e6;
      }
    }
  }

  // tap on the map while a Pokémon is picked: spawn it there
  place(w) {
    const W = this.W, f = this.spawn, line = FORMS[f].line, owner = this.owner;
    const flies = UNITS[line].flying || FORMS[f].flying;
    if (!flies && W.blockedAt(w.x, w.y)) { this.g.toast("Can't place it there", 'warn'); return; }
    let made;
    if (UNITS[line].worker) made = [W.addUnit(line, owner, w.x, w.y)];
    else {
      const sq = W.addSquad(line, owner, w.x, w.y);
      if (this.single && sq.size > 1) {
        // a one-Pokémon squad, so skills and Mega still work
        for (const m of W.squadUnits(sq).slice(1)) W.remove(m);
        sq.size = 1;
      }
      sq.form = f;
      if (owner === 1) sq.auto = true;
      made = W.squadUnits(sq);
    }
    for (const u of made) this.setForm(u, f);
    W.recount();
    W.buildHash();
    W.updateFog();
    this.g.renderer.ping(w.x, w.y, owner ? '#ff5050' : '#7dff7d', performance.now());
  }

  setForm(u, f) {
    if (u.form === f) return;
    if (FORMS[f].isMega) {
      // spawn already Mega Evolved (it reverts when the timer runs out)
      const megas = (x) => (typeof x === 'string' ? [x] : Object.values(x || {}));
      const base = FORM_KEYS.find((k) => FORMS[k].line === FORMS[f].line && megas(FORMS[k].mega).includes(f));
      u.mega = { phase: 'on', t: 60, prev: base || u.form, to: f, tick: 0 };
    }
    u.form = f;
    u.maxHp = u.hp = this.W.stats(u).maxHp;
    u.radius = UNITS[u.type].radius + FORMS[f].stage * 1.5;
  }

  maxXp(u) {
    const W = this.W, sq = W.squadOf(u);
    if (sq) { sq.xp = 99999; for (const m of W.squadUnits(sq)) m.xp = sq.xp; W.tryEvolveSquad(sq); }
    else { u.xp = 99999; W.tryEvolve(u); }
  }

  researchAll() {
    const W = this.W, p = W.players[0];
    for (const k of Object.keys(RESEARCH)) p.research[k] = RESEARCH[k].levels || 1;
    for (const u of W.unitsOf(0)) {
      const mx = W.stats(u).maxHp;
      if (mx !== u.maxHp) { u.hp *= mx / u.maxHp; u.maxHp = mx; }
    }
    for (const sq of [...W.squads.values()]) if (sq.owner === 0) W.tryEvolveSquad(sq);
    W.recount();
  }

  // give the enemy a few buildings to test sieges and towers on
  enemyBase() {
    const W = this.W, c = W.buildingsOf(1).find((b) => b.type === 'center');
    if (!c) return;
    for (const type of ['gym', 'tower', 'tower', 'lab', 'mart']) {
      let done = false;
      for (let r = 4; r < 12 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = c.tx + dx, ty = c.ty + dy;
        if (W.canPlace(type, tx, ty, -1)) { W.addBuilding(type, 1, tx, ty, true); done = true; }
      }
    }
    W.recount();
    this.g.toast('Built an enemy base to attack');
  }
}
