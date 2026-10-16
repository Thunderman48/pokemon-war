// Headless AI-vs-AI simulation smoke test: node tests/sim.mjs [seed] [diff0] [diff1]
import { World } from '../js/world.js';
import { AI } from '../js/ai.js';
import { UNITS, FORMS } from '../js/config.js';

const seed = +(process.argv[2] || 1234);
const d0 = process.argv[3] || 'normal', d1 = process.argv[4] || 'normal';
const w = new World({ seed, players: [{ name: 'A' }, { name: 'B' }] });
const ais = [new AI(w, 0, d0), new AI(w, 1, d1)];
const t0 = Date.now();
let lastMin = -1;
while (w.winner < 0 && w.time < 40 * 60) {
  for (const a of ais) a.update(0.05);
  w.update(0.05);
  const m = Math.floor(w.time / 60);
  if (m !== lastMin && m % 2 === 0) {
    lastMin = m;
    const line = w.players.map((p, i) => {
      const us = w.unitsOf(i);
      const army = us.filter((u) => !UNITS[u.type].worker);
      const evo = army.filter((u) => FORMS[u.form].stage > 0).length;
      return `P${i} b${Math.floor(p.b)} c${Math.floor(p.c)} pop${p.pop}/${p.cap} wk${us.length - army.length} army${army.length} evo${evo} bld${w.buildingsOf(i).length} k${p.stats.killed}`;
    }).join(' | ');
    console.log(`${m}m ${line}`);
  }
}
for (const i of [0, 1]) console.log(`P${i} research:`, JSON.stringify(w.players[i].research), 'forms:', [...new Set(w.unitsOf(i).map((u) => u.form))].join(','));
console.log(`winner=${w.winner} time=${(w.time / 60).toFixed(1)}m wall=${Date.now() - t0}ms ents=${w.ents.size}`);
