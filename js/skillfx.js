// Visual effects for skills and status effects. Called from the renderer.
import { SKILLS, TYPE_COLORS } from './config.js';

// how long each skill effect lasts on screen (s)
export function skillFxLife(f) {
  switch (f.k) {
    case 'beam': case 'cone': case 'zone': case 'charge': case 'sk_mark': return f.d;
    case 'cast': return 1.1;
    case 'sk_hit': return 0.9;
    case 'buff': return 0.9;
    case 'trail': return 0.35;
    case 'miss': case 'sturdy': return 0.8;
    default: return 0;
  }
}

const hex = (c, a) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const typeOf = (s) => (SKILLS[s] ? SKILLS[s].type : 'normal');
const colorOf = (s) => TYPE_COLORS[typeOf(s)] || '#ffffff';

export function drawSkillFx(R, f, t, now) {
  const ctx = R.ctx;
  const col = colorOf(f.s);
  switch (f.k) {
    case 'cast': {
      // the skill's name pops up over the caster
      const S = SKILLS[f.s];
      if (!S) return;
      const y = f.y - 22 - t * 10;
      ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(S.name, f.x + 0.5, y + 0.5);
      ctx.fillStyle = col;
      ctx.fillText(S.name, f.x, y);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
      if (t < 0.35) {
        ctx.strokeStyle = hex(col, 1 - t / 0.35); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, 4 + t * 30, (4 + t * 30) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      return;
    }
    case 'beam': return beam(R, f, t, now, col);
    case 'cone': return cone(R, f, t, now, col);
    case 'zone': return zone(R, f, t, now, col);
    case 'charge': {
      const u = R.world.ents.get(f.id);
      const x = u ? u.rx ?? u.x : f.x, y = (u ? u.ry ?? u.y : f.y) - 8;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + now / 200, d = 14 * (1 - ((t * 2 + i / 6) % 1));
        ctx.fillStyle = 'rgba(255,250,170,0.9)';
        ctx.fillRect(x + Math.cos(a) * d - 1, y + Math.sin(a) * d * 0.7 - 1, 2, 2);
      }
      ctx.fillStyle = `rgba(255,255,190,${0.25 + t * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y, 2 + t * 5, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    case 'sk_mark': {
      // where a delayed area skill will land
      ctx.strokeStyle = hex(col, 0.5 + 0.5 * ((now / 80) % 2 < 1 ? 1 : 0.4)); ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (f.s === 'rockslide') {
        // boulders falling in
        for (let i = 0; i < 5; i++) {
          const ox = Math.cos(i * 2.3) * f.r * 0.6, oy = Math.sin(i * 2.3) * f.r * 0.4;
          const h = (1 - t) * 90 + i * 6;
          ctx.fillStyle = '#8a7238'; ctx.fillRect(f.x + ox - 3, f.y + oy - h - 3, 6, 5);
          ctx.fillStyle = '#c8a850'; ctx.fillRect(f.x + ox - 2, f.y + oy - h - 3, 3, 2);
        }
      }
      if (f.s === 'yawn') {
        ctx.fillStyle = `rgba(255,190,230,${0.6})`;
        ctx.font = 'bold 6px monospace';
        for (let i = 0; i < 3; i++) ctx.fillText('z', f.x - 6 + i * 6, f.y - 4 - ((t * 3 + i * 0.3) % 1) * 10);
      }
      return;
    }
    case 'sk_hit': return hit(R, f, t, now, col);
    case 'buff': {
      const protect = f.s === 'protect';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const rr = f.r * (0.4 + t * 0.8);
      ctx.strokeStyle = protect ? `rgba(140,230,255,${1 - t})` : hex(col, 1 - t); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      for (const id of f.ids || []) {
        const u = R.world.ents.get(id);
        if (!u) continue;
        const ux = u.rx ?? u.x, uy = (u.ry ?? u.y) - R.lift(u, now);
        ctx.fillStyle = protect ? `rgba(180,240,255,${1 - t})` : `rgba(255,230,120,${1 - t})`;
        for (let j = 0; j < 3; j++) ctx.fillRect(ux - 5 + j * 5, uy - 8 - t * 16 - j * 3, 2, 2);
      }
      ctx.restore();
      return;
    }
    case 'trail': {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hex(col, 0.55 * (1 - t));
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 6 * (1 - t) + 1, 4 * (1 - t) + 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    case 'miss': case 'sturdy': {
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#000'; ctx.fillText(f.k === 'miss' ? 'MISS' : 'STURDY!', f.x + 0.5, f.y - t * 8 + 0.5);
      ctx.fillStyle = f.k === 'miss' ? '#dddddd' : '#ffd84d'; ctx.fillText(f.k === 'miss' ? 'MISS' : 'STURDY!', f.x, f.y - t * 8);
      ctx.globalAlpha = 1; ctx.textAlign = 'start';
      return;
    }
  }
}

function beam(R, f, t, now, col) {
  const ctx = R.ctx;
  const dx = f.x2 - f.x1, dy = f.y2 - f.y1, len = Math.hypot(dx, dy) || 1;
  const grow = Math.min(1, t * 4); // the stream reaches out, then fades
  const fade = t < 0.6 ? 1 : (1 - t) / 0.4;
  const ex = f.x1 + dx * grow, ey = f.y1 + dy * grow;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (f.s === 'flamethrower') {
    for (let i = 0; i < 18; i++) {
      const k = ((i / 18) + now / 600) % 1;
      if (k > grow) continue;
      const px = f.x1 + dx * k + Math.sin(i * 7 + now / 40) * 2 * k, py = f.y1 + dy * k + Math.cos(i * 5 + now / 50) * 2 * k;
      const r = 1.5 + k * f.w * 0.35;
      ctx.fillStyle = `rgba(255,${120 + (i % 3) * 50},40,${0.75 * fade})`;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    }
  } else if (f.s === 'solarbeam') {
    ctx.strokeStyle = `rgba(255,250,170,${0.5 * fade})`; ctx.lineWidth = f.w + 4;
    ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.lineWidth = f.w * 0.45;
    ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(ex, ey); ctx.stroke();
  } else if (f.s === 'hydropump') {
    ctx.strokeStyle = `rgba(80,140,255,${0.65 * fade})`; ctx.lineWidth = f.w * 0.8;
    ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(230,245,255,${fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(ex, ey); ctx.stroke();
    if (grow >= 1) {
      ctx.fillStyle = `rgba(200,230,255,${fade})`;
      for (let i = 0; i < 6; i++) ctx.fillRect(ex + Math.cos(i + now / 60) * 6 * t - 1, ey + Math.sin(i * 2 + now / 70) * 5 * t - 1, 2, 2);
    }
  } else {
    ctx.strokeStyle = hex(col, 0.7 * fade); ctx.lineWidth = f.w * 0.7;
    ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.restore();
}

function cone(R, f, t, now, col) {
  const ctx = R.ctx;
  const grow = Math.min(1, t * 3), fade = t < 0.6 ? 1 : (1 - t) / 0.4;
  const len = f.len * grow;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(f.x, f.y);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(3, len));
  const dragon = f.s === 'dragonbreath';
  g.addColorStop(0, dragon ? `rgba(170,230,255,${0.35 * fade})` : `rgba(255,230,140,${0.35 * fade})`);
  g.addColorStop(0.5, dragon ? `rgba(90,110,255,${0.22 * fade})` : hex(col, 0.22 * fade));
  g.addColorStop(1, dragon ? `rgba(110,60,255,0)` : hex(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(3, len), f.a - f.ang / 2, f.a + f.ang / 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  // licks of flame / dragon energy streaming through the cone
  ctx.save();
  ctx.translate(f.x, f.y);
  for (let i = 0; i < 40; i++) {
    const a = f.a + (((i * 0.37) % 1) - 0.5) * f.ang * 0.95;
    const d = len * (((i * 0.61) + now / 380) % 1);
    const px = Math.cos(a) * d, py = Math.sin(a) * d, r = 0.8 + Math.min(1.8, d / 30);
    ctx.fillStyle = dragon ? ['#7fd8ff', '#9c7bff', '#e8f6ff', '#5a6cff'][i % 4] : ['#ff8a2a', '#ffcf3a', '#ff5a1e'][i % 3];
    ctx.globalAlpha = fade * (1 - (d / (len + 1)) * 0.7);
    ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function zone(R, f, t, now, col) {
  const ctx = R.ctx;
  const fade = t < 0.85 ? 1 : (1 - t) / 0.15;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (f.s === 'firespin') {
    // a spinning ring of flame tongues
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + now / 260;
      const rr = f.r * (0.7 + 0.3 * ((i % 3) / 3));
      const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.7;
      const h = 6 + Math.sin(now / 80 + i * 1.7) * 2.5;
      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = '#e8401c';
      ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.quadraticCurveTo(x - 2, y - h * 0.6, x + Math.sin(now / 70 + i) * 1.5, y - h); ctx.quadraticCurveTo(x + 2, y - h * 0.6, x + 2.5, y); ctx.fill();
      ctx.fillStyle = '#ffb020';
      ctx.beginPath(); ctx.moveTo(x - 1.2, y); ctx.quadraticCurveTo(x - 1, y - h * 0.4, x, y - h * 0.65); ctx.quadraticCurveTo(x + 1, y - h * 0.4, x + 1.2, y); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(255,110,30,${0.14 * fade})`;
  } else if (f.s === 'leechseed') {
    ctx.strokeStyle = `rgba(120,230,90,${0.6 * fade})`; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + now / 900, rr = f.r * (0.3 + (i % 3) * 0.25);
      const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 6, x + Math.sin(now / 200 + i) * 3, y - 10); ctx.stroke();
      ctx.fillStyle = `rgba(190,255,120,${0.9 * fade})`; ctx.fillRect(x - 1, y - 1, 3, 2);
    }
    ctx.fillStyle = `rgba(120,230,90,${0.12 * fade})`;
  } else ctx.fillStyle = hex(col, 0.15 * fade);
  ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function hit(R, f, t, now, col) {
  const ctx = R.ctx;
  const s = f.s;
  if (s === 'thunder') {
    // reuse the classic lightning bolt
    R.drawFxBolt(f, t);
    return;
  }
  if (s === 'sleeppowder' || s === 'yawn') {
    for (let j = 0; j < 14; j++) {
      const a = j * 2.4 + t * 2, d = f.r * ((j % 5) / 5 + 0.2);
      ctx.fillStyle = `rgba(250,${150 + (j % 3) * 30},220,${0.8 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7 - t * 8, 2.5 + (j % 3), 0, 7); ctx.fill();
    }
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (s === 'hurricane' || s === 'whirlwind') {
    ctx.strokeStyle = `rgba(220,230,255,${1 - t})`; ctx.lineWidth = 1.5;
    for (let j = 0; j < 4; j++) {
      const rr = f.r * (0.3 + j * 0.22) * (0.6 + t * 0.6);
      ctx.beginPath(); ctx.ellipse(f.x, f.y - j * 4, rr, rr * 0.45, 0, now / 80 + j, now / 80 + j + 4.2); ctx.stroke();
    }
  } else if (s === 'swift') {
    for (let j = 0; j < 10; j++) {
      const a = j * 0.63, d = f.r * (0.2 + t * 0.9);
      const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * 0.7;
      ctx.fillStyle = `rgba(255,240,120,${1 - t})`;
      ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
    }
  } else if (s === 'thunderwave') {
    ctx.strokeStyle = `rgba(255,240,90,${1 - t})`; ctx.lineWidth = 1.5;
    for (let j = 0; j < 2; j++) {
      const rr = f.r * Math.min(1, t * 1.5 + j * 0.3);
      ctx.beginPath();
      for (let a = 0; a <= 24; a++) {
        const ang = a / 24 * Math.PI * 2, w = rr + ((a % 2) ? 3 : -3);
        const x = f.x + Math.cos(ang) * w, y = f.y + Math.sin(ang) * w * 0.7;
        if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (s === 'selfdestruct') {
    ctx.fillStyle = `rgba(255,${200 - t * 120},${120 - t * 100},${0.8 * (1 - t)})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, f.r * (0.4 + t * 0.7), f.r * 0.7 * (0.4 + t * 0.7), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,230,${1 - t * 2})`;
    ctx.beginPath(); ctx.arc(f.x, f.y - 6, f.r * 0.35 * (1 - t), 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (let j = 0; j < 10; j++) {
      const a = j * 0.63, d = f.r * (0.3 + t * 1.1);
      ctx.fillStyle = `rgba(110,90,60,${1 - t})`;
      ctx.fillRect(f.x + Math.cos(a) * d - 1.5, f.y - 4 + Math.sin(a) * d * 0.6 - Math.sin(t * Math.PI) * 10, 3, 3);
    }
  } else if (s === 'bodyslam') {
    ctx.globalCompositeOperation = 'source-over';
    for (let j = 0; j < 14; j++) {
      const a = j * 0.45, d = f.r * (0.4 + t * 0.8);
      ctx.fillStyle = `rgba(200,190,170,${0.7 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.5, 2.5 + (j % 3), 0, 7); ctx.fill();
    }
  } else if (s === 'rockslide') {
    ctx.globalCompositeOperation = 'source-over';
    for (let j = 0; j < 12; j++) {
      const a = j * 0.52, d = f.r * (0.2 + t);
      ctx.fillStyle = `rgba(170,150,110,${0.8 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.6, 3 + (j % 3), 0, 7); ctx.fill();
    }
  } else {
    // generic burst in the skill's type colour
    ctx.fillStyle = hex(col, 0.35 * (1 - t));
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.5 + t * 0.5), f.r * 0.7 * (0.5 + t * 0.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hex(col, 1 - t); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.3 + t * 0.8), f.r * 0.7 * (0.3 + t * 0.8), 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Little status markers drawn over a Pokémon (burn, poison, paralysis, slow, buffs, Protect, charging).
export function drawStatus(R, e, x, top, cy, now) {
  const ctx = R.ctx;
  const t = now / 1000 + e.id;
  if (e.protect || (e.buffs && e.buffs.some((b) => b.key === 'protect'))) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(120,210,255,0.18)'; ctx.strokeStyle = 'rgba(170,235,255,0.7)'; ctx.lineWidth = 1;
    const r = e.radius + 6;
    ctx.beginPath(); ctx.ellipse(x, cy, r, r * 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (e.buffed || (e.buffs && e.buffs.some((b) => b.key !== 'aura' && b.key !== 'protect'))) {
    ctx.fillStyle = 'rgba(255,220,90,0.9)';
    for (let i = 0; i < 2; i++) {
      const k = (t * 1.3 + i * 0.5) % 1;
      ctx.fillRect(Math.round(x - 6 + i * 11), Math.round(cy + 4 - k * 18), 1, 3);
      ctx.fillRect(Math.round(x - 7 + i * 11), Math.round(cy + 5 - k * 18), 3, 1);
    }
  }
  if (e.burn) {
    const k = (t * 3) % 1;
    ctx.fillStyle = '#ff7a20'; ctx.fillRect(Math.round(x + 5), Math.round(top + 6 - k * 4), 2, 3);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(Math.round(x + 5), Math.round(top + 8 - k * 4), 2, 1);
  }
  if (e.poison) {
    const k = (t * 1.5) % 1;
    ctx.fillStyle = 'rgba(190,90,230,0.9)';
    ctx.beginPath(); ctx.arc(x - 5, top + 6 - k * 7, 1.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 3, top + 9 - ((k + 0.5) % 1) * 7, 1, 0, 7); ctx.fill();
  }
  if (e.stun > 0) {
    ctx.strokeStyle = '#fff36b'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const a = t * 9 + i * 3;
      const sx = x + Math.cos(a) * 7, sy = top + 4 + Math.sin(a) * 3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 3); ctx.lineTo(sx + 2, sy + 5); ctx.stroke();
    }
  }
  if (e.slow) {
    ctx.fillStyle = 'rgba(120,170,255,0.9)';
    ctx.fillRect(Math.round(x - 1), Math.round(top + 2 + ((t * 2) % 1) * 3), 2, 2);
  }
  if (e.charge) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,250,170,${0.3 + 0.2 * Math.sin(now / 60)})`;
    ctx.beginPath(); ctx.arc(x, cy, e.radius + 3, 0, 7); ctx.fill();
    ctx.restore();
  }
}
