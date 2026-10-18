// Scripted checks for V2 features: node tests/features.mjs
import { World, isFlying } from '../js/world.js';
import { FORMS, TILE, EVO_XP, BUILDINGS, RESEARCH, UNITS, squadSize, squadPop, reinforceCost, REINFORCE_DELAY, REINFORCE_TIME } from '../js/config.js';

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
w.issue(0, { c: 'research', id: lab.id, key: 'harvest' });
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
run(w, UNITS.pidgey.time + 1);
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
w.issue(0, { c: 'research', id: lab.id, key: 'megastone' });
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
w.issue(0, { c: 'research', id: lab.id, key: 'move_sleep' });
w.issue(0, { c: 'research', id: lab.id, key: 'move_thunder' });
run(w, 90);
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
ok(pika.hp > 40 && bulb.hp > 40, 'Heal Pulse healed nearby allies');

// snapshot round trip keeps forms, research and flags
const g = new World({ seed: 99, players: [{}, {}], sim: false });
g.applySnapshot(JSON.parse(JSON.stringify(w.snapshot())), 1);
const gr = g.ents.get(ray.id);
ok(gr && gr.form === 'megarayquaza' && g.players[0].research.megastone === 1, 'snapshot keeps forms and research');

// Dragon Ascent: Rayquaza flies up (untargetable), dives onto the target, damages and knocks back
P.research.move_ascent = 1;
const rq = w.addUnit('rayquaza', 0, 10 * TILE, 40 * TILE);
const victims = [0, 1, 2].map((i) => w.addUnit('snorlax', 1, 18 * TILE + i * 22, 40 * TILE));
w.buildHash();
const vx = victims.map((v) => v.x);
w.issue(0, { c: 'cast', ids: [rq.id], key: 'ascent', x: 18 * TILE + 10, y: 40 * TILE });
run(w, 0.5);
const archer = w.addUnit('bulbasaur', 1, rq.x + 20, rq.y);
ok(!!rq.ascend && rq.lift > 0 && !w.canHit(archer, rq), `Rayquaza is high in the sky and untargetable (lift ${Math.round(rq.lift)})`);
const mid = JSON.parse(JSON.stringify(w.snapshot()));
const g2 = new World({ seed: 99, players: [{}, {}], sim: false });
g2.applySnapshot(mid, 1);
ok(g2.ents.get(rq.id).ascend && g2.ents.get(rq.id).lift > 0, 'snapshot carries the ascent state to the guest');
let guard = 0;
while (rq.ascend && guard++ < 100) w.update(0.05);
ok(!rq.ascend && Math.hypot(rq.x - (18 * TILE + 10), rq.y - 40 * TILE) < 3, 'Rayquaza landed on the target spot');
ok(victims.every((v) => !w.ents.has(v.id) || v.hp < v.maxHp - 100), 'the dive hit every enemy in the area hard');
ok(victims.some((v, i) => w.ents.has(v.id) && Math.abs(v.x - vx[i]) > 2), 'enemies were knocked back');
ok(rq.acd > 0, 'Dragon Ascent is on cooldown');

// all research lives in the Lab; Snorlax is trained at the Gym
ok(Object.keys(RESEARCH).every((k) => BUILDINGS.lab.research.includes(k)) &&
  Object.keys(BUILDINGS).every((b) => b === 'lab' || !BUILDINGS[b].research), 'every research is at the Lab and only there');
ok(BUILDINGS.gym.trains.includes('snorlax') && !BUILDINGS.lab.trains, 'Snorlax is trained at the Gym');

// passive regeneration out of combat (share of max HP)
const reg = w.addUnit('snorlax', 0, 4 * TILE, 60 * TILE);
reg.hp = reg.maxHp * 0.5; reg.lastCombat = w.time;
run(w, 3);
ok(reg.hp === reg.maxHp * 0.5, 'no regeneration right after combat');
run(w, 5);
ok(reg.hp > reg.maxHp * 0.5 + reg.maxHp * 0.02 * 2, `regenerates out of combat (${Math.round(reg.hp)}/${reg.maxHp})`);

// Dragon Ascent life steal
rq.hp = rq.maxHp * 0.4;
rq.acd = 0;
const drainT = [0, 1].map((i) => w.addUnit('snorlax', 1, rq.x + 60 + i * 22, rq.y));
w.buildHash();
const hpBefore = rq.hp;
w.issue(0, { c: 'cast', ids: [rq.id], key: 'ascent', x: rq.x + 70, y: rq.y });
guard = 0;
w.update(0.05);
while (rq.ascend && guard++ < 100) w.update(0.05);
ok(rq.hp > hpBefore + 50, `Dragon Ascent drained life (${Math.round(hpBefore)} -> ${Math.round(rq.hp)})`);
void drainT;

// squads: trained together, share supply, XP and evolution, and refill fallen members
{
  const w3 = new World({ seed: 7, players: [{}, {}] });
  const Q = w3.players[0];
  Q.b = Q.c = 99999; Q.noFog = true; Q.gatherMult = 0;
  const c0 = w3.buildingsOf(0)[0];
  const gy = w3.addBuilding('gym', 0, c0.tx + 5, c0.ty, true);
  for (let i = 0; i < 4; i++) w3.addBuilding('mart', 0, c0.tx + i * 3, c0.ty + 6, true);
  w3.recount();
  const pop0 = Q.pop;
  w3.issue(0, { c: 'train', id: gy.id, type: 'charmander' });
  ok(Q.pop === pop0 + squadPop('charmander'), `a queued squad reserves supply for all members (${Q.pop - pop0})`);
  run(w3, UNITS.charmander.time + 1);
  const sq = [...w3.squads.values()].find((q) => q.type === 'charmander');
  const ms = sq ? w3.squadUnits(sq) : [];
  ok(sq && ms.length === squadSize('charmander') && ms.every((m) => m.sq === sq.id), `trained a Charmander squad of ${ms.length}`);
  ok(Q.pop === pop0 + squadPop('charmander'), 'the trained squad still holds its full supply');
  // moving keeps the squad together
  w3.issue(0, { c: 'move', ids: ms.map((m) => m.id), x: 30 * TILE, y: 30 * TILE });
  run(w3, 25);
  const spread = Math.max(...ms.map((m) => Math.hypot(m.x - ms[0].x, m.y - ms[0].y)));
  ok(spread < 40, `squad stays together on the move (spread ${Math.round(spread)}px)`);
  // shared XP: one member's damage counts for the squad
  const dummy = w3.addUnit('snorlax', 1, ms[0].x + 30, ms[0].y);
  w3.buildHash();
  w3.damage(dummy, 40, ms[0].id, 0);
  ok(Math.abs(sq.xp - 40 / sq.size) < 0.01 && ms.every((m) => Math.abs(m.xp - sq.xp) < 0.01), `squad shares XP (${sq.xp})`);
  w3.remove(dummy);
  // the whole squad evolves together
  Q.research.evo_charmeleon = 1;
  sq.xp = EVO_XP[1]; w3.tryEvolveSquad(sq);
  ok(ms.every((m) => m.form === 'charmeleon') && sq.form === 'charmeleon', 'the whole squad evolved into Charmeleon');
  // lose a member: it comes back out of combat, for a small price, already evolved
  const fallen = ms[3];
  w3.damage(fallen, 9999, dummy.id, 1);
  ok(sq.members.length === 3 && Q.pop === pop0 + squadPop('charmander'), 'a fallen member keeps its supply reserved');
  const b0 = Q.b, cost = reinforceCost('charmander');
  run(w3, REINFORCE_DELAY - 1);
  ok(sq.members.length === 3, 'no reinforcement right after combat');
  run(w3, REINFORCE_TIME + 2);
  const back = w3.squadUnits(sq);
  ok(back.length === 4 && back[3].form === 'charmeleon' && back[3].sq === sq.id, 'a fallen member was reinforced, already evolved');
  ok(Q.b === b0 - cost.b, `reinforcing cost ${cost.b} berries`);
  // a wiped-out squad is gone and frees its supply
  for (const m of back) w3.damage(m, 9999, 0, 1);
  w3.recount();
  ok(!w3.squads.has(sq.id) && Q.pop === pop0, 'a destroyed squad frees its supply');
  // snapshot keeps squads for the guest
  w3.issue(0, { c: 'train', id: gy.id, type: 'squirtle' });
  run(w3, UNITS.squirtle.time + 1);
  const g3 = new World({ seed: 7, players: [{}, {}], sim: false });
  g3.applySnapshot(JSON.parse(JSON.stringify(w3.snapshot())), 0);
  const gq = [...g3.squads.values()].find((q) => q.type === 'squirtle');
  ok(gq && gq.members.length === 4 && g3.ents.get(gq.members[0]).sq === gq.id, 'snapshot carries squads to the guest');
}

// destroying the last Pokémon Center ends the game, even if other buildings remain
const w2 = new World({ seed: 5, players: [{}, {}] });
const c1 = w2.buildingsOf(1)[0];
w2.addBuilding('mart', 1, c1.tx + 5, c1.ty, true);
w2.damage(c1, 99999, 0, 0);
ok(w2.winner === 0, `winner decided right when the last Center fell (winner ${w2.winner})`);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
