// Mega Evolution visuals: the transformation, the burst, Mega auras, the Mega symbol and the stormy sky.
import { FORMS, TILE, MEGA } from './config.js';

export function megaFxLife(f) {
  if (f.k === 'megaevo') return f.d;
  if (f.k === 'megaburst') return 1.4;
  if (f.k === 'stormbolt') return 0.55;
  return 0;
}

const RAINBOW = ['#ff4d6d', '#ff9f43', '#ffe14d', '#5ee05e', '#4dc3ff', '#8f6bff'];

export function drawMegaFx(R, f, t, now) {
  const ctx = R.ctx;
  if (f.k === 'megaevo') {
    // a glowing shell with rainbow DNA ribbons spiralling around the Pokémon
    const u = R.world.ents.get(f.id);
    const x = u ? u.rx ?? u.x : f.x;
    const y = (u ? (u.ry ?? u.y) - R.lift(u, now) : f.y) - 10;
    const big = u ? Math.max(14, u.radius * 2.2) : 16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 2, x, y, big * (0.9 + t * 0.5));
    g.addColorStop(0, `rgba(255,255,255,${0.35 + t * 0.55})`);
    g.addColorStop(0.6, `rgba(190,170,255,${0.25 + t * 0.25})`);
    g.addColorStop(1, 'rgba(120,90,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, big * (0.9 + t * 0.5), 0, 7); ctx.fill();
    // two DNA strands of rainbow beads
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 14; i++) {
        const k = i / 14;
        const a = now / 140 + k * Math.PI * 4 + s * Math.PI;
        const rr = big * (1.1 - t * 0.4);
        const bx = x + Math.cos(a) * rr, by = y + (k - 0.5) * big * 2.2 + Math.sin(a) * 3;
        ctx.fillStyle = RAINBOW[(i + s * 3) % 6];
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a) ** 2;
        ctx.fillRect(Math.round(bx - 1), Math.round(by - 1), 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    // light rays building up
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + t * 0.6})`; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + now / 400;
      const r0 = big * 0.6, r1 = big * (1.2 + t);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
    // the Mega symbol pulses above
    megaSymbol(ctx, x, y - big - 8, 1 + Math.sin(now / 80) * 0.15 + t * 0.4);
    return;
  }
  if (f.k === 'megaburst') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // rainbow shock rings
    for (let i = 0; i < 3; i++) {
      const k = Math.min(1, t * 1.6 - i * 0.12);
      if (k <= 0) continue;
      const rr = f.r * k;
      ctx.strokeStyle = RAINBOW[(i * 2) % 6]; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 - i;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 6, rr, rr * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (t < 0.4) {
      const k = 1 - t / 0.4, rr = 14 + (1 - k) * 22;
      const g = ctx.createRadialGradient(f.x, f.y - 10, 1, f.x, f.y - 10, rr);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * k})`);
      g.addColorStop(0.5, `rgba(255,240,200,${0.5 * k})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y - 10, rr, 0, 7); ctx.fill();
    }
    // sparks
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, d = f.r * 0.3 + t * f.r * 0.9;
      ctx.fillStyle = RAINBOW[i % 6]; ctx.globalAlpha = 1 - t;
      ctx.fillRect(f.x + Math.cos(a) * d - 1, f.y - 8 + Math.sin(a) * d * 0.7 - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }
  if (f.k === 'stormbolt') {
    // a lightning bolt out of the storm clouds
    const x = f.x, y = f.y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (t < 0.4) {
      for (let j = 0; j < 2; j++) {
        ctx.strokeStyle = j ? '#fff7a0' : '#ffffff'; ctx.lineWidth = j ? 3 : 1.5;
        ctx.beginPath();
        let bx = x, by = y - 130;
        ctx.moveTo(bx, by);
        for (let k = 1; k <= 8; k++) {
          bx = x + (((k * 53 + f.x) % 11) - 5) * 1.8 * (1 - k / 9);
          by = y - 130 + k * 16.25;
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(255,255,200,${0.6 * (1 - t)})`;
    ctx.beginPath(); ctx.ellipse(x, y, 10 + t * 8, 6 + t * 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// The Mega Evolution symbol: a rainbow orb with a DNA swirl.
export function megaSymbol(ctx, x, y, s = 1) {
  const r = 4 * s;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = '#1b1730';
  ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, 7); ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = RAINBOW[i];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i / 6 * Math.PI * 2, (i + 1) / 6 * Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.fill();
  ctx.strokeStyle = '#1b1730'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.45, Math.PI * 0.2, Math.PI * 1.2); ctx.stroke();
  ctx.restore();
}

// Auras around Mega Pokémon, drawn under the sprite (ground) and over it.
export function drawMegaAura(R, e, x, y, top, now) {
  const ctx = R.ctx;
  const t = now / 1000;
  const f = e.form;
  ctx.save();
  if (f === 'megacharizard') {
    // harsh sunlight: a warm glow with rays
    const r = 5 * TILE;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, 'rgba(255,200,90,0.28)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,120,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + t * 0.4;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 10); ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.63); ctx.stroke();
    }
    // scorched sparks on the ground
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4 + t, d = (i * 9 % 5 + 1) / 6 * r;
      ctx.fillStyle = `rgba(255,${120 + (i % 3) * 40},40,${0.5 + 0.5 * Math.sin(t * 6 + i)})`;
      ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.7 - ((t * 10 + i) % 6)), 2, 2);
    }
  } else if (f === 'megablastoise') {
    ctx.strokeStyle = 'rgba(140,200,255,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1, r = 12 + k * 30;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (f === 'megavenusaur') {
    // pollen drifting in the field
    const r = 4.5 * TILE;
    ctx.fillStyle = 'rgba(120,220,90,0.08)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 18; i++) {
      const a = i * 1.7 + t * 0.3, d = ((i * 37) % 10) / 10 * r;
      ctx.fillStyle = i % 2 ? 'rgba(255,170,220,0.85)' : 'rgba(255,240,120,0.85)';
      ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.7 - 6 - Math.sin(t * 2 + i) * 4), 2, 2);
    }
  } else if (f === 'megapidgeot') {
    // a tornado spinning around Mega Pidgeot
    const r = 5 * TILE;
    ctx.strokeStyle = 'rgba(230,235,255,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const rr = r * (0.3 + i * 0.16);
      ctx.beginPath(); ctx.ellipse(x, y - i * 3, rr, rr * 0.45, 0, -t * 5 + i, -t * 5 + i + 3.2); ctx.stroke();
    }
  } else if (f === 'megarayquaza') {
    // Delta Stream: wind streams and rain around the dragon
    ctx.strokeStyle = 'rgba(200,230,255,0.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const a = t * 3 + i * 0.9, rr = 30 + (i % 3) * 18;
      ctx.beginPath(); ctx.ellipse(x, top + 20, rr, rr * 0.35, 0, a, a + 1.4); ctx.stroke();
    }
  }
  ctx.restore();
}

// The darkened, stormy sky while Mega Rayquaza is out (screen space).
export function drawSky(R, now) {
  const ctx = R.ctx;
  const target = R.world.sky > 0 ? 1 : 0;
  R.skyK = (R.skyK || 0) + (target - (R.skyK || 0)) * 0.04;
  if (R.skyK < 0.01) return;
  const k = R.skyK;
  const W = R.vw, H = R.vh;
  ctx.fillStyle = `rgba(14,16,40,${0.42 * k})`;
  ctx.fillRect(0, 0, W, H);
  // rain
  ctx.strokeStyle = `rgba(170,200,255,${0.35 * k})`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = (i * 97 + now * 0.35) % (W + 40) - 20, y = (i * 53 + now * 0.9) % (H + 40) - 20;
    ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 10);
  }
  ctx.stroke();
  // distant lightning flashes
  const ph = (now / 1000) % 3.7;
  if (ph < 0.12 || (ph > 0.2 && ph < 0.26)) {
    ctx.fillStyle = `rgba(220,230,255,${0.18 * k})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function megaTimeLeft(sq) {
  return Math.max(0, (sq.megaCd || 0) - MEGA.cd);
}
export const isMegaForm = (form) => !!FORMS[form].isMega;
