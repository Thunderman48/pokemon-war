// Scripted checks for V2 features: node tests/features.mjs
import { World, isFlying } from '../js/world.js';
import { FORMS, TILE, EVO_XP } from '../js/config.js';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const run = (w, secs) => { for (let i = 0; i < secs * 20; i++) w.update(0.05); };

const w = new World({ seed: 99, players: [{}, {}] });
const P = w.players[0];
P.b = P.c = 99999;
P.noFog = true;
const place = (type, near) => {
  for (let r = 4; r < 20; r++) for (let y = near.y - r; y <= near.y + r; y++) for (let x = near.x - r; x <= near.x + r; x++)
    if (w.canPlace(type, x, y, 0)) { const b = w.addBuilding(type, 0, x, y, true); w.recount(); return b; }
};
const home = { x: 9, y: 9 };
for (let i = 0; i < 6; i++) place('mart', home);
const gym = place('gym', home), lab = place('lab', home), pillar = place('skypillar', home), center = w.buildingsOf(0)[0];
ok(gym && lab && pillar, 'placed gym, lab, sky pillar');

// research gating for evolution
const ch = w.addUnit('charmander', 0, 200, 200);
ch.xp = 500; w.tryEvolve(ch);
ok(ch.form === 'charmander', 'Charmander does not evolve without research');
w.issue(0, { c: 'research', id: lab.id, key: 'evo_charizard' });
ok(!lab.queue.length, 'Charizard research blocked until Charmeleon is researched');
w.issue(0, { c: 'research', id: lab.id, key: 'evo_charmeleon' });
run(w, 31);
ok(ch.form === 'charmeleon', `Charmander evolved after research (now ${ch.form})`);
w.issue(0, { c: 'research', id: lab.id, key: 'evo_charizard' });
run(w, 46);
ok(ch.form === 'charizard' && isFlying(ch), 'Charmeleon -> Charizard, and Charizard flies');

// tiered research
w.issue(0, { c: 'research', id: lab.id, key: 'attack' });
run(w, 41);
w.issue(0, { c: 'research', id: lab.id, key: 'attack' });
run(w, 51);
ok(P.research.attack === 2, `Attack research reached level ${P.research.attack}`);

// Eevee choice
w.issue(0, { c: 'research', id: lab.id, key: 'waterstone' });
w.issue(0, { c: 'research', id: center.id, key: 'harvest' });
run(w, 36);
const ee = w.addUnit('eevee', 0, 220, 220);
ee.xp = EVO_XP[1]; w.tryEvolve(ee);
ok(ee.form === 'eevee' && ee.evoReady, 'Eevee waits for the player to choose');
w.issue(0, { c: 'evolve', id: ee.id, to: 'jolteon' });
ok(ee.form === 'eevee', 'cannot pick Jolteon without Thunder Stone');
w.issue(0, { c: 'evolve', id: ee.id, to: 'vaporeon' });
ok(ee.form === 'vaporeon', 'Eevee -> Vaporeon');

// flying over water/trees: send a Pidgey across the map in a straight line
w.issue(0, { c: 'train', id: pillar.id, type: 'pidgey' });
run(w, 17);
const pg = w.unitsOf(0).find((u) => u.type === 'pidgey');
ok(!!pg, 'Pidgey trained at the Sky Pillar');
w.issue(0, { c: 'move', ids: [pg.id], x: 60 * TILE, y: 4 * TILE, attack: false });
run(w, 20);
ok(Math.hypot(pg.x - 60 * TILE, pg.y - 4 * TILE) < 20, `Pidgey flew to the far corner (${(pg.x / TILE) | 0},${(pg.y / TILE) | 0})`);

// melee can't hit flyers
const enemyMachop = w.addUnit('machop', 1, pg.x + 4, pg.y + 4);
w.buildHash();
ok(!w.canHit(enemyMachop, pg) && w.canHit(pg, enemyMachop), 'melee Machop cannot hit a flyer, flyer can hit it');

// Rayquaza limit + mega evolution
w.issue(0, { c: 'train', id: pillar.id, type: 'rayquaza' });
w.issue(0, { c: 'train', id: pillar.id, type: 'rayquaza' });
ok(pillar.queue.filter((q) => q.u === 'rayquaza').length === 1, 'only one Rayquaza allowed');
run(w, 61);
const ray = w.unitsOf(0).find((u) => u.type === 'rayquaza');
ok(!!ray && isFlying(ray), 'Rayquaza trained and flies');
w.issue(0, { c: 'research', id: pillar.id, key: 'megastone' });
run(w, 61);
ray.xp = EVO_XP[1]; w.tryEvolve(ray);
ok(ray.form === 'megarayquaza', `Rayquaza -> Mega Rayquaza (${ray.form}, hp ${ray.maxHp})`);

// splash damage: Mega Rayquaza vs a clump of enemies
const clump = [0, 1, 2, 3].map((i) => w.addUnit('squirtle', 1, 40 * TILE + (i % 2) * 12, 40 * TILE + (i >> 1) * 12));
ray.x = 40 * TILE - 50; ray.y = 40 * TILE;
w.issue(0, { c: 'target', ids: [ray.id], target: clump[0].id });
run(w, 3);
const hurt = clump.filter((u) => u.hp < u.maxHp || !w.ents.has(u.id)).length;
ok(hurt >= 3, `Dragon Breath splash hit ${hurt}/4 enemies`);

// special moves
w.issue(0, { c: 'research', id: gym.id, key: 'move_sleep' });
w.issue(0, { c: 'research', id: gym.id, key: 'move_thunder' });
run(w, 80);
const bulb = w.addUnit('bulbasaur', 0, 20 * TILE, 30 * TILE);
const pika = w.addUnit('pikachu', 0, 20 * TILE, 31 * TILE);
const targets = [0, 1, 2].map((i) => w.addUnit('charmander', 1, 24 * TILE + i * 10, 30 * TILE));
w.buildHash();
w.issue(0, { c: 'cast', ids: [bulb.id], key: 'sleep', x: 24 * TILE + 10, y: 30 * TILE });
run(w, 0.2);
ok(targets.every((t) => t.sleep > 0), 'Sleep Powder put all 3 enemies to sleep');
const before = targets.map((t) => t.hp);
w.issue(0, { c: 'cast', ids: [pika.id], key: 'thunder', x: 24 * TILE + 10, y: 30 * TILE });
run(w, 1);
ok(targets.every((t, i) => !w.ents.has(t.id) || t.hp < before[i] - 40), 'Thunder hit the whole group');
ok(pika.acd > 0, 'Thunder is on cooldown');
const wart = w.addUnit('squirtle', 0, 20 * TILE, 33 * TILE);
P.research.move_heal = 1;
pika.hp = 10; bulb.hp = 10;
w.issue(0, { c: 'cast', ids: [wart.id], key: 'heal', x: 20 * TILE, y: 31 * TILE });
run(w, 0.2);
ok(pika.hp > 50 && bulb.hp > 50, 'Heal Pulse healed nearby allies');

// snapshot round trip keeps forms, research and flags
const g = new World({ seed: 99, players: [{}, {}], sim: false });
g.applySnapshot(JSON.parse(JSON.stringify(w.snapshot())), 1);
const gr = g.ents.get(ray.id);
ok(gr && gr.form === 'megarayquaza' && g.players[0].research.megastone === 1, 'snapshot keeps forms and research');

// destroying the last Pokémon Center ends the game, even if other buildings remain
const w2 = new World({ seed: 5, players: [{}, {}] });
const c1 = w2.buildingsOf(1)[0];
w2.addBuilding('mart', 1, c1.tx + 5, c1.ty, true);
w2.damage(c1, 99999, 0, 0);
ok(w2.winner === 0, `winner decided right when the last Center fell (winner ${w2.winner})`);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
