// Difficulty ladder check: node tests/difficulty.mjs [games] [stronger] [weaker]
// Plays AI vs AI with random decks, swapping sides, and reports wins and game length.
import { World } from '../js/world.js';
import { AI } from '../js/ai.js';

const games = +(process.argv[2] || 6), hi = process.argv[3] || 'hard', lo = process.argv[4] || 'normal';
let hiWins = 0, loWins = 0, draws = 0, mins = 0;
for (let g = 0; g < games; g++) {
  const seed = 500 + g * 131, hiSide = g % 2;
  const decks = [0, 1].map((p) => AI.deckFor(p === hiSide ? hi : lo, seed + p));
  const w = new World({ seed, players: [{ deck: decks[0] }, { deck: decks[1] }] });
  const ais = [0, 1].map((p) => new AI(w, p, p === hiSide ? hi : lo));
  while (w.winner < 0 && w.time < 30 * 60) {
    for (const a of ais) a.update(0.05);
    w.update(0.05);
  }
  const r = w.winner < 0 ? 'draw' : w.winner === hiSide ? hi : lo;
  if (r === hi) hiWins++; else if (r === lo) loWins++; else draws++;
  mins += w.time / 60;
  console.log(`game ${g}: ${r} at ${(w.time / 60).toFixed(1)}m (${decks[hiSide].name} vs ${decks[1 - hiSide].name})`);
}
console.log(`${hi} ${hiWins} - ${lo} ${loWins} - draws ${draws}, average ${(mins / games).toFixed(1)} min`);
