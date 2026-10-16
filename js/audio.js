// Tiny chiptune-style sound effects with WebAudio (no audio files needed).
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('pw-muted') === '1'; } catch (e) { /* ignore */ }
const last = {};

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('pw-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
}

function tone(freq, dur, type = 'square', vol = 0.05, when = 0, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export function sfx(name) {
  if (!ctx || muted) return;
  const now = performance.now();
  const gap = { hit: 70, shot: 90, die: 80 }[name] || 40;
  if (last[name] && now - last[name] < gap) return;
  last[name] = now;
  switch (name) {
    case 'select': tone(880, 0.05, 'square', 0.03); break;
    case 'order': tone(660, 0.05, 'square', 0.03); tone(990, 0.06, 'square', 0.03, 0.05); break;
    case 'attack': tone(330, 0.08, 'sawtooth', 0.035); tone(220, 0.1, 'sawtooth', 0.035, 0.06); break;
    case 'shot': tone(700, 0.06, 'triangle', 0.025, 0, -400); break;
    case 'hit': tone(160, 0.06, 'square', 0.025, 0, -80); break;
    case 'die': tone(300, 0.2, 'sawtooth', 0.03, 0, -250); break;
    case 'breath': tone(520, 0.35, 'sawtooth', 0.035, 0, -420); tone(260, 0.4, 'square', 0.025, 0.05, -200); break;
    case 'ascent': tone(200, 0.9, 'sawtooth', 0.04, 0, 900); tone(400, 0.9, 'square', 0.025, 0.05, 1200); break;
    case 'dive': tone(1400, 0.4, 'sawtooth', 0.035, 0, -1200); break;
    case 'quake': tone(90, 0.9, 'sawtooth', 0.08, 0, -60); tone(55, 1.1, 'square', 0.07, 0.03, -30); tone(700, 0.2, 'triangle', 0.04, 0, -600); tone(160, 0.5, 'sawtooth', 0.05, 0.15, -120); break;
    case 'boom': tone(110, 0.45, 'sawtooth', 0.06, 0, -80); tone(70, 0.6, 'square', 0.05, 0.02, -45); tone(900, 0.12, 'triangle', 0.03, 0, -700); break;
    case 'build': [523, 659, 784].forEach((f, i) => tone(f, 0.1, 'square', 0.03, i * 0.08)); break;
    case 'train': tone(523, 0.06, 'square', 0.03); tone(784, 0.08, 'square', 0.03, 0.06); break;
    case 'error': tone(180, 0.12, 'square', 0.04); break;
    case 'alert': [880, 660, 880, 660].forEach((f, i) => tone(f, 0.09, 'square', 0.04, i * 0.1)); break;
    case 'evolve': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.035, i * 0.09)); break;
    case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.04, i * 0.13)); break;
    case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.05, i * 0.2)); break;
  }
}
