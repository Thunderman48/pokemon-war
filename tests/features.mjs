// Scripted checks for V2 features: node tests/features.mjs
import { World, isFlying } from '../js/world.js';
import { SKILLS, DECK_POOL, AI_DECKS, validDeck, MEGA, FORMS, TILE, EVO_XP, BUILDINGS, RESEARCH, UNITS, squadSize, squadPop, reinforceCost, REINFORCE_DELAY, REINFORCE_TIME } from '../js/config.js';

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

// only Pokémon in the deck can be trained
w.issue(0, { c: 'train', id: gym.id, type: 'pidgey' });
ok(!gym.queue.length, 'Pokémon outside the deck cannot be trained');
P.deck.slots[5] = { line: 'pidgey', skills: ['hurricane', 'roost', 'keeneye'], item: 'pidgeotite' };
P.deckKey = 'pidgey';
// flying over water/trees: send a Pidgey across the map in a straight line
w.issue(0, { c: 'train', id: gym.id, type: 'pidgey' });
run(w, UNITS.pidgey.time + 1);
const pg = w.unitsOf(0).find((u) => u.type === 'pidgey');
ok(!!pg, 'Pidgey squad trained at the Gym');
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
const raySq = w.squadOf(ray);
w.issue(0, { c: 'mega', ids: [ray.id] });
ok(!ray.mega, 'no Mega Evolution without the Key Stone');
w.issue(0, { c: 'research', id: lab.id, key: 'keystone' });
run(w, RESEARCH.keystone.time + 1);
w.issue(0, { c: 'mega', ids: [ray.id] });
ok(ray.mega && ray.mega.phase === 'transform', 'Rayquaza starts Mega Evolving (no stone needed)');
const rhp = ray.hp;
w.damage(ray, 500, 0, 1);
ok(ray.hp === rhp, 'invincible while transforming');
run(w, MEGA.transform + 0.1);
ok(ray.form === 'megarayquaza' && ray.mega.phase === 'on', `Rayquaza -> Mega Rayquaza (${ray.form}, hp ${Math.round(ray.maxHp)})`);
run(w, 0.2);
ok(w.sky > 0, 'the sky darkens while Mega Rayquaza is out');
ok(raySq.megaCd > MEGA.time, 'Mega Evolution is on cooldown');

// splash damage: Mega Rayquaza vs a clump of enemies
const clump = [0, 1, 2, 3].map((i) => w.addUnit('squirtle', 1, 40 * TILE + (i % 2) * 12, 40 * TILE + (i >> 1) * 12));
ray.x = 40 * TILE - 50; ray.y = 40 * TILE;
w.issue(0, { c: 'target', ids: [ray.id], target: clump[0].id });
run(w, 3);
const hurt = clump.filter((u) => u.hp < u.maxHp || !w.ents.has(u.id)).length;
ok(hurt >= 3, `Dragon Breath splash hit ${hurt}/4 enemies`);

// skills: researched at the Lab, cast by a squad (auto-cast off here so the test aims them)
for (const k of ['sleeppowder', 'thunder', 'healpulse', 'ascent']) P.research['sk_' + k] = 1;
const bsq = w.addSquad('bulbasaur', 0, 20 * TILE, 30 * TILE); bsq.auto = false;
const psq = w.addSquad('pikachu', 0, 20 * TILE, 31 * TILE); psq.auto = false;
const targets = [0, 1, 2].map((i) => w.addUnit('charmander', 1, 24 * TILE + i * 10, 30 * TILE));
w.buildHash();
w.issue(0, { c: 'cast', ids: bsq.members, key: 'sleeppowder', x: 24 * TILE + 10, y: 30 * TILE });
run(w, 0.3);
ok(targets.every((t) => t.sleep > 0), 'Sleep Powder put all 3 enemies to sleep');
ok(bsq.cds.sleeppowder > 0, 'the squad shares the Sleep Powder cooldown');
const before = targets.map((t) => t.hp);
w.issue(0, { c: 'cast', ids: psq.members, key: 'thunder', x: 24 * TILE + 10, y: 30 * TILE });
run(w, 1);
ok(targets.every((t, i) => !w.ents.has(t.id) || t.hp < before[i] - 40), 'Thunder hit the whole group');
ok(psq.cds.thunder > 0, 'Thunder is on cooldown');
const ssq = w.addSquad('squirtle', 0, 20 * TILE, 33 * TILE); ssq.auto = false;
const hurtM = [...w.squadUnits(psq), ...w.squadUnits(bsq)];
for (const m of hurtM) m.hp = 10;
w.issue(0, { c: 'cast', ids: ssq.members, key: 'healpulse', x: 20 * TILE, y: 31 * TILE });
run(w, 0.3);
ok(hurtM.filter((m) => m.hp > 40).length >= 5, 'Heal Pulse healed nearby allies');

// snapshot round trip keeps forms, research and flags
const g = new World({ seed: 99, players: [{}, {}], sim: false });
g.applySnapshot(JSON.parse(JSON.stringify(w.snapshot())), 1);
const gr = g.ents.get(ray.id);
ok(gr && gr.form === 'megarayquaza' && g.players[0].research.keystone === 1 && gr.mega && g.sky > 0, 'snapshot keeps forms, research, Mega state and the dark sky');

// Dragon Ascent: Rayquaza flies up (untargetable), dives onto the target, damages and knocks back
const rsq = w.addSquad('rayquaza', 0, 10 * TILE, 40 * TILE); rsq.auto = false;
const rq = w.leaderOf(rsq);
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
ok(rsq.cds.ascent > 0, 'Dragon Ascent is on cooldown');

// all research lives in the Lab; Snorlax is trained at the Gym
ok(Object.keys(RESEARCH).every((k) => BUILDINGS.lab.research.includes(k)) &&
  Object.keys(BUILDINGS).every((b) => b === 'lab' || !BUILDINGS[b].research), 'every research is at the Lab and only there');
ok(BUILDINGS.gym.trains.includes('snorlax') && !BUILDINGS.lab.trains, 'Snorlax is trained at the Gym');

// passive regeneration out of combat (share of max HP)
const reg = w.addUnit('squirtle', 0, 4 * TILE, 60 * TILE);
reg.hp = reg.maxHp * 0.5; reg.lastCombat = w.time;
run(w, 3);
ok(reg.hp === reg.maxHp * 0.5, 'no regeneration right after combat');
run(w, 5);
ok(reg.hp > reg.maxHp * 0.5 + reg.maxHp * 0.02 * 2, `regenerates out of combat (${Math.round(reg.hp)}/${reg.maxHp})`);

// Dragon Ascent life steal
rq.hp = rq.maxHp * 0.4;
rsq.cds = {};
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

// skill engine: passives, statuses, every active type, auto-cast
{
  const w4 = new World({ seed: 11, players: [{}, {}] });
  const A = w4.players[0], B = w4.players[1];
  A.noFog = B.noFog = true;
  const at = (x, y) => ({ x: x * TILE, y: y * TILE });
  const sq = (type, pid, x, y) => { const q = w4.addSquad(type, pid, x * TILE, y * TILE); q.auto = false; return q; };
  const dummy = (pid, x, y, type = 'snorlax') => w4.addUnit(type, pid, x * TILE, y * TILE);
  ok(w4.researchBlock(0, 'sk_solarpower') === 'Not in your deck', 'skills outside the deck cannot be researched');
  ok(!w4.researchBlock(0, 'sk_flamethrower'), 'deck skills can be researched');
  // passive: Shell Armor cuts damage once researched
  const sh = sq('squirtle', 0, 30, 10);
  const m0 = w4.leaderOf(sh);
  const hp0 = m0.hp; w4.damage(m0, 20, 0, 1); const plain = hp0 - m0.hp;
  A.research.sk_shellarmor = 1;
  const hp1 = m0.hp; w4.damage(m0, 20, 0, 1); const armored = hp1 - m0.hp;
  ok(Math.abs(armored - plain * 0.8) < 0.01, `Shell Armor: ${plain} -> ${armored.toFixed(1)} damage`);
  // passive: Delta Stream only cuts ranged damage
  const rq = w4.leaderOf(sq('rayquaza', 0, 40, 10));
  A.research.sk_deltastream = 1;
  let h = rq.hp; w4.damage(rq, 100, 0, 1, { ranged: true }); const ranged = h - rq.hp;
  h = rq.hp; w4.damage(rq, 100, 0, 1, { contact: true }); const melee = h - rq.hp;
  ok(Math.abs(ranged - 60) < 0.01 && Math.abs(melee - 100) < 0.01, `Delta Stream: ranged ${ranged}, melee ${melee}`);
  // passive HP boost applies to workers already on the field
  const wk = w4.unitsOf(0).find((u) => u.type === 'machop');
  const wmax = wk.maxHp;
  w4.completeResearch(0, 'sk_bulkup');
  ok(wk.maxHp === Math.round(wmax * 1.6), `Bulk Up raised worker HP ${wmax} -> ${wk.maxHp}`);
  // line: Flamethrower burns
  A.research.sk_flamethrower = 1;
  const ch = sq('charmander', 0, 10, 30);
  const v1 = dummy(1, 14, 30);
  w4.buildHash();
  const vh = v1.hp;
  w4.issue(0, { c: 'cast', ids: ch.members, key: 'flamethrower', x: v1.x, y: v1.y });
  run(w4, 0.2);
  ok(v1.hp < vh - 40 && v1.burn, `Flamethrower hit (${Math.round(vh - v1.hp)}) and burned`);
  const vb = v1.hp; run(w4, 2.5);
  ok(v1.hp < vb, 'burn deals damage over time');
  // cone: Dragon Breath
  A.research.sk_dragonbreath = 1;
  const v2 = [0, 1, 2].map((i) => dummy(1, 44 + i * 0.6, 10 + (i - 1) * 0.8));
  w4.buildHash();
  const v2h = v2.map((v) => v.hp);
  w4.issue(0, { c: 'cast', ids: [rq.id], key: 'dragonbreath', x: 45 * TILE, y: 10 * TILE });
  run(w4, 0.2);
  ok(v2.every((v, i) => v.hp < v2h[i] - 40), 'Dragon Breath hit a whole group in a cone');
  // zone: Fire Spin keeps burning
  A.research.sk_firespin = 1;
  ch.cds = {};
  const v3 = dummy(1, 12, 34);
  v3.stun = 10; // hold still in the fire
  w4.buildHash();
  const v3h = v3.hp;
  w4.issue(0, { c: 'cast', ids: ch.members, key: 'firespin', x: v3.x, y: v3.y });
  run(w4, 4);
  ok(v3.hp < v3h - 30, `Fire Spin burned for several seconds (${Math.round(v3h - v3.hp)})`);
  // dash: Rollout carries the squad into the enemy
  A.research.sk_rollout = 1;
  const gd = sq('geodude', 0, 20, 50);
  const v4 = dummy(1, 25, 50);
  w4.buildHash();
  const v4h = v4.hp, gx = w4.leaderOf(gd).x;
  w4.issue(0, { c: 'cast', ids: gd.members, key: 'rollout', x: v4.x, y: v4.y });
  run(w4, 1);
  ok(w4.leaderOf(gd).x > gx + 50 && v4.hp < v4h, 'Rollout dashed into the enemy and hit it');
  // buff: Protect
  A.research.sk_protect = 1;
  A.deck.slots.find((x) => x.line === 'squirtle').skills = ['healpulse', 'protect', 'shellarmor'];
  A.deckKey = 'custom';
  w4.issue(0, { c: 'cast', ids: sh.members, key: 'protect', x: 0, y: 0 });
  run(w4, 0.1);
  const pm = w4.leaderOf(sh);
  h = pm.hp; w4.damage(pm, 20, 0, 1);
  ok(Math.abs((h - pm.hp) - 20 * 0.8 * 0.35) < 0.01, 'Protect cut damage by 65% (with Shell Armor)');
  // status: Thunder Wave paralyzes (stunned units don't attack)
  A.research.sk_thunderwave = 1;
  const pk = sq('pikachu', 0, 50, 40);
  const v5 = dummy(1, 54, 40, 'charmander');
  w4.buildHash();
  w4.issue(0, { c: 'cast', ids: pk.members, key: 'thunderwave', x: v5.x, y: v5.y });
  run(w4, 0.2);
  ok(v5.stun > 1, 'Thunder Wave paralyzed the target');
  // immunity: Snorlax with Immunity ignores sleep
  B.research.sk_immunity = 1;
  B.deck.slots.find((x) => x.line === 'snorlax').skills = ['bodyslam', 'rest', 'immunity'];
  B.deckKey = 'custom';
  const sn = dummy(1, 56, 40);
  applyStatusTest(w4, sn);
  // auto-cast: a squad with AUTO on uses its skill by itself
  A.research.sk_swift = 1;
  A.deck.slots[7] = { line: 'eevee', skills: ['quickattack', 'swift', 'adaptability'], item: 'eviolite' }; A.deckKey = 'eevee';
  const ev = w4.addSquad('eevee', 0, 30 * TILE, 55 * TILE);
  const v6 = [0, 1].map((i) => dummy(1, 33, 55 + i * 0.5, 'charmander'));
  w4.buildHash();
  run(w4, 2);
  ok(ev.cds.swift > 0, 'auto-cast fired Swift on its own');
  void at;
}
function applyStatusTest(w, u) {
  w.buildHash();
  u.sleep = 0;
  const q = w.addSquad('bulbasaur', 0, u.x - 40, u.y); q.auto = false;
  w.players[0].research.sk_sleeppowder = 1;
  w.issue(0, { c: 'cast', ids: q.members, key: 'sleeppowder', x: u.x, y: u.y });
  run(w, 0.3);
  ok(!(u.sleep > 0), 'Immunity blocks Sleep Powder');
}

// Mega Evolution needs the stone; Megas wear off; items work
{
  const w5 = new World({ seed: 21, players: [{}, {}] });
  const A = w5.players[0];
  A.noFog = true; A.research.keystone = 1; A.research.evo_charmeleon = 1; A.research.evo_charizard = 1;
  const q = w5.addSquad('charmander', 0, 30 * TILE, 30 * TILE); q.auto = false;
  w5.issue(0, { c: 'mega', ids: q.members });
  ok(!w5.leaderOf(q).mega, 'Charmander must be fully evolved to Mega Evolve');
  q.xp = EVO_XP[2]; w5.tryEvolveSquad(q);
  ok(w5.leaderOf(q).form === 'charizard', 'squad evolved to Charizard');
  A.deck.slots.find((s) => s.line === 'charmander').item = 'choiceband'; A.deckKey = 'x1';
  w5.issue(0, { c: 'mega', ids: q.members });
  ok(!w5.leaderOf(q).mega, 'no Mega Evolution without Charizardite');
  A.deck.slots.find((s) => s.line === 'charmander').item = 'charizardite'; A.deckKey = 'x2';
  w5.issue(0, { c: 'mega', ids: q.members });
  const lead = w5.leaderOf(q);
  ok(lead.mega && w5.squadUnits(q).filter((m) => m.mega).length === 1, 'only the squad leader Mega Evolves');
  const foes = [0, 1, 2].map((i) => w5.addUnit('bulbasaur', 1, lead.x + 30 + i * 8, lead.y + 10));
  w5.buildHash();
  const fx0 = foes.map((f) => f.x);
  run(w5, MEGA.transform + 0.1);
  ok(lead.form === 'megacharizard', 'Charizard -> Mega Charizard Y');
  ok(foes.some((f, i) => !w5.ents.has(f.id) || f.x > fx0[i] + 5), 'the Mega entrance blast knocked enemies back');
  run(w5, 2.5);
  ok(foes.some((f) => !w5.ents.has(f.id) || f.burn), 'harsh sunlight burns enemies nearby');
  run(w5, MEGA.time);
  ok(lead.form === 'charizard' && !lead.mega, 'Mega Evolution wears off after its time');
  w5.issue(0, { c: 'mega', ids: q.members });
  ok(!lead.mega && q.megaCd > 0, 'and has to recharge');
  // items
  A.deck.slots.find((s) => s.line === 'charmander').item = 'choiceband'; A.deckKey = 'x3';
  ok(Math.abs(w5.stats(lead).dmg / w5.stats({ ...lead, owner: 1 }).dmg - 1.25) < 0.01, 'Choice Band: +25% damage');
  A.deck.slots[7] = { line: 'eevee', skills: ['quickattack', 'swift', 'adaptability'], item: 'eviolite' }; A.deckKey = 'eevee';
  const ev = w5.addSquad('eevee', 0, 10 * TILE, 50 * TILE);
  const em = w5.leaderOf(ev);
  let h = em.hp; w5.damage(em, 20, 0, 1);
  ok(Math.abs((h - em.hp) - 14) < 0.01, 'Eviolite: unevolved Eevee takes 30% less');
  A.deck.slots.find((s) => s.line === 'geodude').item = 'rockyhelmet'; A.deckKey = 'x4';
  const gd = w5.leaderOf(w5.addSquad('geodude', 0, 50 * TILE, 50 * TILE));
  const brute = w5.addUnit('snorlax', 1, gd.x + 12, gd.y);
  const bh = brute.hp;
  w5.damage(gd, 30, brute.id, 1, { contact: true });
  ok(brute.hp < bh, 'Rocky Helmet hurts close-range attackers');
}

// decks are validated: 8 slots, right classes, no duplicates, 3 skills of that Pokémon
{
  const bad = { name: 'x', slots: [{ line: 'charmander' }, { line: 'machop' }, { line: 'squirtle', skills: ['thunder', 'healpulse', 'healpulse'] }, { line: 'squirtle' }] };
  const d = validDeck(bad);
  const lines = d.slots.map((x) => x.line);
  ok(d.slots.length === 8 && DECK_POOL.worker.includes(lines[0]) && DECK_POOL.legend.includes(lines[1]) &&
    lines.slice(2).every((l) => DECK_POOL.fighter.includes(l)) && new Set(lines).size === 8, `invalid deck repaired (${lines.join(',')})`);
  ok(d.slots[2].skills.length === 3 && d.slots[2].skills.every((k) => SKILLS[k].line === 'squirtle') && new Set(d.slots[2].skills).size === 3, 'skills repaired to 3 of its own');
  const w6 = new World({ seed: 3, players: [{ deck: AI_DECKS[1] }, {}] });
  ok(w6.players[0].deck.name === 'Sky Storm' && w6.inDeck(0, 'pidgey') && !w6.inDeck(0, 'snorlax'), 'a player brings their own deck');
}

// V3 Pokémon: Timburr repairs, Mewtwo's stone picks Mega X or Y, Teleport, Curse, Night Shade, Pressure, Stalwart, Electro Shot
{
  const deck = AI_DECKS.find((d) => d.name === 'Mind Games');
  const w7 = new World({ seed: 31, players: [{ deck }, {}] });
  const A = w7.players[0], B = w7.players[1];
  A.noFog = B.noFog = true;
  ok(w7.unitsOf(0).every((u) => u.type === 'timburr'), 'a Timburr deck starts with Timburr workers');
  const c0 = w7.buildingsOf(0)[0];
  c0.hp = c0.maxHp * 0.5;
  A.research.sk_repair = 1;
  for (const u of w7.unitsOf(0)) u.order = { type: 'idle' };
  run(w7, 8);
  ok(c0.hp > c0.maxHp * 0.5 + 20, `idle Timburr repaired the Center (${Math.round(c0.hp)}/${c0.maxHp})`);
  const sq = (type, pid, x, y) => { const q = w7.addSquad(type, pid, x * TILE, y * TILE); q.auto = false; return q; };
  // Mewtwo: Mewtwonite Y in this deck
  A.research.keystone = 1;
  const mq = sq('mewtwo', 0, 30, 30);
  w7.issue(0, { c: 'mega', ids: mq.members });
  run(w7, MEGA.transform + 0.1);
  ok(w7.leaderOf(mq).form === 'megamewtwoy', 'Mewtwonite Y -> Mega Mewtwo Y');
  // Pressure slows enemy attacks nearby
  A.research.sk_pressure = 1;
  const near = w7.addUnit('charmander', 1, 32 * TILE, 30 * TILE);
  const cd0 = w7.stats(near).cd;
  w7.buildHash();
  mq.scan = 0; w7.squadSkills(mq);
  ok(w7.stats(near).cd > cd0 * 1.2, 'Pressure slows nearby enemies');
  // Teleport moves the whole squad
  A.research.sk_teleport = 1;
  A.deck.slots[2].skills = ['psybeam', 'teleport', 'magicguard']; A.deckKey = 'tp';
  const ab = sq('abra', 0, 10, 50);
  w7.issue(0, { c: 'cast', ids: ab.members, key: 'teleport', x: 16 * TILE, y: 50 * TILE });
  run(w7, 0.2);
  ok(w7.squadUnits(ab).every((m) => Math.abs(m.x - 16 * TILE) < 30), 'Teleport moved the whole squad');
  // Curse makes enemies take more damage; Night Shade ignores types
  A.deck.slots[3].skills = ['shadowball', 'curse', 'nightshade']; A.deckKey = 'gh';
  A.research.sk_curse = 1; A.research.sk_nightshade = 1;
  const gq = sq('gastly', 0, 40, 50);
  const dummy = w7.addUnit('snorlax', 1, 44 * TILE, 50 * TILE); dummy.stun = 30;
  w7.buildHash();
  w7.issue(0, { c: 'cast', ids: gq.members, key: 'curse', x: dummy.x, y: dummy.y });
  run(w7, 0.2);
  let h = dummy.hp; w7.damage(dummy, 20, 0, 0);
  ok(Math.abs((h - dummy.hp) - 27) < 0.01, 'Curse: +35% damage taken');
  h = dummy.hp;
  w7.issue(0, { c: 'cast', ids: gq.members, key: 'nightshade', x: dummy.x, y: dummy.y });
  run(w7, 0.2);
  ok(Math.abs((h - dummy.hp) - 34 * 1.35) < 1, 'Night Shade deals fixed damage (ghost vs normal is not resisted)');
  // Stalwart: no knock-back
  A.deck.slots[5].skills = ['electroshot', 'flashcannon', 'stalwart']; A.deckKey = 'st';
  A.research.sk_stalwart = 1; A.research.sk_electroshot = 1;
  const dq = sq('duraludon', 0, 20, 20);
  const dl = w7.leaderOf(dq);
  const x0 = dl.x;
  B.research.sk_hurricane = 1;
  B.deck.slots.find((x) => x.line === 'pidgey') || (B.deck.slots[7] = { line: 'pidgey', skills: ['hurricane', 'roost', 'keeneye'], item: null });
  B.deckKey = 'pg';
  const pq = w7.addSquad('pidgey', 1, 26 * TILE, 20 * TILE); pq.auto = false;
  w7.buildHash();
  w7.issue(1, { c: 'cast', ids: pq.members, key: 'hurricane', x: dl.x, y: dl.y });
  run(w7, 0.2);
  ok(Math.abs(dl.x - x0) < 3, 'Stalwart: Duraludon cannot be knocked back');
  // Electro Shot: charges, fires, then powers up
  const target = w7.addUnit('snorlax', 1, 26 * TILE, 22 * TILE); target.stun = 30;
  w7.buildHash();
  const th = target.hp;
  w7.issue(0, { c: 'cast', ids: dq.members, key: 'electroshot', x: target.x, y: target.y });
  run(w7, 0.5);
  ok(!!dl.charge && target.hp === th, 'Electro Shot is charging');
  run(w7, 2);
  ok(target.hp < th - 80 && dl.buffs && dl.buffs.some((b) => b.key === 'electroshot'), 'Electro Shot fired and powered Duraludon up');
}

// destroying the last Pokémon Center ends the game, even if other buildings remain
const w2 = new World({ seed: 5, players: [{}, {}] });
const c1 = w2.buildingsOf(1)[0];
w2.addBuilding('mart', 1, c1.tx + 5, c1.ty, true);
w2.damage(c1, 99999, 0, 0);
ok(w2.winner === 0, `winner decided right when the last Center fell (winner ${w2.winner})`);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
