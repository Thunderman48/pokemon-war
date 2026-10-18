// Long AI-vs-AI game that never ends, to spot an AI that stops growing: node tests/longgame.mjs [seed] [minutes] [diff0] [diff1]
import { World } from '../js/world.js';
import { AI } from '../js/ai.js';
import { UNITS } from '../js/config.js';
const seed = +(process.argv[2] || 7), mins = +(process.argv[3] || 30), d0 = process.argv[4] || 'normal', d1 = process.argv[5] || 'normal';
const w = new World({ seed, players: [{ deck: AI.deckFor(d0, seed) }, { deck: AI.deckFor(d1, seed + 1) }] });
w.cheats = { noEnd: true };
const ais = [new AI(w, 0, d0), new AI(w, 1, d1)];
let last = -1;
while (w.time < mins * 60) {
  for (const a of ais) a.update(0.05);
  w.update(0.05);
  const m = Math.floor(w.time / 60);
  if (m !== last && m % 2 === 0) {
    last = m;
    console.log(`${m}m ` + [0, 1].map((i) => {
      const p = w.players[i], us = w.unitsOf(i), wk = us.filter((u) => UNITS[u.type].worker);
      const bl = w.buildingsOf(i);
      return `P${i} b${p.b | 0} c${p.c | 0} pop${p.pop}/${p.cap} wk${wk.length} army${us.length - wk.length} [${bl.map((b) => b.type[0] + (b.built ? '' : '*')).join('')}] ${ais[i].state}`;
    }).join(' | '));
  }
}
