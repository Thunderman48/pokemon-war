// Canvas renderer: terrain, entities, effects, fog of war, minimap.
import { TILE, UNITS, FORMS, BUILDINGS, TEAM_COLORS, researchTime } from './config.js';
import { isFlying } from './world.js';
import { T } from './map.js';

const MINI_COLORS = {
  [T.GRASS]: [104, 184, 84], [T.GRASS2]: [96, 172, 76], [T.FLOWERS]: [120, 192, 96], [T.SAND]: [226, 204, 140],
  [T.WATER]: [72, 136, 228], [T.TREE]: [36, 104, 56], [T.ROCK]: [130, 126, 136], [T.TALL]: [70, 150, 64],
};

export class Renderer {
  constructor(canvas, minimap, world, assets, pid) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.mm = minimap; this.mctx = minimap.getContext('2d');
    this.world = world; this.A = assets; this.pid = pid;
    this.cam = { x: 0, y: 0, z: 2 };
    this.insets = { top: 40, bottom: 120 };
    this.fx = [];
    this.pings = [];
    this.evoFlash = new Map();
    this.fog = document.createElement('canvas');
    this.fog.width = world.w; this.fog.height = world.h;
    this.fctx = this.fog.getContext('2d');
    this.fogImg = this.fctx.createImageData(world.w, world.h);
    this.buildTerrain();
    this.mmT = 0;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.c.width = Math.round(this.vw * this.dpr);
    this.c.height = Math.round(this.vh * this.dpr);
    const r = this.mm.getBoundingClientRect();
    this.mm.width = Math.max(32, Math.round(r.width * this.dpr));
    this.mm.height = Math.max(32, Math.round(r.height * this.dpr));
    this.clampCam();
  }

  // --------------------------------------------------------------- camera
  viewH() { return this.vh - this.insets.top - this.insets.bottom; }
  clampCam() {
    const W = this.world.w * TILE, H = this.world.h * TILE, z = this.cam.z;
    const minX = -TILE * 2, maxX = W - this.vw / z + TILE * 2;
    const minY = -this.insets.top / z - TILE, maxY = H - (this.vh - this.insets.bottom) / z + TILE;
    this.cam.x = maxX < minX ? (W - this.vw / z) / 2 : Math.max(minX, Math.min(maxX, this.cam.x));
    this.cam.y = maxY < minY ? (H - this.vh / z) / 2 : Math.max(minY, Math.min(maxY, this.cam.y));
  }
  centerOn(x, y) {
    this.cam.x = x - this.vw / 2 / this.cam.z;
    this.cam.y = y - (this.insets.top + this.viewH() / 2) / this.cam.z;
    this.clampCam();
  }
  toWorld(sx, sy) { return { x: this.cam.x + sx / this.cam.z, y: this.cam.y + sy / this.cam.z }; }
  toScreen(x, y) { return { x: (x - this.cam.x) * this.cam.z, y: (y - this.cam.y) * this.cam.z }; }
  zoomAt(sx, sy, z) {
    const before = this.toWorld(sx, sy);
    this.cam.z = Math.max(this.minZoom(), Math.min(5, z));
    this.cam.x = before.x - sx / this.cam.z;
    this.cam.y = before.y - sy / this.cam.z;
    this.clampCam();
  }
  minZoom() { return Math.max(0.7, Math.min(this.vw / (this.world.w * TILE), 1.2)); }
  defaultZoom() { return Math.max(1.2, Math.min(3, Math.min(this.vw / 14, this.viewH() / 9) / TILE)); }

  // --------------------------------------------------------------- terrain
  buildTerrain() {
    const { w, h, map } = this.world;
    const cv = document.createElement('canvas');
    cv.width = w * TILE; cv.height = h * TILE;
    const g = cv.getContext('2d');
    const sheet = this.A.tiles;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? T.TREE : map.tiles[y * w + x]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = map.tiles[y * w + x];
        const ti = t === T.TREE || t === T.ROCK ? T.GRASS : t;
        g.drawImage(sheet, ti * TILE, 0, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
        if (t === T.WATER || t === T.SAND) {
          // soft shoreline
          g.fillStyle = t === T.WATER ? 'rgba(200,235,255,0.55)' : 'rgba(255,255,255,0.18)';
          const other = (tt) => (t === T.WATER ? tt !== T.WATER : tt !== T.SAND && tt !== T.WATER);
          if (other(at(x, y - 1))) g.fillRect(x * TILE, y * TILE, TILE, 2);
          if (other(at(x, y + 1))) g.fillRect(x * TILE, y * TILE + TILE - 2, TILE, 2);
          if (other(at(x - 1, y))) g.fillRect(x * TILE, y * TILE, 2, TILE);
          if (other(at(x + 1, y))) g.fillRect(x * TILE + TILE - 2, y * TILE, 2, TILE);
        }
      }
    // trees and rocks on top so their shapes overlap nicely
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = map.tiles[y * w + x];
        if (t === T.TREE || t === T.ROCK) g.drawImage(sheet, t * TILE, 0, TILE, TILE, x * TILE, y * TILE - (t === T.TREE ? 2 : 0), TILE, TILE);
      }
    this.terrain = cv;
    // minimap base
    const mm = document.createElement('canvas');
    mm.width = w; mm.height = h;
    const mg = mm.getContext('2d');
    const img = mg.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const c = MINI_COLORS[map.tiles[i]];
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    mg.putImageData(img, 0, 0);
    this.miniBase = mm;
  }

  // --------------------------------------------------------------- effects
  addFx(list, now) {
    for (const f of list) {
      if (f.k === 'evo') this.evoFlash.set(f.id, now);
      this.fx.push({ ...f, start: now });
    }
  }
  ping(x, y, color, now) { this.pings.push({ x, y, color, start: now }); }
  shake(now, mag) { this.shakeEnd = now + 350; this.shakeMag = Math.max(mag, this.shakeEnd > now ? this.shakeMag || 0 : 0); }

  spriteFor(e) {
    if (e.kind === 'unit') return this.A.units[e.form];
    if (e.kind === 'building') return this.A.buildings[e.type];
    return this.A.res[e.type];
  }

  // how high above the ground a unit's sprite is drawn
  lift(e, now) { return isFlying(e) ? 12 + Math.sin(now / 300 + e.id) * 1.5 : 0; }
  unitScale(e) { return FORMS[e.form].scale || 1; }
  // top edge (world y) of a unit's sprite
  unitTop(e, now = 0) {
    const img = this.spriteFor(e);
    return e.y + 4 - (img ? img.height : 16) * this.unitScale(e) - this.lift(e, now);
  }

  // --------------------------------------------------------------- main draw
  draw(alpha, now, ui) {
    const { ctx, cam, world, dpr } = this;
    const pid = this.pid;
    const z = cam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1d3b2a';
    ctx.fillRect(0, 0, this.c.width, this.c.height);
    ctx.imageSmoothingEnabled = false;
    // screen shake (big impacts)
    let shx = 0, shy = 0;
    if (this.shakeEnd && now < this.shakeEnd) {
      const k = (this.shakeEnd - now) / 350 * this.shakeMag;
      shx = (Math.random() - 0.5) * 2 * k; shy = (Math.random() - 0.5) * 2 * k;
    }
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (-cam.x * z + shx) * dpr, (-cam.y * z + shy) * dpr);
    // round camera to device pixels to avoid shimmering
    const sx = Math.max(0, Math.floor(cam.x)), sy = Math.max(0, Math.floor(cam.y));
    const sw = Math.min(this.terrain.width - sx, Math.ceil(this.vw / z) + 2);
    const sh = Math.min(this.terrain.height - sy, Math.ceil(this.vh / z) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(this.terrain, sx, sy, sw, sh, sx, sy, sw, sh);

    const x0 = cam.x - 48, y0 = cam.y - 48, x1 = cam.x + this.vw / z + 48, y1 = cam.y + this.vh / z + 64;
    const list = [];
    for (const e of world.ents.values()) {
      const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha;
      if (ex < x0 || ex > x1 || ey < y0 || ey > y1) continue;
      if (!world.isVisible(pid, e)) continue;
      e.rx = ex; e.ry = ey;
      list.push(e);
    }
    const depth = (e) => (e.kind === 'building' ? (e.ty + e.h) * TILE : e.ry + (isFlying(e) ? 1e5 : 0));
    list.sort((a, b) => depth(a) - depth(b));
    const sel = ui.selection;

    // selection rings underneath
    for (const e of list) {
      if (!sel.has(e.id) || e.kind !== 'unit') continue;
      ctx.strokeStyle = e.owner === pid ? '#7dff7d' : '#ff6b6b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(e.rx, e.ry + 3, e.radius + 2, (e.radius + 2) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const e of list) {
      if (e.kind === 'unit') this.drawUnit(e, now);
      else if (e.kind === 'building') this.drawBuilding(e, now, sel.has(e.id));
      else this.drawRes(e);
    }
    this.drawFx(now);
    this.drawFog();
    // pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      const t = (now - p.start) / 600;
      if (t >= 1) { this.pings.splice(i, 1); continue; }
      ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - t; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 10 * (1 - t) + 2, (10 * (1 - t) + 2) * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // health bars on top
    for (const e of list) {
      if (e.kind === 'res') { if (sel.has(e.id)) this.bar(e.rx - 7, e.ry - 11, 14, e.amount / e.max, '#ffd34d'); continue; }
      const show = sel.has(e.id) || e.hp < e.maxHp;
      if (!show) continue;
      if (e.kind === 'unit') {
        const w = Math.max(16, e.radius * 2);
        this.bar(e.rx - w / 2, e.ry + 4 - (this.spriteFor(e) || { height: 16 }).height * this.unitScale(e) - this.lift(e, now) - 2, w, e.hp / e.maxHp);
      } else {
        const img = this.spriteFor(e);
        const top = (e.ty + e.h) * TILE - (img ? img.height : e.h * TILE);
        this.bar(e.tx * TILE + 4, top - 3, e.w * TILE - 8, e.hp / e.maxHp);
      }
    }
    // rally point of selected own building
    for (const id of sel) {
      const b = world.ents.get(id);
      if (b && b.kind === 'building' && b.owner === pid && b.rally) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.setLineDash([]);
        this.flag(b.rally.x, b.rally.y, TEAM_COLORS[pid]);
      }
    }
    if (ui.ghost) this.drawGhost(ui.ghost);
    if (ui.target) {
      const t = ui.target, pulse = 0.6 + Math.sin(now / 120) * 0.2;
      ctx.strokeStyle = t.color; ctx.fillStyle = t.color; ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // box selection
    if (ui.box) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { x0: bx0, y0: by0, x1: bx1, y1: by1 } = ui.box;
      ctx.fillStyle = 'rgba(125,255,125,0.15)';
      ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 1.5;
      ctx.fillRect(Math.min(bx0, bx1), Math.min(by0, by1), Math.abs(bx1 - bx0), Math.abs(by1 - by0));
      ctx.strokeRect(Math.min(bx0, bx1), Math.min(by0, by1), Math.abs(bx1 - bx0), Math.abs(by1 - by0));
    }
    if (now - this.mmT > 150) { this.mmT = now; this.drawMinimap(sel, now); }
  }

  bar(x, y, w, f, color) {
    const ctx = this.ctx;
    f = Math.max(0, Math.min(1, f));
    ctx.fillStyle = 'rgba(20,16,30,0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = color || (f > 0.5 ? '#5ee05e' : f > 0.25 ? '#f2d03b' : '#f2503b');
    ctx.fillRect(x, y, Math.max(1, w * f), 2);
  }

  flag(x, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = '#2a2233'; ctx.fillRect(x, y - 12, 1, 12);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x + 1, y - 12); ctx.lineTo(x + 8, y - 9.5); ctx.lineTo(x + 1, y - 7); ctx.fill();
  }

  drawUnit(e, now) {
    const ctx = this.ctx;
    const img = this.spriteFor(e);
    const x = e.rx, y = e.ry;
    const fly = isFlying(e);
    const lift = this.lift(e, now);
    const sc = this.unitScale(e);
    // shadow + team marker
    ctx.fillStyle = fly ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 3, e.radius, e.radius * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = TEAM_COLORS[e.owner];
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(x, y + 3, e.radius * 0.8, e.radius * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (!img) return;
    const w = img.width * sc, h = img.height * sc;
    const bob = e.moving && !fly ? -Math.abs(Math.sin(now / 90 + e.id)) * 1.5 : 0;
    const lunge = e.anim > 0 ? e.face * 1.5 : 0;
    const dx = Math.round(x + lunge - w / 2), dy = Math.round(y + 4 - h + bob - lift);
    ctx.save();
    if (e.face < 0) { ctx.translate(dx * 2 + w, 0); ctx.scale(-1, 1); }
    if (e.sleep > 0) ctx.globalAlpha = 0.75;
    const anim = this.A.anim[e.form];
    const frame = anim ? Math.floor(now / 95 + e.id * 3) % anim.n : 0;
    const blit = () => {
      if (anim) { const fw = anim.img.width / anim.n; ctx.drawImage(anim.img, frame * fw, 0, fw, anim.img.height, dx, dy, w, h); }
      else ctx.drawImage(img, dx, dy, w, h);
    };
    blit();
    ctx.globalAlpha = 1;
    const ft = this.evoFlash.get(e.id);
    if (ft !== undefined) {
      const t = (now - ft) / 1400;
      if (t > 1) this.evoFlash.delete(e.id);
      else {
        ctx.globalAlpha = (Math.sin(t * Math.PI * 8) * 0.5 + 0.5) * (1 - t);
        ctx.globalCompositeOperation = 'lighter';
        blit(); blit();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (e.carry && e.carry.amt) {
      const ic = this.A.res[e.carry.kind];
      if (ic) ctx.drawImage(ic, Math.round(x - 4), Math.round(dy - 7), 8, 8 * ic.height / ic.width);
    }
    const stage = FORMS[e.form].stage;
    if (stage > 0) {
      ctx.fillStyle = '#ffd84d';
      for (let i = 0; i < stage; i++) ctx.fillRect(Math.round(x - 3 + i * 4), Math.round(y + 6), 2, 2);
    }
    if (e.sleep > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 6px monospace';
      const k = (now / 400) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.fillText('z', x + 4 + k * 3, dy - 1 - k * 5);
      ctx.fillText('Z', x + 1, dy + 1 - ((k + 0.5) % 1) * 6);
      ctx.globalAlpha = 1;
    }
    if (e.evoReady && e.owner === this.pid) {
      ctx.fillStyle = Math.floor(now / 250) % 2 ? '#fff36b' : '#ffffff';
      ctx.fillRect(Math.round(x - 1), Math.round(dy - 9), 2, 5);
      ctx.fillRect(Math.round(x - 1), Math.round(dy - 3), 2, 2);
    }
  }

  drawBuilding(b, now, selected) {
    const ctx = this.ctx;
    const img = this.spriteFor(b);
    const left = b.tx * TILE, bottom = (b.ty + b.h) * TILE, wpx = b.w * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(left + 2, bottom - 4, wpx - 2, 5);
    if (img) {
      const dx = left + Math.round((wpx - img.width) / 2), dy = bottom - img.height;
      if (!b.built) {
        // construction: draw rising sprite + scaffold
        const ph = Math.max(4, Math.round(img.height * b.progress));
        ctx.globalAlpha = 0.45; ctx.drawImage(img, dx, dy); ctx.globalAlpha = 1;
        ctx.drawImage(img, 0, img.height - ph, img.width, ph, dx, bottom - ph, img.width, ph);
        ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 1;
        for (let x = left + 2; x < left + wpx; x += 8) { ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, dy + 4); ctx.stroke(); }
        for (let y = bottom - 6; y > dy; y -= 8) { ctx.beginPath(); ctx.moveTo(left + 1, y); ctx.lineTo(left + wpx - 1, y); ctx.stroke(); }
        this.bar(left + 4, bottom + 2, wpx - 8, b.progress, '#6ec6ff');
      } else {
        ctx.drawImage(img, dx, dy);
        if (b.queue.length) {
          const q = b.queue[0];
          const total = q.u ? UNITS[q.u].time * (this.world.players[b.owner].research.drill ? 0.75 : 1) : researchTime(q.r, q.lvl || 0);
          this.bar(left + 4, bottom + 2, wpx - 8, q.t / total, '#6ec6ff');
        }
      }
      this.flag(left + 2, dy + 10, TEAM_COLORS[b.owner]);
      if (selected) {
        ctx.strokeStyle = b.owner === this.pid ? '#7dff7d' : '#ff6b6b'; ctx.lineWidth = 1.2;
        const x0 = left - 1, y0 = dy - 1, x1 = left + wpx + 1, y1 = bottom + 1, c = 5;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
        ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
        ctx.moveTo(x1, y1 - c); ctx.lineTo(x1, y1); ctx.lineTo(x1 - c, y1);
        ctx.moveTo(x0 + c, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - c);
        ctx.stroke();
      }
    }
  }

  drawRes(r) {
    const ctx = this.ctx;
    const img = this.spriteFor(r);
    if (!img) return;
    ctx.globalAlpha = r.amount < r.max * 0.25 ? 0.7 : 1;
    ctx.drawImage(img, Math.round(r.x - img.width / 2), Math.round(r.y + 7 - img.height));
    ctx.globalAlpha = 1;
  }

  drawGhost(g) {
    const ctx = this.ctx;
    const def = BUILDINGS[g.type];
    const img = this.A.buildings[g.type];
    const left = g.tx * TILE, top = g.ty * TILE;
    ctx.fillStyle = g.ok ? 'rgba(80,255,120,0.35)' : 'rgba(255,60,60,0.4)';
    ctx.fillRect(left, top, def.w * TILE, def.h * TILE);
    if (img) {
      ctx.globalAlpha = 0.65;
      ctx.drawImage(img, left + Math.round((def.w * TILE - img.width) / 2), top + def.h * TILE - img.height);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = g.ok ? '#7dff7d' : '#ff5050';
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, def.w * TILE - 1, def.h * TILE - 1);
  }

  drawFx(now) {
    const ctx = this.ctx;
    const world = this.world;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      const age = (now - f.start) / 1000;
      const life = f.k === 'p' ? f.d : f.k === 'evo' ? 1.4 : f.k === 'die' ? (f.b ? 0.9 : 0.5) : f.k === 'heal' ? 0.7 :
        f.k === 'zap' ? 0.5 : f.k === 'bolt' ? 0.6 : f.k === 'healp' ? 0.8 : f.k === 'sleep' ? 1.2 : f.k === 'boom' ? 1.0 : 0.3;
      if (age > life) { this.fx.splice(i, 1); continue; }
      const t = age / life;
      const fxX = f.k === 'p' ? f.x2 : f.x, fxY = f.k === 'p' ? f.y2 : f.y;
      const tx = Math.floor(fxX / TILE), ty = Math.floor(fxY / TILE);
      if (tx >= 0 && ty >= 0 && tx < world.w && ty < world.h && !world.vis[this.pid][ty * world.w + tx]) {
        if (f.k !== 'p') continue;
        const sx = Math.floor(f.x1 / TILE), sy = Math.floor(f.y1 / TILE);
        if (!world.vis[this.pid][sy * world.w + sx]) continue;
      }
      if (f.k === 'p') {
        const x = f.x1 + (f.x2 - f.x1) * t, y = f.y1 + (f.y2 - f.y1) * t - Math.sin(t * Math.PI) * (f.s === 'ball' || f.s === 'leaf' ? 6 : 2);
        this.projectile(f.s, x, y, f, t, now);
      } else if (f.k === 'hit') {
        ctx.fillStyle = `rgba(255,255,255,${1 - t})`;
        const r = 2 + t * 4;
        ctx.fillRect(f.x - r, f.y - 0.5, r * 2, 1); ctx.fillRect(f.x - 0.5, f.y - r, 1, r * 2);
      } else if (f.k === 'die') {
        const n = f.b ? 10 : 5;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2 + f.x;
          const d = t * (f.b ? 22 : 10);
          ctx.fillStyle = f.b ? `rgba(${120 + j * 10},${90 + j * 5},70,${1 - t})` : `rgba(230,230,230,${1 - t})`;
          const s = (f.b ? 5 : 3) * (1 - t * 0.5);
          ctx.fillRect(f.x + Math.cos(a) * d - s / 2, f.y - 4 + Math.sin(a) * d * 0.6 - s / 2, s, s);
        }
      } else if (f.k === 'evo') {
        ctx.strokeStyle = `rgba(255,255,255,${1 - t})`; ctx.lineWidth = 1.5;
        for (let j = 0; j < 2; j++) {
          const r = (t * 24 + j * 8) % 24;
          ctx.beginPath(); ctx.ellipse(f.x, f.y - 6, r, r * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,240,140,${1 - t})`;
        for (let j = 0; j < 6; j++) {
          const a = j + t * 6;
          ctx.fillRect(f.x + Math.cos(a) * 12 - 1, f.y - 6 + Math.sin(a) * 12 - t * 10, 2, 2);
        }
      } else if (f.k === 'heal') {
        ctx.fillStyle = `rgba(110,255,140,${1 - t})`;
        const y = f.y - 14 - t * 8;
        ctx.fillRect(f.x - 2, y, 5, 1); ctx.fillRect(f.x, y - 2, 1, 5);
      } else if (f.k === 'zap') {
        ctx.strokeStyle = `rgba(255,240,90,${0.4 + 0.6 * ((now / 60) % 2 < 1 ? 1 : 0.3)})`; ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (f.k === 'bolt') {
        ctx.fillStyle = `rgba(255,255,200,${0.35 * (1 - t)})`;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        if (t < 0.5) {
          for (let j = -1; j <= 1; j++) {
            ctx.strokeStyle = j ? '#fff36b' : '#ffffff'; ctx.lineWidth = j ? 1.5 : 2.5;
            ctx.beginPath();
            let bx = f.x + j * f.r * 0.5, by = f.y - 90;
            ctx.moveTo(bx, by);
            for (let k = 1; k <= 6; k++) { bx = f.x + j * f.r * 0.5 + ((k * 37 + j * 11) % 9 - 4) * 1.5; by = f.y - 90 + k * 15; ctx.lineTo(bx, by); }
            ctx.stroke();
          }
        }
      } else if (f.k === 'healp') {
        for (let j = 0; j < 2; j++) {
          const rr = f.r * Math.min(1, t * 1.6 + j * 0.25);
          ctx.strokeStyle = `rgba(110,255,140,${1 - t})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = `rgba(160,255,170,${1 - t})`;
        for (let j = 0; j < 8; j++) {
          const a = j * 0.8, d = f.r * 0.6;
          ctx.fillRect(f.x + Math.cos(a) * d - 1, f.y + Math.sin(a) * d * 0.7 - t * 14 - 3, 3, 1);
          ctx.fillRect(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7 - t * 14 - 4, 1, 3);
        }
      } else if (f.k === 'sleep') {
        for (let j = 0; j < 14; j++) {
          const a = j * 2.4 + t * 2, d = f.r * ((j % 5) / 5 + 0.2);
          ctx.fillStyle = `rgba(250,${150 + (j % 3) * 30},220,${0.8 * (1 - t)})`;
          ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7 - t * 8, 2.5 + (j % 3), 0, 7); ctx.fill();
        }
      } else if (f.k === 'boom') {
        this.dragonBoom(f, t, now);
      } else if (f.k === 'done') {
        ctx.strokeStyle = `rgba(255,230,120,${1 - t})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 20 + t * 14, (20 + t * 14) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  projectile(kind, x, y, f, t, now) {
    const ctx = this.ctx;
    if (kind === 'ember') {
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 7); ctx.fill();
    } else if (kind === 'water') {
      ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a8ef0'; ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
    } else if (kind === 'leaf') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(now / 60);
      ctx.fillStyle = '#5bd14a'; ctx.fillRect(-3, -1, 6, 2); ctx.fillStyle = '#2f8a2f'; ctx.fillRect(-3, 0, 6, 1);
      ctx.restore();
    } else if (kind === 'bolt') {
      ctx.strokeStyle = '#fff36b'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sx = f.x1 + (f.x2 - f.x1) * Math.max(0, t - 0.35), sy = f.y1 + (f.y2 - f.y1) * Math.max(0, t - 0.35);
      ctx.moveTo(sx, sy);
      for (let j = 1; j <= 4; j++) {
        const k = j / 4;
        ctx.lineTo(sx + (x - sx) * k + (j % 2 ? 2 : -2), sy + (y - sy) * k + (j % 2 ? -2 : 2));
      }
      ctx.stroke();
    } else if (kind === 'star') {
      ctx.fillStyle = '#fff6a0';
      ctx.save(); ctx.translate(x, y); ctx.rotate(now / 80);
      ctx.fillRect(-3, -0.75, 6, 1.5); ctx.fillRect(-0.75, -3, 1.5, 6);
      ctx.restore();
    } else if (kind === 'rock') {
      ctx.fillStyle = '#8a7a5a'; ctx.fillRect(x - 2.5, y - 2, 5, 4);
      ctx.fillStyle = '#b8a880'; ctx.fillRect(x - 1.5, y - 2, 2, 1.5);
    } else if (kind === 'gust') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 3, now / 60, now / 60 + 4); ctx.stroke();
    } else if (kind === 'breath' || kind === 'megabreath') {
      this.dragonBeam(f, t, now, kind === 'megabreath');
    } else {
      ctx.fillStyle = '#f03c3c'; ctx.beginPath(); ctx.arc(x, y, 2.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(x - 2.5, y - 0.3, 5, 0.6);
    }
  }

  // Dragon Breath: charge orb at the mouth, then a thick layered beam that races to the target
  dragonBeam(f, t, now, mega) {
    const ctx = this.ctx;
    const charge = 0.28;
    const outer = mega ? 'rgba(255,170,40,0.38)' : 'rgba(60,220,120,0.38)';
    const mid = mega ? 'rgba(255,220,90,0.9)' : 'rgba(120,255,170,0.9)';
    const core = mega ? '#fffbe0' : '#f4ffe0';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // charge-up orb with spiralling sparks
    const cr = (t < charge ? t / charge : 1) * (mega ? 6 : 5) * (1 + Math.sin(now / 30) * 0.15);
    ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(f.x1, f.y1, cr * 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = mid; ctx.beginPath(); ctx.arc(f.x1, f.y1, cr, 0, 7); ctx.fill();
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(f.x1, f.y1, cr * 0.45, 0, 7); ctx.fill();
    if (t < charge) {
      for (let j = 0; j < 6; j++) {
        const a = j * 1.047 + now / 90, d = 14 * (1 - t / charge) + 2;
        ctx.fillStyle = mid;
        ctx.fillRect(f.x1 + Math.cos(a) * d - 1, f.y1 + Math.sin(a) * d - 1, 2, 2);
      }
      ctx.restore();
      return;
    }
    // beam: tip races from the mouth to the target, tail stays at the mouth
    const k = Math.min(1, (t - charge) / (1 - charge) * 1.25);
    const hx = f.x1 + (f.x2 - f.x1) * k, hy = f.y1 + (f.y2 - f.y1) * k;
    const pulse = 1 + Math.sin(now / 25) * 0.18;
    ctx.lineCap = 'round';
    for (const [col, w] of [[outer, (mega ? 14 : 11) * pulse], [mid, (mega ? 7 : 5.5) * pulse], [core, 2.4]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(hx, hy); ctx.stroke();
    }
    // crackling sparks along the beam
    const dx = hx - f.x1, dy = hy - f.y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (let j = 0; j < 14; j++) {
      const u = ((j * 0.137 + now / 400) % 1);
      const off = Math.sin(j * 12.9 + now / 40) * (mega ? 8 : 6);
      ctx.fillStyle = j % 3 ? mid : core;
      ctx.fillRect(f.x1 + dx * u + nx * off - 1, f.y1 + dy * u + ny * off - 1, 2, 2);
    }
    // bright head of the beam
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(hx, hy, (mega ? 5 : 4) * pulse, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  // Dragon Breath impact: flash, scorch, fireball, shockwaves, debris, rising embers
  dragonBoom(f, t, now) {
    const ctx = this.ctx;
    const r = (f.r || 22) * (f.m ? 1.7 : 1.5);
    const g1 = f.m ? [255, 176, 40] : [80, 230, 130];
    const g2 = f.m ? [255, 236, 140] : [220, 255, 160];
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, a)})`;
    // scorch mark on the ground
    ctx.fillStyle = `rgba(20,30,20,${0.35 * (1 - t)})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // white flash
    if (t < 0.15) {
      ctx.fillStyle = `rgba(255,255,240,${0.9 * (1 - t / 0.15)})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, r * 1.3, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();
    }
    // fireball
    const fb = Math.max(0, 1 - t * 1.6);
    ctx.fillStyle = rgba(g1, 0.55 * fb);
    ctx.beginPath(); ctx.ellipse(f.x, f.y - 6 - t * 10, r * (0.5 + t * 0.5), r * (0.45 + t * 0.4), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(g2, 0.8 * fb);
    ctx.beginPath(); ctx.ellipse(f.x, f.y - 6 - t * 10, r * 0.3 * (1 + t), r * 0.28 * (1 + t), 0, 0, Math.PI * 2); ctx.fill();
    // two shockwave rings
    for (const [sp, w, c] of [[1.6, 3, g2], [1.1, 2, g1]]) {
      const rr = r * (0.2 + t * sp);
      ctx.strokeStyle = rgba(c, 1 - t); ctx.lineWidth = w * (1 - t) + 0.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // debris streaks flying outward
    for (let j = 0; j < 16; j++) {
      const a = j * 0.3927 + f.x * 0.01;
      const d0 = r * (0.2 + t * 1.5), d1 = d0 + 5 * (1 - t);
      ctx.strokeStyle = rgba(j % 2 ? g1 : g2, 1 - t); ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(f.x + Math.cos(a) * d0, f.y + Math.sin(a) * d0 * 0.6 - t * 6);
      ctx.lineTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1 * 0.6 - t * 6);
      ctx.stroke();
    }
    // embers drifting up
    for (let j = 0; j < 10; j++) {
      const ex = f.x + Math.sin(j * 7.3) * r * 0.8, ey = f.y - t * (20 + (j % 4) * 6) - 4;
      ctx.fillStyle = rgba(j % 2 ? g2 : g1, 1 - t);
      ctx.fillRect(ex - 1, ey - 1, 2, 2);
    }
    ctx.restore();
  }

  drawFog() {
    const { world, pid } = this;
    const vis = world.vis[pid], exp = world.explored[pid];
    const d = this.fogImg.data;
    for (let i = 0; i < vis.length; i++) {
      d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 120 : 245;
    }
    this.fctx.putImageData(this.fogImg, 0, 0);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, world.w, world.h, 0, 0, world.w * TILE, world.h * TILE);
    ctx.imageSmoothingEnabled = false;
  }

  drawMinimap(sel, now) {
    const { mctx: g, world, pid } = this;
    const W = this.mm.width, H = this.mm.height;
    const sx = W / world.w, sy = H / world.h;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.miniBase, 0, 0, W, H);
    for (const e of world.ents.values()) {
      if (!world.isVisible(pid, e)) continue;
      if (e.kind === 'res') {
        g.fillStyle = e.type === 'berry' ? '#e0406a' : '#9ad8ff';
        g.fillRect(e.tx * sx, e.ty * sy, Math.max(2, sx), Math.max(2, sy));
      } else if (e.kind === 'building') {
        g.fillStyle = TEAM_COLORS[e.owner];
        g.fillRect(e.tx * sx, e.ty * sy, e.w * sx, e.h * sy);
        g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(e.tx * sx, e.ty * sy, e.w * sx, e.h * sy);
      } else {
        g.fillStyle = sel.has(e.id) ? '#fff' : TEAM_COLORS[e.owner];
        const s = Math.max(2.5, sx * 1.2);
        g.fillRect((e.x / TILE) * sx - s / 2, (e.y / TILE) * sy - s / 2, s, s);
      }
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(this.fog, 0, 0, W, H);
    if (this.alerts) {
      for (let i = this.alerts.length - 1; i >= 0; i--) {
        const a = this.alerts[i];
        const t = (now - a.start) / 3000;
        if (t > 1) { this.alerts.splice(i, 1); continue; }
        g.strokeStyle = `rgba(255,60,60,${1 - t})`; g.lineWidth = 2 * this.dpr;
        const r = (6 + ((now - a.start) % 1000) / 1000 * 10) * this.dpr;
        g.beginPath(); g.arc((a.x / TILE) * sx, (a.y / TILE) * sy, r, 0, 7); g.stroke();
      }
    }
    // camera rect
    const c = this.cam;
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, this.dpr);
    g.strokeRect((c.x / TILE) * sx, ((c.y + this.insets.top / c.z) / TILE) * sy, (this.vw / c.z / TILE) * sx, (this.viewH() / c.z / TILE) * sy);
  }

  alert(x, y, now) {
    if (!this.alerts) this.alerts = [];
    this.alerts.push({ x, y, start: now });
  }
}
