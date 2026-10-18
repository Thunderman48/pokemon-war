// Game controller: main loop, touch/mouse input, selection, HUD panel, networking glue.
import { TICK, TILE, UNITS, FORMS, BUILDINGS, RESEARCH, SKILLS, EVO_XP, TYPE_COLORS, researchCost, researchTime, squadSize, squadPop, skillResearch, researchLines } from './config.js';
import { World, isFlying } from './world.js';
import { AI } from './ai.js';
import { Renderer } from './render.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor({ mode, difficulty = 'normal', seed, conn, assets, onEnd }) {
    this.mode = mode; // 'ai' | 'host' | 'guest'
    this.pid = mode === 'guest' ? 1 : 0;
    this.conn = conn;
    this.A = assets;
    this.onEnd = onEnd;
    this.abort = new AbortController();
    this.world = new World({
      seed,
      players: [{ name: mode === 'guest' ? 'Host' : 'You' }, { name: mode === 'ai' ? 'CPU' : mode === 'host' ? 'Guest' : 'You' }],
      sim: mode !== 'guest',
    });
    if (mode === 'ai') this.ai = new AI(this.world, 1, difficulty);
    this.selection = new Set();
    this.selSquads = new Set();
    this.placing = null;
    this.forceMove = false;
    this.buildMenu = false;
    this.boxMode = false;
    this.casting = null;
    this.castPos = null;
    this.page = 0;
    this.paused = false;
    this.over = false;
    this.ptrs = new Map();
    this.gesture = null;
    this.box = null;
    this.keys = new Set();
    this.netFx = [];
    this.snapAt = 0; this.snapGap = 100;
    this.acc = 0;
    this.lastTap = { t: 0, id: 0 };
    this.idleIdx = 0;
    this.panelSig = '';
    this.uiT = 0;
    this.gotSnap = false;

    $('game').hidden = false;
    this.canvas = $('view');
    this.renderer = new Renderer(this.canvas, $('minimap'), this.world, assets, this.pid);
    this.measure();
    this.renderer.cam.z = this.renderer.defaultZoom();
    const s = this.world.map.starts[this.pid];
    this.renderer.centerOn((s.tx + 1.5) * TILE, (s.ty + 2) * TILE);
    this.bind();
    if (conn) this.bindNet();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ lifecycle
  destroy() {
    this.dead = true;
    this.abort.abort();
    if (this.conn) this.conn.close();
    $('game').hidden = true;
    $('place-bar').hidden = true;
  }

  measure() {
    const top = $('topbar').offsetHeight || 36;
    const bottom = $('panel').offsetHeight || 120;
    this.renderer.insets = { top, bottom };
    this.renderer.resize();
  }

  issue(cmd) {
    if (this.mode === 'guest') this.conn.send({ t: 'cmd', cmd });
    else this.world.issue(this.pid, cmd);
  }

  bindNet() {
    const c = this.conn;
    if (this.mode === 'host') {
      c.onMessage((m) => { if (m && m.t === 'cmd') this.world.issue(1, m.cmd); });
    } else {
      c.onMessage((m) => { if (m && m.t === 's') this.onSnap(m); });
    }
    c.onClose(() => {
      if (this.over || this.dead) return;
      this.toast(this.mode === 'host' ? 'Opponent disconnected' : 'Lost connection to host', 'alert');
      this.finish(this.mode === 'host' ? 'disconnect-win' : 'disconnect');
    });
  }

  onSnap(s) {
    const now = performance.now();
    if (this.snapAt) this.snapGap = this.snapGap * 0.8 + Math.min(300, now - this.snapAt) * 0.2;
    this.snapAt = now;
    this.world.applySnapshot(s, this.pid);
    if (s.fx && s.fx.length) { this.renderer.addFx(s.fx, now); this.fxSounds(s.fx); }
    if (s.n) this.handleNotes(s.n);
    this.gotSnap = true;
  }

  // ------------------------------------------------------------------ main loop
  frame() {
    if (this.dead) return;
    requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const W = this.world;
    let alpha = 1;
    if (W.sim) {
      if (!this.paused) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= TICK && steps++ < 5) {
          if (this.ai) this.ai.update(TICK);
          W.update(TICK);
          this.acc -= TICK;
          if (this.mode === 'host' && W.tick % 2 === 0) this.sendSnap();
        }
        if (steps >= 5) this.acc = 0;
      }
      alpha = Math.min(1, this.acc / TICK);
      if (W.fx.length) {
        const fx = W.fx.splice(0);
        this.renderer.addFx(fx, now);
        this.fxSounds(fx);
        if (this.mode === 'host') this.netFx.push(...fx);
      }
      if (W.notes[this.pid].length) this.handleNotes(W.notes[this.pid].splice(0));
    } else {
      alpha = Math.min(1, (now - this.snapAt) / this.snapGap);
    }
    // drop dead entities from selection; reinforcements join their selected squad
    for (const id of this.selection) if (!W.ents.has(id)) this.selection.delete(id);
    if (this.selSquads.size) {
      for (const sid of this.selSquads) {
        const sq = W.squads.get(sid);
        if (!sq) { this.selSquads.delete(sid); continue; }
        for (const id of sq.members) this.selection.add(id);
      }
    }
    if (this.placing && !this.selectedWorkers().length) this.cancelPlacement();
    this.keyPan(dt);
    if (this.placing) this.placing.ok = W.canPlace(this.placing.type, this.placing.tx, this.placing.ty, this.pid);
    let target = null;
    if (this.casting && this.castPos) {
      const S = SKILLS[this.casting];
      target = { x: this.castPos.x, y: this.castPos.y, r: (S.eff.radius || 1) * TILE, color: S.target === 'ally' ? '#6eff8c' : TYPE_COLORS[S.type] || '#fff36b' };
    }
    this.renderer.draw(alpha, now, { selection: this.selection, ghost: this.placing, box: this.box, target });
    if (now - this.uiT > 120) { this.uiT = now; this.updateHud(); }
    if (W.winner >= 0 && !this.over) this.finish(W.winner === this.pid ? 'win' : 'lose');
  }

  sendSnap() {
    const s = this.world.snapshot();
    s.t = 's';
    s.fx = this.netFx.splice(0);
    s.n = this.world.notes[1].splice(0);
    this.conn.send(s);
  }

  finish(result) {
    this.over = true;
    const win = result === 'win' || result === 'disconnect-win';
    if (this.mode === 'host') this.sendSnap();
    sfx(win ? 'win' : 'lose');
    const p = this.world.players[this.pid];
    const t = Math.floor(this.world.time);
    setTimeout(() => {
      if (this.dead) return;
      $('over-title').textContent = result === 'disconnect' ? 'DISCONNECTED' : win ? 'VICTORY!' : 'DEFEAT';
      $('over-stats').innerHTML =
        `Time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}<br>` +
        `Pokémon trained ${p.stats.trained}<br>Enemies defeated ${p.stats.killed}<br>` +
        `Losses ${p.stats.lost}<br>Resources gathered ${p.stats.gathered}`;
      $('s-over').hidden = false;
    }, 600);
  }

  handleNotes(list) {
    for (const n of list) {
      this.toast(n.text, n.kind);
      if (n.kind === 'alert') { sfx('alert'); if (n.x !== undefined) this.renderer.alert(n.x, n.y, performance.now()); }
      else if (n.kind === 'evo') sfx('evolve');
      else if (n.kind === 'done') sfx('build');
      else if (n.kind === 'warn') sfx('error');
    }
  }

  fxSounds(list) {
    const r = this.renderer;
    for (const f of list) {
      const x = f.x ?? f.x1, y = f.y ?? f.y1;
      const s = r.toScreen(x, y);
      if (s.x < 0 || s.y < 0 || s.x > r.vw || s.y > r.vh) continue;
      if (!this.world.vis[this.pid][Math.floor(y / TILE) * this.world.w + Math.floor(x / TILE)]) continue;
      if (f.k === 'p') sfx(f.s === 'breath' || f.s === 'megabreath' ? 'breath' : 'shot');
      else if (f.k === 'boom') { sfx('boom'); r.shake(performance.now(), f.m ? 5 : 3.5); }
      else if (f.k === 'ascent') sfx('ascent');
      else if (f.k === 'dive') sfx('dive');
      else if (f.k === 'quake') { sfx('quake'); r.shake(performance.now(), f.m ? 11 : 9); }
      else if (f.k === 'hit') sfx('hit');
      else if (f.k === 'die') sfx('die');
      else if (f.k === 'cast') sfx('skill');
      else if (f.k === 'sk_hit') { sfx(f.s === 'thunder' ? 'zap' : 'boom'); if (f.s === 'thunder' || f.s === 'rockslide') r.shake(performance.now(), 2.5); }
      else if (f.k === 'beam' || f.k === 'cone') sfx('beam');
      else if (f.k === 'trail') sfx('whoosh');
    }
  }

  toast(text, kind = 'info') {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 3000);
  }

  // ------------------------------------------------------------------ selection helpers
  selectedEnts() { return [...this.selection].map((id) => this.world.ents.get(id)).filter(Boolean); }
  selectedUnits() { return this.selectedEnts().filter((e) => e.kind === 'unit' && e.owner === this.pid); }
  selectedWorkers() { return this.selectedUnits().filter((u) => UNITS[u.type].worker); }
  selectedBuilding() { return this.selectedEnts().find((e) => e.kind === 'building' && e.owner === this.pid); }
  // selected units grouped by squad (lone units are their own group)
  groups(units) {
    const m = new Map();
    for (const u of units) {
      const k = u.sq || 'u' + u.id;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(u);
    }
    return [...m.values()];
  }

  // Selecting any member of a squad selects the whole squad.
  select(ids) {
    const W = this.world;
    this.selection = new Set(ids);
    this.selSquads = new Set();
    for (const id of ids) {
      const sq = W.squadOf(W.ents.get(id));
      if (!sq || sq.owner !== this.pid) continue;
      this.selSquads.add(sq.id);
      for (const m of sq.members) this.selection.add(m);
    }
    this.buildMenu = false;
    this.forceMove = false;
    this.casting = null;
    this.page = 0;
    this.labCat = null;
    this.cancelPlacement();
    if (ids.length) sfx('select');
  }

  // ------------------------------------------------------------------ input
  bind() {
    const sig = { signal: this.abort.signal };
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => this.onDown(e), sig);
    cv.addEventListener('pointermove', (e) => this.onMove(e), sig);
    cv.addEventListener('pointerup', (e) => this.onUp(e, true), sig);
    cv.addEventListener('pointercancel', (e) => this.onUp(e, false), sig);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.renderer;
      r.zoomAt(e.clientX, e.clientY, r.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, { passive: false, signal: this.abort.signal });
    cv.addEventListener('contextmenu', (e) => e.preventDefault(), sig);
    window.addEventListener('resize', () => setTimeout(() => this.measure(), 50), sig);
    window.addEventListener('keydown', (e) => this.onKey(e, true), sig);
    window.addEventListener('keyup', (e) => this.onKey(e, false), sig);

    const mm = $('minimap');
    const mmMove = (e) => {
      const r = mm.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      this.renderer.centerOn(fx * this.world.w * TILE, fy * this.world.h * TILE);
    };
    let mmDown = false;
    mm.addEventListener('pointerdown', (e) => { mmDown = true; mm.setPointerCapture(e.pointerId); mmMove(e); unlockAudio(); }, sig);
    mm.addEventListener('pointermove', (e) => { if (mmDown) mmMove(e); }, sig);
    mm.addEventListener('pointerup', () => { mmDown = false; }, sig);
    mm.addEventListener('pointercancel', () => { mmDown = false; }, sig);

    $('btn-army').addEventListener('click', () => this.selectArmy(), sig);
    $('btn-idle').addEventListener('click', () => this.selectIdle(), sig);
    $('btn-base').addEventListener('click', () => this.goBase(), sig);
    $('btn-box').addEventListener('click', () => { this.boxMode = !this.boxMode; $('btn-box').classList.toggle('on', this.boxMode); }, sig);
    $('btn-box').classList.remove('on');
    $('place-ok').addEventListener('click', () => this.confirmPlacement(), sig);
    $('place-cancel').addEventListener('click', () => this.cancelPlacement(), sig);
    $('cmds').addEventListener('click', (e) => this.onPanelClick(e), sig);
    $('info').addEventListener('click', (e) => this.onPanelClick(e), sig);
  }

  onKey(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (!down) return;
    if (k === 'escape') {
      if (this.casting) this.casting = null;
      else if (this.placing) this.cancelPlacement();
      else if (this.forceMove || this.buildMenu) { this.forceMove = false; this.buildMenu = false; }
      else this.select([]);
    }
  }

  keyPan(dt) {
    if (!this.keys.size) return;
    const r = this.renderer, sp = 600 * dt / r.cam.z;
    if (this.keys.has('a') || this.keys.has('arrowleft')) r.cam.x -= sp;
    if (this.keys.has('d') || this.keys.has('arrowright')) r.cam.x += sp;
    if (this.keys.has('w') || this.keys.has('arrowup')) r.cam.y -= sp;
    if (this.keys.has('s') || this.keys.has('arrowdown')) r.cam.y += sp;
    r.clampCam();
  }

  onDown(e) {
    unlockAudio();
    this.canvas.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType, button: e.button });
    clearTimeout(this.longTimer);
    const r = this.renderer;
    if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.gesture = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: r.cam.z, w0: r.toWorld(mid.x, mid.y) };
      this.box = null;
      return;
    }
    if (this.ptrs.size > 2) return;
    if (e.pointerType === 'mouse' && e.button === 2) {
      this.gesture = { mode: 'none' };
      this.command(e.clientX, e.clientY);
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 1) { this.gesture = { mode: 'pan' }; return; }
    // start dragging the building ghost?
    if (this.placing) {
      const w = r.toWorld(e.clientX, e.clientY);
      const d = BUILDINGS[this.placing.type];
      if (w.x >= this.placing.tx * TILE - 8 && w.x <= (this.placing.tx + d.w) * TILE + 8 &&
        w.y >= this.placing.ty * TILE - 8 && w.y <= (this.placing.ty + d.h) * TILE + 8 && e.pointerType !== 'mouse') {
        this.gesture = { mode: 'ghost', ox: w.x - this.placing.tx * TILE, oy: w.y - this.placing.ty * TILE };
        return;
      }
    }
    this.gesture = { mode: 'pending' };
    if (e.pointerType !== 'mouse') {
      this.longTimer = setTimeout(() => {
        const p = this.ptrs.get(e.pointerId);
        if (this.gesture && this.gesture.mode === 'pending' && p && !this.placing) {
          this.gesture.mode = 'box';
          this.box = { x0: p.sx, y0: p.sy, x1: p.x, y1: p.y };
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }, 450);
    }
  }

  onMove(e) {
    const p = this.ptrs.get(e.pointerId);
    const r = this.renderer;
    if (e.pointerType === 'mouse') this.castPos = r.toWorld(e.clientX, e.clientY);
    if (!p) {
      if (this.placing && e.pointerType === 'mouse') this.setGhost(r.toWorld(e.clientX, e.clientY));
      return;
    }
    const px = p.x, py = p.y;
    p.x = e.clientX; p.y = e.clientY;
    const g = this.gesture;
    if (!g) return;
    if (g.mode === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      r.cam.z = Math.max(r.minZoom(), Math.min(5, g.z0 * d / g.d0));
      r.cam.x = g.w0.x - mid.x / r.cam.z;
      r.cam.y = g.w0.y - mid.y / r.cam.z;
      r.clampCam();
      return;
    }
    if (g.mode === 'pending' && Math.hypot(p.x - p.sx, p.y - p.sy) > 9) {
      clearTimeout(this.longTimer);
      if ((p.type === 'mouse' && p.button === 0 && !this.placing) || (this.boxMode && !this.placing)) {
        g.mode = 'box';
        this.box = { x0: p.sx, y0: p.sy, x1: p.x, y1: p.y };
      } else g.mode = 'pan';
    }
    if (g.mode === 'pan') {
      r.cam.x -= (p.x - px) / r.cam.z;
      r.cam.y -= (p.y - py) / r.cam.z;
      r.clampCam();
    } else if (g.mode === 'box') {
      this.box.x1 = p.x; this.box.y1 = p.y;
    } else if (g.mode === 'ghost') {
      const w = r.toWorld(p.x, p.y);
      this.setGhost({ x: w.x - g.ox + BUILDINGS[this.placing.type].w * TILE / 2, y: w.y - g.oy + BUILDINGS[this.placing.type].h * TILE / 2 });
    }
    if (this.placing && p.type === 'mouse') this.setGhost(r.toWorld(e.clientX, e.clientY));
  }

  onUp(e, real) {
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    clearTimeout(this.longTimer);
    const g = this.gesture;
    if (!p || !g) { if (!this.ptrs.size) this.gesture = null; return; }
    if (g.mode === 'pinch') {
      this.gesture = this.ptrs.size ? { mode: 'none' } : null;
      return;
    }
    if (real && g.mode === 'pending') this.tap(p.x, p.y, p.type);
    if (g.mode === 'box') {
      if (real) this.boxSelect(this.box);
      this.box = null;
      if (this.boxMode) { this.boxMode = false; $('btn-box').classList.remove('on'); }
    }
    if (!this.ptrs.size) this.gesture = null;
  }

  pick(w, ptype) {
    const W = this.world, z = this.renderer.cam.z;
    const rad = (ptype === 'mouse' ? 4 : 14) / z + 2;
    const haveUnits = this.selectedUnits().length > 0;
    let best = null, bs = Infinity;
    for (const e of W.ents.values()) {
      if (!W.isVisible(this.pid, e)) continue;
      let d;
      if (e.kind === 'unit') {
        const img = this.renderer.spriteFor(e);
        const top = this.renderer.unitTop(e, performance.now()), bottom = e.y + 4 - this.renderer.lift(e, performance.now());
        const hw = img ? (img.width * this.renderer.unitScale(e)) / 2 - 2 : 6;
        // distance to the sprite's box (0 when tapping on it)
        const dx = Math.max(e.x - hw - w.x, 0, w.x - (e.x + hw)), dy = Math.max(top - w.y, 0, w.y - bottom);
        d = Math.hypot(dx, dy);
      } else if (e.kind === 'building') {
        const img = this.renderer.spriteFor(e);
        const x0 = e.tx * TILE, x1 = x0 + e.w * TILE, y1 = (e.ty + e.h) * TILE, y0 = y1 - (img ? img.height : e.h * TILE);
        const dx = Math.max(x0 - w.x, 0, w.x - x1), dy = Math.max(y0 - w.y, 0, w.y - y1);
        d = Math.hypot(dx, dy);
      } else {
        d = Math.max(0, Math.hypot(e.x - w.x, e.y - w.y) - 7);
      }
      if (d > rad) continue;
      const own = e.owner === this.pid;
      let pen;
      if (haveUnits) pen = e.kind === 'res' ? 6 : !own ? (e.kind === 'unit' ? 0 : 3) : e.kind === 'building' ? 8 : 5;
      else pen = own ? (e.kind === 'unit' ? 0 : 3) : e.kind === 'res' ? 8 : 5;
      const s = d + pen;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  tap(sx, sy, ptype) {
    const r = this.renderer, now = performance.now();
    const w = r.toWorld(sx, sy);
    if (this.placing) {
      this.setGhost(w);
      if (ptype === 'mouse') this.confirmPlacement();
      return;
    }
    const units = this.selectedUnits();
    if (this.casting && units.length) {
      this.issue({ c: 'cast', ids: units.map((u) => u.id), key: this.casting, x: w.x, y: w.y });
      r.ping(w.x, w.y, '#fff36b', now); sfx('attack');
      this.casting = null;
      return;
    }
    const ent = this.pick(w, ptype);
    if (this.forceMove && units.length) {
      this.issue({ c: 'move', ids: units.map((u) => u.id), x: w.x, y: w.y, attack: false });
      r.ping(w.x, w.y, '#ffffff', now); sfx('order');
      this.forceMove = false;
      return;
    }
    if (units.length) {
      if (ent) {
        const ids = units.map((u) => u.id);
        if (ent.kind !== 'res' && ent.owner !== this.pid) {
          this.issue({ c: 'target', ids, target: ent.id });
          r.ping(ent.x, ent.y, '#ff5050', now); sfx('attack');
          return;
        }
        if (ent.kind === 'res') {
          if (units.some((u) => UNITS[u.type].worker)) {
            this.issue({ c: 'target', ids, target: ent.id });
            r.ping(ent.x, ent.y, '#ffd84d', now); sfx('order');
          } else {
            this.issue({ c: 'move', ids, x: w.x, y: w.y, attack: true });
            r.ping(w.x, w.y, '#7dff7d', now); sfx('order');
          }
          return;
        }
        if (ent.kind === 'building') {
          const workers = units.filter((u) => UNITS[u.type].worker);
          if (workers.length && (!ent.built || (BUILDINGS[ent.type].dropoff && workers.some((u) => u.carry.amt)))) {
            this.issue({ c: 'target', ids: workers.map((u) => u.id), target: ent.id });
            r.ping(ent.x, ent.y, '#ffd84d', now); sfx('order');
            return;
          }
        }
        this.selectEnt(ent, now);
        return;
      }
      this.issue({ c: 'move', ids: units.map((u) => u.id), x: w.x, y: w.y, attack: true });
      r.ping(w.x, w.y, '#7dff7d', now); sfx('order');
      return;
    }
    const b = this.selectedBuilding();
    if (b && b.built && BUILDINGS[b.type].trains && (!ent || ent.kind === 'res')) {
      this.issue({ c: 'rally', id: b.id, x: w.x, y: w.y, target: ent ? ent.id : 0 });
      r.ping(w.x, w.y, '#ffffff', now); sfx('order');
      this.toast('Rally point set');
      return;
    }
    if (ent) this.selectEnt(ent, now);
    else if (this.selection.size) this.select([]);
  }

  // mouse right-click: always a command
  command(sx, sy) {
    const units = this.selectedUnits();
    if (this.casting && units.length) { this.tap(sx, sy, 'mouse'); return; }
    if (!units.length) {
      const b = this.selectedBuilding();
      if (b && BUILDINGS[b.type].trains) {
        const w = this.renderer.toWorld(sx, sy);
        const ent = this.pick(w, 'mouse');
        this.issue({ c: 'rally', id: b.id, x: w.x, y: w.y, target: ent && ent.kind === 'res' ? ent.id : 0 });
        this.renderer.ping(w.x, w.y, '#ffffff', performance.now());
      }
      return;
    }
    const w = this.renderer.toWorld(sx, sy);
    const ent = this.pick(w, 'mouse');
    if (ent && ent.owner === this.pid && ent.kind === 'unit') {
      this.issue({ c: 'move', ids: units.map((u) => u.id), x: w.x, y: w.y, attack: false });
      this.renderer.ping(w.x, w.y, '#7dff7d', performance.now()); sfx('order');
      return;
    }
    if (ent && ent.kind === 'building' && ent.owner === this.pid && !this.selectedWorkers().length) {
      this.issue({ c: 'move', ids: units.map((u) => u.id), x: w.x, y: w.y, attack: false });
      sfx('order');
      return;
    }
    if (ent) {
      this.issue({ c: 'target', ids: units.map((u) => u.id), target: ent.id });
      this.renderer.ping(ent.x, ent.y, ent.kind === 'res' || ent.owner === this.pid ? '#ffd84d' : '#ff5050', performance.now());
      sfx(ent.kind !== 'res' && ent.owner !== this.pid ? 'attack' : 'order');
      return;
    }
    this.issue({ c: 'move', ids: units.map((u) => u.id), x: w.x, y: w.y, attack: !this.forceMove });
    this.renderer.ping(w.x, w.y, '#7dff7d', performance.now()); sfx('order');
    this.forceMove = false;
  }

  selectEnt(ent, now) {
    if (ent.kind === 'unit' && ent.owner === this.pid && this.lastTap.type === ent.type && now - this.lastTap.t < 380) {
      // double tap: all of this kind on screen
      const r = this.renderer;
      const ids = this.world.unitsOf(this.pid).filter((u) => {
        if (u.type !== ent.type) return false;
        const s = r.toScreen(u.x, u.y);
        return s.x >= 0 && s.y >= 0 && s.x <= r.vw && s.y <= r.vh;
      }).map((u) => u.id);
      this.select(ids);
      this.lastTap = { t: 0 };
      return;
    }
    this.lastTap = { t: now, type: ent.type };
    this.select([ent.id]);
  }

  boxSelect(b) {
    if (!b || Math.abs(b.x1 - b.x0) < 8 || Math.abs(b.y1 - b.y0) < 8) return;
    const r = this.renderer;
    const a = r.toWorld(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1));
    const c = r.toWorld(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
    let units = this.world.unitsOf(this.pid).filter((u) => u.x >= a.x - 4 && u.x <= c.x + 4 && u.y >= a.y - 4 && u.y <= c.y + 8);
    const fighters = units.filter((u) => !UNITS[u.type].worker);
    if (fighters.length) units = fighters;
    this.select(units.map((u) => u.id));
  }

  selectArmy() {
    unlockAudio();
    const army = this.world.unitsOf(this.pid).filter((u) => !UNITS[u.type].worker);
    if (!army.length) { this.toast('No battle Pokémon yet — build a Gym', 'warn'); return; }
    const now = performance.now();
    if (this.lastArmy && now - this.lastArmy < 400) {
      const cx = army.reduce((s, u) => s + u.x, 0) / army.length, cy = army.reduce((s, u) => s + u.y, 0) / army.length;
      this.renderer.centerOn(cx, cy);
    }
    this.lastArmy = now;
    this.select(army.map((u) => u.id));
  }

  idleWorkers() {
    return this.world.unitsOf(this.pid).filter((u) => UNITS[u.type].worker && u.order.type === 'idle');
  }

  selectIdle() {
    unlockAudio();
    const idle = this.idleWorkers();
    if (!idle.length) { this.toast('No idle workers'); return; }
    const u = idle[this.idleIdx++ % idle.length];
    this.select([u.id]);
    this.renderer.centerOn(u.x, u.y);
  }

  goBase() {
    unlockAudio();
    const c = this.world.buildingsOf(this.pid).find((b) => b.type === 'center') || this.world.buildingsOf(this.pid)[0];
    if (!c) return;
    this.renderer.centerOn(c.x, c.y);
    this.select([c.id]);
  }

  // ------------------------------------------------------------------ building placement
  startPlacement(type) {
    const r = this.renderer;
    const def = BUILDINGS[type];
    const w = r.toWorld(r.vw / 2, r.insets.top + r.viewH() / 2);
    this.placing = { type, tx: 0, ty: 0, ok: false };
    this.setGhost(w);
    $('place-bar').hidden = false;
    $('place-hint').textContent = `${def.name}: tap or drag to position`;
  }
  setGhost(w) {
    if (!this.placing) return;
    const d = BUILDINGS[this.placing.type];
    this.placing.tx = Math.round(w.x / TILE - d.w / 2);
    this.placing.ty = Math.round(w.y / TILE - d.h / 2);
  }
  confirmPlacement() {
    const p = this.placing;
    if (!p) return;
    if (!this.world.canPlace(p.type, p.tx, p.ty, this.pid)) { this.toast("Can't build there", 'warn'); sfx('error'); return; }
    const workers = this.selectedWorkers();
    // every selected worker helps build
    this.issue({ c: 'build', ids: workers.map((u) => u.id), type: p.type, tx: p.tx, ty: p.ty });
    sfx('order');
    this.cancelPlacement();
    this.buildMenu = false;
  }
  cancelPlacement() {
    this.placing = null;
    $('place-bar').hidden = true;
  }

  // ------------------------------------------------------------------ HUD
  updateHud() {
    const W = this.world, p = W.players[this.pid];
    const setText = (id, v) => { const el = $(id); if (el.textContent !== String(v)) el.textContent = v; };
    setText('r-b', Math.floor(p.b));
    setText('r-c', Math.floor(p.c));
    setText('r-p', `${p.pop}/${p.cap}`);
    const t = Math.floor(W.time);
    setText('clock', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    const idle = this.idleWorkers().length;
    setText('idle-count', idle ? idle : '');
    this.renderPanel();
  }

  costHtml(cost) {
    return `<span class="cost">${cost.b ? cost.b : ''}${cost.c ? ` <span class="c">${cost.c}</span>` : ''}</span>`;
  }

  lbl(text) {
    const plain = text.replace(/<[^>]+>/g, '');
    return `<span class="lbl${plain.length > 10 ? ' sm xs' : plain.length > 6 ? ' sm' : ''}">${text}</span>`;
  }

  researchIcon(key) {
    const ic = RESEARCH[key].icon;
    if (!ic) return '';
    return `<img src="${ic.startsWith('i:') ? `assets/icons/${ic.slice(2)}.png` : `assets/units/${ic}.png`}" alt="">`;
  }

  // Fit buttons into the 8 command slots, adding a MORE button to flip pages.
  paginate(items, tail) {
    const cap = 8;
    if (items.length + tail.length <= cap) return items.join('') + tail.join('');
    const per = cap - tail.length - 1;
    const pages = Math.ceil(items.length / per);
    const page = this.page % pages;
    return items.slice(page * per, page * per + per).join('') +
      `<button class="cmd" data-a="more"><span class="lbl">MORE<br>${page + 1}/${pages}</span></button>` + tail.join('');
  }

  renderPanel() {
    const W = this.world, pid = this.pid, P = W.players[pid];
    const ents = this.selectedEnts();
    const units = ents.filter((e) => e.kind === 'unit' && e.owner === pid);
    const b = ents.length === 1 && ents[0].kind === 'building' ? ents[0] : null;
    const afford = (c) => W.canAfford(pid, c);
    const X = '<button class="cmd" data-a="desel"><span class="lbl x">✕</span></button>';
    let sig, info = '', cmds = '';

    if (units.length) {
      const workers = units.some((u) => UNITS[u.type].worker);
      const u = units[0];
      const abil = [...new Set(units.filter((x) => x.sq).flatMap((x) => W.activeSkills(x)))];
      const sqs = [...new Set(units.map((x) => x.sq).filter(Boolean))].map((id) => W.squads.get(id)).filter(Boolean);
      const autoOn = sqs.length && sqs.every((q) => q.auto);
      const groups = this.groups(units);
      const one = groups.length === 1;
      const sq = one ? W.squadOf(u) : null;
      const evoChoices = one && u.evoReady ? (FORMS[u.form].next || []).filter((n) => P.research[n.r]) : [];
      sig = `U|${units.map((x) => x.id + ':' + x.form).join(',')}|${this.buildMenu}|${this.forceMove}|${this.casting}|${this.page}|` +
        `${abil.map((k) => k + P.research[skillResearch(k)]).join(',')}|${autoOn}|${evoChoices.map((n) => n.to).join(',')}|` +
        `${workers && this.buildMenu ? Object.keys(BUILDINGS).map((k) => +afford(BUILDINGS[k].cost) + '' + +W.reqMet(pid, BUILDINGS[k].req)).join('') : ''}|` +
        `${one ? JSON.stringify(P.research) : ''}|${groups.length}`;
      if (sig === this.panelSig) return this.updateDynamic(ents);
      if (one) {
        const def = UNITS[u.type], f = FORMS[u.form];
        const st = W.stats(u);
        const nexts = f.next || [];
        let evoTxt = '';
        if (!nexts.length) evoTxt = f.stage ? 'Fully evolved' : '';
        else if (u.evoReady) evoTxt = 'Ready! Choose an evolution →';
        else {
          const done = nexts.filter((n) => P.research[n.r]);
          evoTxt = `Evolves at ${EVO_XP[f.stage + 1]} XP` + (done.length ? '' : ` · needs ${nexts.map((n) => RESEARCH[n.r].name).join(' / ')}`);
        }
        info = `<div class="portrait"><img src="assets/units/${u.form}.png" alt="">${sq ? '<b class="pips" data-bind="pips"></b>' : ''}</div>
          <div class="details"><div class="name">${f.name}${sq && sq.size > 1 ? ' SQUAD' : ''}</div>
          <div class="sub"><span class="type" style="background:${TYPE_COLORS[f.type]}">${f.type.toUpperCase()}</span><span data-bind="hptext"></span></div>
          <div class="meter"><i data-bind="hp"></i></div>
          ${nexts.length ? `<div class="meter xp"><i data-bind="xp"></i></div>` : ''}
          ${evoTxt ? `<div class="sub">${evoTxt}</div>` : `<div class="desc">${def.desc}</div>`}
          <div class="sub">ATK ${Math.round(st.dmg)} · RNG ${(st.range / TILE).toFixed(1)}${isFlying(u) ? ' · FLYING' : ''} · <span data-bind="status"></span></div>
          ${this.skillRow(u)}</div>`;
      } else {
        info = `<div class="multi">${groups.slice(0, 24).map((g) => `<button class="mini" data-a="only" data-v="${g[0].id}"><img src="assets/units/${g[0].form}.png" alt="">${g[0].sq ? `<i class="cnt" data-sqn="${g[0].sq}"></i>` : ''}<b data-hpid="${g[0].sq ? 's' + g[0].sq : g[0].id}"></b></button>`).join('')}</div>`;
      }
      const items = [];
      if (this.buildMenu && workers) {
        for (const k of Object.keys(BUILDINGS)) {
          const d = BUILDINGS[k];
          const locked = !W.reqMet(pid, d.req);
          items.push(`<button class="cmd${!afford(d.cost) ? ' off' : ''}${locked ? ' locked' : ''}" data-a="place" data-v="${k}"><img src="assets/buildings/${k}.png" alt=""><span class="lbl">${d.short}</span>${this.costHtml(d.cost)}</button>`);
        }
        cmds = this.paginate(items, ['<button class="cmd" data-a="back"><span class="lbl">BACK</span></button>']);
      } else {
        for (const n of evoChoices)
          items.push(`<button class="cmd active" data-a="evolve" data-v="${n.to}"><img src="assets/units/${n.to}.png" alt="">${this.lbl(FORMS[n.to].name.toUpperCase())}</button>`);
        for (const k of abil) {
          const S = SKILLS[k];
          const known = P.research[skillResearch(k)];
          items.push(`<button class="cmd${known ? '' : ' locked off'}${this.casting === k ? ' active' : ''}" data-a="cast" data-v="${k}"><img src="assets/icons/${k}.png" alt="">${this.lbl(S.name.toUpperCase())}<span class="cost" data-bind="cd-${k}"></span></button>`);
        }
        if (abil.length) items.push(`<button class="cmd auto${autoOn ? ' active' : ''}" data-a="auto"><span class="lbl">AUTO<br>${autoOn ? 'ON' : 'OFF'}</span></button>`);
        items.push('<button class="cmd" data-a="stop"><span class="lbl">STOP</span></button>');
        items.push(`<button class="cmd${this.forceMove ? ' active' : ''}" data-a="force"><span class="lbl">MOVE<br>ONLY</span></button>`);
        if (workers) items.push('<button class="cmd" data-a="build"><img src="assets/buildings/center.png" alt=""><span class="lbl">BUILD</span></button>');
        cmds = this.paginate(items, [X]);
      }
    } else if (b) {
      const def = BUILDINGS[b.type];
      const own = b.owner === pid;
      const opts = [];
      if (own && b.built) {
        for (const k of def.trains || []) opts.push(+afford(UNITS[k].cost) + '' + +W.reqMet(pid, UNITS[k].req));
        for (const k of def.research || []) opts.push(k + (P.research[k] || 0) + +afford(researchCost(k, P.research[k] || 0)) + (W.researchBlock(pid, k) || ''));
      }
      sig = `B|${b.id}|${b.built}|${b.queue.map((q) => q.u || q.r).join(',')}|${opts.join('')}|${this.page}|${this.labCat}`;
      if (sig === this.panelSig) return this.updateDynamic(ents);
      const q = b.queue.map((x, i) => `<button class="mini" data-a="unq" data-v="${i}">${x.u ? `<img src="assets/units/${x.u}.png" alt="">` : this.researchIcon(x.r) || '<span class="lbl">R</span>'}${i === 0 ? '<b data-bind="qprog" style="background:#6ec6ff"></b>' : ''}</button>`).join('');
      info = `<div class="portrait"><img src="assets/buildings/${b.type}.png" alt=""></div>
        <div class="details"><div class="name">${def.name}</div>
        <div class="sub"><span data-bind="hptext"></span>${own ? '' : ' · ENEMY'}</div>
        <div class="meter"><i data-bind="hp"></i></div>
        ${!b.built ? `<div class="sub">Under construction</div><div class="meter prog"><i data-bind="prog"></i></div>` :
          b.queue.length ? `<div class="queue">${q}</div>` : `<div class="desc">${def.desc}</div>`}</div>`;
      const items = [];
      if (own && b.built) {
        for (const k of def.trains || []) {
          const d = UNITS[k];
          const locked = !W.reqMet(pid, d.req);
          const n = squadSize(k);
          items.push(`<button class="cmd${!afford(d.cost) ? ' off' : ''}${locked ? ' locked' : ''}" data-a="train" data-v="${k}"><img src="assets/units/${k}.png" alt="">${n > 1 ? `<i class="cnt">×${n}</i>` : ''}${this.lbl(d.name.toUpperCase())}${this.costHtml(d.cost)}</button>`);
        }
        for (const k of this.researchList(b)) {
          const r = RESEARCH[k];
          const lvl = P.research[k] || 0;
          if (lvl >= (r.levels || 1)) continue;
          const why = W.researchBlock(pid, k);
          const busy = why === 'Already researching';
          const cost = researchCost(k, lvl);
          const icon = this.researchIcon(k);
          items.push(`<button class="cmd${!afford(cost) || why ? ' off' : ''}${why && !busy ? ' locked' : ''}" data-a="research" data-v="${k}">${icon}${this.lbl(r.name.toUpperCase() + (r.levels > 1 ? ' ' + (lvl + 1) : '') + (busy ? ' …' : ''))}${this.costHtml(cost)}</button>`);
        }
      }
      const tail = [];
      if (own && !b.built) tail.push('<button class="cmd" data-a="cancelb"><span class="lbl">CANCEL<br>BUILD</span></button>');
      if (own && b.built && b.type === 'lab' && !this.labCat) {
        // the Lab first shows its pages: general upgrades, then one per Pokémon in the deck
        items.length = 0;
        for (const c of this.labCats()) {
          const n = this.researchList(b, c).filter((k) => !W.researchBlock(pid, k)).length;
          const img = c === 'general' ? '<img src="assets/buildings/lab.png" alt="">' : `<img src="assets/units/${c}.png" alt="">`;
          items.push(`<button class="cmd${n ? '' : ' off'}" data-a="labcat" data-v="${c}">${img}${this.lbl(c === 'general' ? 'GENERAL' : FORMS[c].name.toUpperCase())}${n ? `<i class="cnt">${n}</i>` : ''}</button>`);
        }
      }
      if (b.type === 'lab' && this.labCat) tail.unshift('<button class="cmd" data-a="labback"><span class="lbl">BACK</span></button>');
      tail.push(X);
      cmds = this.paginate(items, tail);
    } else if (ents.length === 1) {
      const e = ents[0];
      sig = `O|${e.id}|${e.form || ''}`;
      if (sig === this.panelSig) return this.updateDynamic(ents);
      if (e.kind === 'res') {
        info = `<div class="portrait"><img src="assets/res/${e.type}.png" alt=""></div><div class="details"><div class="name">${e.type === 'berry' ? 'Berry Bush' : 'Crystal'}</div><div class="sub" data-bind="amount"></div><div class="desc">Select Machop workers and tap here to gather.</div></div>`;
      } else {
        const f = FORMS[e.form];
        info = `<div class="portrait"><img src="assets/units/${e.form}.png" alt=""></div><div class="details"><div class="name">${f.name}</div><div class="sub"><span class="type" style="background:${TYPE_COLORS[f.type]}">${f.type.toUpperCase()}</span>ENEMY</div><div class="meter"><i data-bind="hp"></i></div><div class="desc">${UNITS[e.type].desc}</div></div>`;
      }
      cmds = X;
    } else {
      sig = 'none';
      if (sig === this.panelSig) return;
      info = `<div class="hintbox">Tap a Pokémon or building to select it.<br>Drag to scroll · Pinch to zoom<br>Hold &amp; drag to box-select</div>`;
    }
    this.panelSig = sig;
    $('info').innerHTML = info;
    $('cmds').innerHTML = cmds;
    this.updateDynamic(ents);
  }

  // Lab pages: general upgrades, then each Pokémon line in the player's deck
  labCats() { return ['general', ...this.world.players[this.pid].deck.slots.map((s) => s.line)]; }
  researchList(b, cat = this.labCat) {
    const def = BUILDINGS[b.type];
    const all = def.research || [];
    if (b.type !== 'lab' || !cat) return all;
    const W = this.world;
    if (cat === 'general') return all.filter((k) => !researchLines(k).length);
    return all.filter((k) => researchLines(k).includes(cat) && (!RESEARCH[k].skill || W.loadout(this.pid, cat).includes(RESEARCH[k].skill)));
  }

  // small icons for a squad's 3 skills (dimmed until researched)
  skillRow(u) {
    const W = this.world, P = W.players[this.pid];
    const ks = W.loadout(u.owner, FORMS[u.form].line);
    if (!ks.length) return '';
    return `<div class="skrow">${ks.map((k) => `<span class="sk${P.research[skillResearch(k)] ? '' : ' off'}${SKILLS[k].kind === 'p' ? ' pas' : ''}" title="${SKILLS[k].name}"><img src="assets/icons/${k}.png" alt="">${SKILLS[k].name}</span>`).join('')}</div>`;
  }

  updateDynamic(ents) {
    const info = $('info');
    const e = ents[0];
    if (!e) return;
    const set = (k, fn, root = info) => { const el = root.querySelector(`[data-bind="${k}"]`); if (el) fn(el); };
    const W = this.world;
    const sq = e.kind === 'unit' && e.owner === this.pid ? W.squadOf(e) : null;
    if (e.kind !== 'res') {
      // a squad shows the HP of all its members against its full size
      const [hp, max] = sq ? this.squadHp(sq) : [e.hp, e.maxHp];
      set('hp', (el) => { el.style.width = `${(100 * hp) / max}%`; el.style.background = hp / max > 0.5 ? '' : hp / max > 0.25 ? '#f2d03b' : '#f2503b'; });
      set('hptext', (el) => { el.textContent = `HP ${Math.ceil(hp)}/${Math.round(max)}`; });
    }
    if (sq) set('pips', (el) => {
      const h = '●'.repeat(sq.members.length) + '○'.repeat(Math.max(0, sq.size - sq.members.length));
      if (el.textContent !== h) el.textContent = h;
    });
    if (e.kind === 'unit') {
      const f = FORMS[e.form];
      const lo = EVO_XP[f.stage] || 0, hi = EVO_XP[f.stage + 1];
      set('xp', (el) => { el.style.width = f.next && hi ? `${Math.min(100, (100 * (e.xp - lo)) / (hi - lo))}%` : '100%'; });
      const o = e.order.type;
      set('status', (el) => {
        el.textContent = sq && sq.members.length < sq.size ? (sq.rT > 0 ? 'REINFORCING' : o === 'attack' ? 'FIGHTING' : 'WAITING TO REINFORCE') : e.sleep > 0 ? 'ASLEEP' : o === 'gather' ? 'GATHERING' : o === 'build' ? 'BUILDING' : o === 'attack' ? 'FIGHTING' :
          o === 'cast' ? 'USING MOVE' : o === 'move' ? 'MOVING' : 'IDLE';
      });
      // move cooldowns
      const cmds = $('cmds');
      for (const el of cmds.querySelectorAll('[data-bind^="cd-"]')) {
        const k = el.dataset.bind.slice(3);
        let best = Infinity;
        for (const sid of this.selSquads) {
          const q = W.squads.get(sid), lead = q && W.ents.get(q.members[0]);
          if (lead && W.activeSkills(lead).includes(k)) best = Math.min(best, q.cds[k] || 0);
        }
        const txt = best === Infinity ? '' : best > 0 ? `${Math.ceil(best)}s` : 'READY';
        if (el.textContent !== txt) el.textContent = txt;
      }
    }
    if (e.kind === 'building') {
      set('prog', (el) => { el.style.width = `${100 * e.progress}%`; });
      const q = e.queue[0];
      const drill = this.world.players[e.owner].research.drill ? 0.75 : 1;
      if (q) set('qprog', (el) => { el.style.width = `${(100 * q.t) / (q.u ? UNITS[q.u].time * drill : researchTime(q.r, q.lvl || 0))}%`; });
    }
    if (e.kind === 'res') set('amount', (el) => { el.textContent = `${e.amount} left`; });
    for (const el of info.querySelectorAll('[data-hpid]')) {
      const id = el.dataset.hpid;
      const q = id[0] === 's' && W.squads.get(+id.slice(1));
      const u = !q && W.ents.get(+id);
      if (q) { const [hp, max] = this.squadHp(q); el.style.width = `${(100 * hp) / max}%`; }
      else if (u) el.style.width = `${(100 * u.hp) / u.maxHp}%`;
      else el.parentElement.style.opacity = 0.3;
    }
    for (const el of info.querySelectorAll('[data-sqn]')) {
      const q = W.squads.get(+el.dataset.sqn);
      const t = q ? `${q.members.length}/${q.size}` : '';
      if (el.textContent !== t) el.textContent = t;
    }
  }

  squadHp(sq) {
    const ms = this.world.squadUnits(sq);
    const per = ms.length ? ms[0].maxHp : 1;
    return [ms.reduce((s, m) => s + Math.max(0, m.hp), 0), per * sq.size];
  }

  onPanelClick(e) {
    const btn = e.target.closest('[data-a]');
    if (!btn) return;
    unlockAudio();
    const a = btn.dataset.a, v = btn.dataset.v;
    const W = this.world, pid = this.pid;
    const units = this.selectedUnits();
    const b = this.selectedBuilding();
    const fail = (msg) => { this.toast(msg, 'warn'); sfx('error'); };
    switch (a) {
      case 'only': this.select([+v]); break;
      case 'more': this.page++; break;
      case 'stop': this.issue({ c: 'stop', ids: units.map((u) => u.id) }); sfx('order'); break;
      case 'force': this.forceMove = !this.forceMove; this.casting = null; if (this.forceMove) this.toast('Tap where to move (ignoring enemies)'); break;
      case 'build': this.buildMenu = true; this.page = 0; break;
      case 'back': this.buildMenu = false; this.page = 0; this.cancelPlacement(); break;
      case 'desel': this.select([]); break;
      case 'place': {
        const d = BUILDINGS[v];
        if (!W.reqMet(pid, d.req)) { fail(`Requires ${BUILDINGS[d.req].name}`); break; }
        if (!W.canAfford(pid, d.cost)) { fail('Not enough resources'); break; }
        this.startPlacement(v);
        break;
      }
      case 'train': {
        if (!b) break;
        const d = UNITS[v];
        if (!W.reqMet(pid, d.req)) { fail(`Requires ${BUILDINGS[d.req].name}`); break; }
        if (d.limit && W.unitCount(pid, v) >= d.limit) { fail(`Only ${d.limit} ${d.name} allowed`); break; }
        if (!W.canAfford(pid, d.cost)) { fail('Not enough resources'); break; }
        const P = W.players[pid];
        if (P.pop + squadPop(v) > P.cap) { fail('Need more supply — build a Poké Mart'); break; }
        this.issue({ c: 'train', id: b.id, type: v });
        sfx('train');
        break;
      }
      case 'research': {
        if (!b) break;
        const why = W.researchBlock(pid, v);
        if (why) { fail(why); break; }
        if (!W.canAfford(pid, researchCost(v, W.rlevel(pid, v)))) { fail('Not enough resources'); break; }
        this.toast(RESEARCH[v].desc);
        this.issue({ c: 'research', id: b.id, key: v });
        sfx('train');
        break;
      }
      case 'evolve': {
        const u = units[0];
        if (u) { this.issue({ c: 'evolve', id: u.id, to: v }); sfx('evolve'); }
        break;
      }
      case 'cast': {
        const S = SKILLS[v];
        if (!W.rlevel(pid, skillResearch(v))) { fail(`Research ${S.name} at the Lab first`); break; }
        const ready = [...this.selSquads].map((id) => W.squads.get(id)).filter((q) => q && W.ents.get(q.members[0]) && W.activeSkills(W.ents.get(q.members[0])).includes(v) && !(q.cds[v] > 0));
        if (!ready.length) { fail(`${S.name} is recharging`); break; }
        this.forceMove = false;
        if (S.target === 'self') {
          // self skills (Protect, Roost, Rest...) fire right away
          const lead = W.ents.get(ready[0].members[0]);
          this.issue({ c: 'cast', ids: ready[0].members, key: v, x: lead.x, y: lead.y });
          sfx('order');
          break;
        }
        this.casting = this.casting === v ? null : v;
        if (this.casting) this.toast(`Tap where to use ${S.name}`);
        break;
      }
      case 'auto': {
        const sqs = [...this.selSquads].map((id) => W.squads.get(id)).filter(Boolean);
        const on = !sqs.every((q) => q.auto);
        this.issue({ c: 'auto', ids: units.map((u) => u.id), on });
        for (const q of sqs) q.auto = on; // show it right away (the host confirms)
        this.toast(on ? 'Skills are used automatically' : 'Auto skills off: tap a skill to use it');
        break;
      }
      case 'labcat': this.labCat = v; this.page = 0; break;
      case 'labback': this.labCat = null; this.page = 0; break;
      case 'unq': if (b) { this.issue({ c: 'cancel', id: b.id, i: +v }); sfx('order'); } break;
      case 'cancelb': if (b) { this.issue({ c: 'cancel', id: b.id }); this.select([]); } break;
    }
    this.panelSig = '';
    this.renderPanel();
  }
}
