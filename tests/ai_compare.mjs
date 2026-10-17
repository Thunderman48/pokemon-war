// New AI vs the previous AI (tests/ai_baseline.mjs): node tests/ai_compare.mjs [games] [difficulty]
import { World } from '../js/world.js';
import { AI } from '../js/ai.js';
import { AI as OldAI } from './ai_baseline.mjs';

const games = +(process.argv[2] || 6), diff = process.argv[3] || 'normal';
let newWins = 0, oldWins = 0, draws = 0;
for (let g = 0; g < games; g++) {
  const seed = 1000 + g * 77;
  const newSide = g % 2; // swap sides every game
  const w = new World({ seed, players: [{ name: 'A' }, { name: 'B' }] });
  const ais = [0, 1].map((p) => (p === newSide ? new AI(w, p, diff) : new OldAI(w, p, diff)));
  while (w.winner < 0 && w.time < 35 * 60) {
    for (const a of ais) a.update(0.05);
    w.update(0.05);
  }
  const res = w.winner < 0 ? 'draw' : w.winner === newSide ? 'NEW' : 'old';
  if (res === 'NEW') newWins++; else if (res === 'old') oldWins++; else draws++;
  const k = w.players.map((p) => p.stats.killed);
  console.log(`game ${g} seed ${seed} new=P${newSide}: ${res} at ${(w.time / 60).toFixed(1)}m kills new ${k[newSide]} old ${k[1 - newSide]}`);
}
console.log(`${diff}: new ${newWins} - old ${oldWins} - draws ${draws}`);
