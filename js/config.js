// Game data: units, evolutions, buildings, research, moves, type chart.
// Tweak numbers here to rebalance.
export const VERSION = 'V3';
export const TILE = 16;
export const MAP_SIZE = 64;
export const TICK = 1 / 20; // simulation step (seconds)
export const MAX_POP = 200;
// out-of-combat regeneration: after REGEN_DELAY seconds without dealing or taking damage,
// Pokémon heal REGEN_RATE of their max HP per second
export const REGEN_DELAY = 5;
export const REGEN_RATE = 0.02;
// squads refill fallen members on their own: after REINFORCE_DELAY seconds out of combat,
// one member returns every REINFORCE_TIME seconds for REINFORCE_COST of a member's price
export const REINFORCE_DELAY = 4;
export const REINFORCE_TIME = 3;
export const REINFORCE_COST = 0.3;

export const TEAM_COLORS = ['#3d8bff', '#ff4d4d'];
export const TEAM_NAMES = ['Blue', 'Red'];

// attacker type -> defender type -> multiplier
const EFF = {
  fire: { grass: 1.5, water: 0.67, fire: 0.67, rock: 0.67, dragon: 0.67 },
  water: { fire: 1.5, rock: 1.5, grass: 0.67, water: 0.67, dragon: 0.67 },
  grass: { water: 1.5, rock: 1.5, fire: 0.67, grass: 0.67, flying: 0.67, dragon: 0.67 },
  electric: { water: 1.5, flying: 1.5, grass: 0.67, electric: 0.67, rock: 0.5, dragon: 0.67 },
  fighting: { normal: 1.5, rock: 1.5, flying: 0.67 },
  normal: { rock: 0.67 },
  flying: { grass: 1.5, fighting: 1.5, rock: 0.67, electric: 0.67 },
  rock: { fire: 1.5, flying: 1.5, fighting: 0.67 },
  dragon: { dragon: 1.5 },
};
export function effectiveness(atk, def) {
  return (EFF[atk] && EFF[atk][def]) || 1;
}

export const TYPE_COLORS = {
  fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#e0b820', normal: '#a8a878',
  fighting: '#c03028', flying: '#a890f0', rock: '#b8a038', dragon: '#7038f8', building: '#888',
};

// XP (damage dealt) needed to reach each evolution stage. Evolving also needs research.
export const EVO_XP = [0, 120, 400];
export const EVO_MULT = [
  { hp: 1, dmg: 1, range: 0 },
  { hp: 1.5, dmg: 1.4, range: 0.5 },
  { hp: 2.2, dmg: 1.9, range: 1 },
];

// Trainable Pokémon (base forms). range/speed/sight in tiles, cd in seconds.
// Battle Pokémon come in squads: `squad` members, each with these stats. cost/time are per squad,
// pop is per member (a squad takes pop × squad supply).
export const UNITS = {
  machop: {
    name: 'Machop', hp: 60, dmg: 5, cd: 1.0, range: 0.4, speed: 2.6, sight: 6,
    cost: { b: 50, c: 0 }, time: 12, pop: 1, radius: 5, worker: true,
    desc: 'Worker. Gathers berries & crystals and builds.',
  },
  charmander: {
    name: 'Charmander', hp: 55, dmg: 6.5, cd: 1.0, range: 3.5, speed: 2.4, sight: 7, squad: 4,
    cost: { b: 140, c: 45 }, time: 22, pop: 1, radius: 5, proj: 'ember',
    desc: 'Ranged fire attacker. Strong vs Grass. Charizard can fly!',
  },
  squirtle: {
    name: 'Squirtle', hp: 95, dmg: 5.5, cd: 0.9, range: 1.2, speed: 2.2, sight: 6, squad: 4,
    cost: { b: 140, c: 45 }, time: 22, pop: 1, radius: 6, proj: 'water',
    desc: 'Tough short-range fighter. Strong vs Fire & Rock. Knows Heal Pulse.',
  },
  bulbasaur: {
    name: 'Bulbasaur', hp: 62, dmg: 8, cd: 1.3, range: 4.5, speed: 2.1, sight: 7, squad: 4,
    cost: { b: 115, c: 110 }, time: 24, pop: 1, radius: 6, proj: 'leaf',
    desc: 'Long-range grass sniper. Strong vs Water & Rock. Knows Sleep Powder.',
  },
  geodude: {
    name: 'Geodude', hp: 140, dmg: 8, cd: 1.2, range: 2, speed: 1.8, sight: 6, squad: 3,
    cost: { b: 115, c: 95 }, time: 24, pop: 1, radius: 6, proj: 'rock', siege: 1.3,
    desc: 'Rocky tank that throws stones. Strong vs Fire & Flying.',
  },
  eevee: {
    name: 'Eevee', hp: 60, dmg: 5.5, cd: 0.9, range: 2.5, speed: 2.7, sight: 7, squad: 4,
    cost: { b: 115, c: 95 }, time: 22, pop: 1, radius: 5, proj: 'star',
    desc: 'Can evolve into Vaporeon, Jolteon or Flareon — your choice!',
  },
  pikachu: {
    name: 'Pikachu', hp: 50, dmg: 4.2, cd: 0.55, range: 3, speed: 3.3, sight: 8, squad: 4,
    cost: { b: 140, c: 140 }, time: 24, pop: 1, radius: 5, proj: 'bolt', req: 'lab',
    desc: 'Fast, rapid attacks. Strong vs Water & Flying. Knows Thunder.',
  },
  snorlax: {
    name: 'Snorlax', hp: 450, dmg: 22, cd: 1.6, range: 0.6, speed: 1.4, sight: 6, squad: 2,
    cost: { b: 250, c: 330 }, time: 45, pop: 4, radius: 10, siege: 2, req: 'lab',
    desc: 'Huge tank. Smashes buildings for double damage. Can\'t hit flyers.',
  },
  pidgey: {
    name: 'Pidgey', hp: 45, dmg: 5, cd: 0.8, range: 2, speed: 3.8, sight: 8, squad: 4,
    cost: { b: 115, c: 115 }, time: 22, pop: 1, radius: 5, proj: 'gust', flying: true,
    desc: 'Flies over trees and water. Strong vs Grass & Fighting.',
  },
  rayquaza: {
    name: 'Rayquaza', hp: 1100, dmg: 27, cd: 1.5, range: 4, speed: 2.6, sight: 10,
    cost: { b: 400, c: 500 }, time: 60, pop: 10, radius: 11, proj: 'breath', splash: 1.4, siege: 1.5,
    flying: true, limit: 1,
    desc: 'Legendary sky dragon. Dragon Breath hits an area. Only one allowed.',
  },
};

// Every form a Pokémon can take. `next` lists evolutions: reach the XP and finish the research.
// `choice` evolutions are picked by the player with the Evolve button (Eevee).
export const FORMS = {
  machop: { line: 'machop', name: 'Machop', type: 'fighting', stage: 0 },
  charmander: { line: 'charmander', name: 'Charmander', type: 'fire', stage: 0, next: [{ to: 'charmeleon', r: 'evo_charmeleon' }] },
  charmeleon: { line: 'charmander', name: 'Charmeleon', type: 'fire', stage: 1, next: [{ to: 'charizard', r: 'evo_charizard' }] },
  charizard: { line: 'charmander', name: 'Charizard', type: 'fire', stage: 2, flying: true },
  squirtle: { line: 'squirtle', name: 'Squirtle', type: 'water', stage: 0, next: [{ to: 'wartortle', r: 'evo_wartortle' }] },
  wartortle: { line: 'squirtle', name: 'Wartortle', type: 'water', stage: 1, next: [{ to: 'blastoise', r: 'evo_blastoise' }] },
  blastoise: { line: 'squirtle', name: 'Blastoise', type: 'water', stage: 2 },
  bulbasaur: { line: 'bulbasaur', name: 'Bulbasaur', type: 'grass', stage: 0, next: [{ to: 'ivysaur', r: 'evo_ivysaur' }] },
  ivysaur: { line: 'bulbasaur', name: 'Ivysaur', type: 'grass', stage: 1, next: [{ to: 'venusaur', r: 'evo_venusaur' }] },
  venusaur: { line: 'bulbasaur', name: 'Venusaur', type: 'grass', stage: 2 },
  geodude: { line: 'geodude', name: 'Geodude', type: 'rock', stage: 0, next: [{ to: 'graveler', r: 'evo_graveler' }] },
  graveler: { line: 'geodude', name: 'Graveler', type: 'rock', stage: 1, next: [{ to: 'golem', r: 'evo_golem' }] },
  golem: { line: 'geodude', name: 'Golem', type: 'rock', stage: 2 },
  eevee: {
    line: 'eevee', name: 'Eevee', type: 'normal', stage: 0,
    next: [{ to: 'vaporeon', r: 'waterstone', choice: true }, { to: 'jolteon', r: 'thunderstone', choice: true }, { to: 'flareon', r: 'firestone', choice: true }],
  },
  vaporeon: { line: 'eevee', name: 'Vaporeon', type: 'water', stage: 1, proj: 'water', mult: { hp: 2.1, dmg: 1.4, range: 0.5 } },
  jolteon: { line: 'eevee', name: 'Jolteon', type: 'electric', stage: 1, proj: 'bolt', mult: { hp: 1.4, dmg: 1.4, range: 1, speed: 1.3, cd: 0.6 } },
  flareon: { line: 'eevee', name: 'Flareon', type: 'fire', stage: 1, proj: 'ember', mult: { hp: 1.6, dmg: 2.2, range: 0.5 } },
  pikachu: { line: 'pikachu', name: 'Pikachu', type: 'electric', stage: 0, next: [{ to: 'raichu', r: 'thunderstone' }] },
  raichu: { line: 'pikachu', name: 'Raichu', type: 'electric', stage: 1 },
  snorlax: { line: 'snorlax', name: 'Snorlax', type: 'normal', stage: 0 },
  pidgey: { line: 'pidgey', name: 'Pidgey', type: 'flying', stage: 0, next: [{ to: 'pidgeotto', r: 'evo_pidgeotto' }] },
  pidgeotto: { line: 'pidgey', name: 'Pidgeotto', type: 'flying', stage: 1, next: [{ to: 'pidgeot', r: 'evo_pidgeot' }] },
  pidgeot: { line: 'pidgey', name: 'Pidgeot', type: 'flying', stage: 2 },
  rayquaza: { line: 'rayquaza', name: 'Rayquaza', type: 'dragon', stage: 0, mouth: [66, -42], anim: 8, fast: 8, next: [{ to: 'megarayquaza', r: 'megastone' }] },
  megarayquaza: { line: 'rayquaza', name: 'Mega Rayquaza', type: 'dragon', stage: 1, mouth: [71, -48], anim: 8, fast: 8, proj: 'megabreath', mult: { hp: 1.8, dmg: 1.6, range: 1.5, speed: 1.2 } },
};

export const BUILDINGS = {
  center: {
    name: 'Pokémon Center', short: 'CENTER', w: 3, h: 3, hp: 1500, cost: { b: 400, c: 0 }, time: 60, pop: 15, sight: 8,
    trains: ['machop'], dropoff: true, heal: true,
    desc: 'HQ. Trains workers, stores resources, heals nearby Pokémon.',
  },
  mart: {
    name: 'Poké Mart', short: 'MART', w: 2, h: 2, hp: 450, cost: { b: 100, c: 0 }, time: 20, pop: 15, sight: 5,
    desc: '+15 supply (+20 with Mart Expansion).',
  },
  gym: {
    name: 'Gym', short: 'GYM', w: 3, h: 3, hp: 1000, cost: { b: 150, c: 0 }, time: 35, sight: 6,
    trains: ['charmander', 'squirtle', 'bulbasaur', 'geodude', 'eevee', 'pikachu', 'snorlax'],
    desc: 'Trains battle Pokémon. Snorlax needs a Lab.',
  },
  lab: {
    name: 'Lab', short: 'LAB', w: 3, h: 3, hp: 800, cost: { b: 150, c: 100 }, time: 40, sight: 6, req: 'gym',
    // every research in the game lives here (filled in below); the panel groups it by deck slot
    research: [],
    desc: 'All research: general upgrades, evolutions and every skill, grouped by Pokémon. Unlocks Pikachu and Snorlax.',
  },
  tower: {
    name: 'Tower', short: 'TOWER', w: 2, h: 2, hp: 550, cost: { b: 100, c: 50 }, time: 30, sight: 8, req: 'gym',
    dmg: 12, cd: 1.0, range: 6, type: 'normal', proj: 'ball',
    desc: 'Defensive tower that throws Poké Balls. Hits flyers too.',
  },
  skypillar: {
    name: 'Sky Pillar', short: 'PILLAR', w: 3, h: 3, hp: 1200, cost: { b: 300, c: 250 }, time: 60, sight: 9, req: 'lab',
    trains: ['pidgey', 'rayquaza'],
    desc: 'Trains flying Pokémon and the legendary Rayquaza. Unlocks legendary research.',
  },
};

// Research. `levels` > 1 means it can be researched several times (cost/time grow per level).
// `req` is another research that must be done first; `reqB` a building that must exist.
const evo = (line, name, icon, b, c, time, req) => ({ line, name, icon, cost: { b, c }, time, req, group: 'evo', desc: `Lets Pokémon evolve into ${name} once they have enough XP.` });
export const RESEARCH = {
  attack: { name: 'Attack', levels: 3, cost: { b: 100, c: 100 }, time: 40, desc: '+15% damage for all Pokémon per level.' },
  defense: { name: 'Defense', levels: 3, cost: { b: 100, c: 100 }, time: 40, desc: 'Pokémon take 12% less damage per level.' },
  evo_charmeleon: evo('charmander', 'Charmeleon', 'charmeleon', 100, 75, 30),
  evo_charizard: evo('charmander', 'Charizard', 'charizard', 200, 175, 45, 'evo_charmeleon'),
  evo_wartortle: evo('squirtle', 'Wartortle', 'wartortle', 100, 75, 30),
  evo_blastoise: evo('squirtle', 'Blastoise', 'blastoise', 200, 175, 45, 'evo_wartortle'),
  evo_ivysaur: evo('bulbasaur', 'Ivysaur', 'ivysaur', 100, 75, 30),
  evo_venusaur: evo('bulbasaur', 'Venusaur', 'venusaur', 200, 175, 45, 'evo_ivysaur'),
  evo_graveler: evo('geodude', 'Graveler', 'graveler', 100, 75, 30),
  evo_golem: evo('geodude', 'Golem', 'golem', 200, 175, 45, 'evo_graveler'),
  evo_pidgeotto: { ...evo('pidgey', 'Pidgeotto', 'pidgeotto', 100, 75, 30), reqB: 'skypillar' },
  evo_pidgeot: { ...evo('pidgey', 'Pidgeot', 'pidgeot', 200, 175, 45, 'evo_pidgeotto'), reqB: 'skypillar' },
  thunderstone: { lines: ['pikachu', 'eevee'], name: 'Thunder Stone', icon: 'i:thunderstone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Pikachu → Raichu and Eevee → Jolteon.' },
  waterstone: { lines: ['eevee'], name: 'Water Stone', icon: 'i:waterstone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Eevee → Vaporeon.' },
  firestone: { lines: ['eevee'], name: 'Fire Stone', icon: 'i:firestone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Eevee → Flareon.' },
  megastone: { line: 'rayquaza', name: 'Mega Stone', icon: 'i:megastone', cost: { b: 400, c: 400 }, time: 60, group: 'evo', reqB: 'skypillar', desc: 'Rayquaza → Mega Rayquaza.' },
  harvest: { name: 'Harvest', levels: 2, cost: { b: 100, c: 50 }, time: 35, desc: 'Workers gather 20% faster per level.' },
  bigbag: { name: 'Big Bag', cost: { b: 150, c: 50 }, time: 40, desc: 'Workers carry 50% more per trip.' },
  martplus: { name: 'Mart Expansion', cost: { b: 125, c: 50 }, time: 35, desc: 'Each Poké Mart gives +20 supply instead of +15.' },
  fortify: { name: 'Fortify', cost: { b: 150, c: 100 }, time: 40, desc: 'All buildings get +50% max HP.' },
  drill: { name: 'Training Drill', cost: { b: 150, c: 100 }, time: 40, desc: 'Pokémon train 25% faster.' },
  towerup: { name: 'Tower Upgrade', levels: 2, cost: { b: 100, c: 100 }, time: 35, desc: 'Towers deal +40% damage and +1 range per level.' },
};
export function researchCost(key, level) {
  const r = RESEARCH[key];
  const m = 1 + 0.75 * level; // level = current level (0 for the first)
  return { b: Math.round((r.cost.b || 0) * m), c: Math.round((r.cost.c || 0) * m) };
}
export function researchTime(key, level) {
  return RESEARCH[key].time * (1 + 0.25 * level);
}

// Dragon Ascent timing: rockets straight up (untargetable), then dives onto the target area
export const ASCENT = { rise: 0.9, dive: 0.4 };

// ---------------------------------------------------------------- skills
// Every Pokémon line has a list of skills; a deck picks 3 per line. Every skill is researched at the Lab.
// kind 'p' = passive (always on once researched), 'a' = active (auto-cast by default, or aimed by the player).
// Actives: cd (s), range (tiles), target 'enemy' | 'ally' | 'self'. `eff` describes what happens:
//   area   - hits everything in `radius` around the target point (after `delay`)
//   zone   - lingering area that ticks `dps` for `t` seconds (drain heals the squad)
//   line   - beam/spray from the caster (every member if `each`) toward the target, `width` px wide
//   cone   - wide breath from the leader, `len` tiles long, `ang` radians wide
//   dash   - caster(s) rush to the target, hitting what they pass and what they land on
//   heal   - heals allies in `radius`; buff - temporary mods on the squad or nearby allies
//   explode, rest, roost, ascent - one-offs
// Status effects: burn/poison {t, dps}, stun (paralysis/flinch, s), sleep (s), slow {t, m}, knock (px).
// Passive `mods`: dmg, hp, cd, speed (multipliers); range, sight (+tiles); armor (damage taken x);
//   rangedArmor, resist {type: x}, solid (super-effective taken x), dodge (chance), pinch (dmg x below 1/3 HP),
//   contact {status, chance} (hits melee attackers), onhit {status, chance}, sturdy (s between saves),
//   immune (no status effects), regen (x), cregen (HP/s share even in combat), siege (x vs buildings),
//   stamina (stacking defense when hit), aura {mods, radius} (nearby allies), workers: gather, carry, pickup, build.
const A = (o) => ({ kind: 'a', target: 'enemy', ...o });
const P = (o) => ({ kind: 'p', ...o });
export const SKILLS = {
  // --- Machop (worker)
  hustle: P({ line: 'machop', name: 'Hustle', type: 'fighting', glyph: 'fist', desc: 'Workers gather 20% faster.', mods: { gather: 1.2 } }),
  strength: P({ line: 'machop', name: 'Strength', type: 'fighting', glyph: 'bag', desc: 'Workers carry 50% more per trip.', mods: { carry: 1.5 } }),
  pickup: P({ line: 'machop', name: 'Pickup', type: 'normal', glyph: 'star', desc: '25% chance to bring back a double load.', mods: { pickup: 0.25 } }),
  bulkup: P({ line: 'machop', name: 'Bulk Up', type: 'fighting', glyph: 'muscle', desc: 'Workers get +60% HP and deal double damage.', mods: { hp: 1.6, dmg: 2 } }),
  superpower: P({ line: 'machop', name: 'Superpower', type: 'fighting', glyph: 'hammer', desc: 'Workers build 50% faster.', mods: { build: 1.5 } }),
  guts: P({ line: 'machop', name: 'Guts', type: 'normal', glyph: 'shield', desc: 'Workers take 30% less damage.', mods: { armor: 0.7 } }),
  // --- Charmander line
  flamethrower: A({ line: 'charmander', name: 'Flamethrower', type: 'fire', glyph: 'flame', cd: 14, range: 5, desc: 'Every member sprays fire at the target, burning everything in the stream.',
    eff: { k: 'line', each: true, dmg: 22, width: 10, burn: { t: 3, dps: 4 } } }),
  firespin: A({ line: 'charmander', name: 'Fire Spin', type: 'fire', glyph: 'swirl', cd: 20, range: 6, desc: 'A vortex of fire burns enemies in an area for 5 seconds.',
    eff: { k: 'zone', radius: 2, t: 5, dps: 12, burn: { t: 2, dps: 3 } } }),
  heatwave: A({ line: 'charmander', name: 'Heat Wave', type: 'fire', glyph: 'wave', cd: 22, range: 4, desc: 'A wide blast of scorching air in front of the leader.',
    eff: { k: 'cone', dmg: 45, len: 4.5, ang: 1.1, burn: { t: 3, dps: 4 } } }),
  blaze: P({ line: 'charmander', name: 'Blaze', type: 'fire', glyph: 'flame', desc: '+50% damage while below 1/3 HP.', mods: { pinch: 1.5 } }),
  flamebody: P({ line: 'charmander', name: 'Flame Body', type: 'fire', glyph: 'body', desc: 'Close-range attackers may get burned (30%).', mods: { contact: { chance: 0.3, burn: { t: 3, dps: 4 } } } }),
  solarpower: P({ line: 'charmander', name: 'Solar Power', type: 'fire', glyph: 'sun', desc: '+25% damage and +1 range, but takes 15% more damage.', mods: { dmg: 1.25, range: 1, armor: 1.15 } }),
  // --- Squirtle line
  healpulse: A({ line: 'squirtle', name: 'Heal Pulse', type: 'water', glyph: 'heart', cd: 18, range: 6, target: 'ally', desc: 'Heals allies in an area.',
    eff: { k: 'heal', radius: 2.5, amount: 60 } }),
  hydropump: A({ line: 'squirtle', name: 'Hydro Pump', type: 'water', glyph: 'drop', cd: 16, range: 5, desc: 'Every member blasts a jet of water that knocks enemies back.',
    eff: { k: 'line', each: true, dmg: 26, width: 10, knock: 14 } }),
  protect: A({ line: 'squirtle', name: 'Protect', type: 'normal', glyph: 'shield', cd: 22, range: 0, target: 'self', desc: 'The squad takes 65% less damage for 4 seconds.',
    eff: { k: 'buff', who: 'squad', t: 4, mods: { armor: 0.35 } } }),
  torrent: P({ line: 'squirtle', name: 'Torrent', type: 'water', glyph: 'drop', desc: '+50% damage while below 1/3 HP.', mods: { pinch: 1.5 } }),
  raindish: P({ line: 'squirtle', name: 'Rain Dish', type: 'water', glyph: 'rain', desc: 'Regenerates 1% HP per second, even in combat.', mods: { cregen: 0.01 } }),
  shellarmor: P({ line: 'squirtle', name: 'Shell Armor', type: 'water', glyph: 'shell', desc: 'Takes 20% less damage.', mods: { armor: 0.8 } }),
  // --- Bulbasaur line
  sleeppowder: A({ line: 'bulbasaur', name: 'Sleep Powder', type: 'grass', glyph: 'zzz', cd: 25, range: 6, desc: 'Puts enemies in an area to sleep for 4 seconds.',
    eff: { k: 'area', radius: 2, sleep: 4 } }),
  leechseed: A({ line: 'bulbasaur', name: 'Leech Seed', type: 'grass', glyph: 'seed', cd: 20, range: 6, desc: 'Seeds drain enemies in an area for 6 seconds and heal the squad.',
    eff: { k: 'zone', radius: 1.8, t: 6, dps: 9, drain: 1 } }),
  solarbeam: A({ line: 'bulbasaur', name: 'Solar Beam', type: 'grass', glyph: 'beam', cd: 24, range: 7, desc: 'Every member charges for a moment, then fires a huge beam of light.',
    eff: { k: 'line', each: true, charge: 1.2, dmg: 34, width: 12 } }),
  overgrow: P({ line: 'bulbasaur', name: 'Overgrow', type: 'grass', glyph: 'leaf', desc: '+50% damage while below 1/3 HP.', mods: { pinch: 1.5 } }),
  chlorophyll: P({ line: 'bulbasaur', name: 'Chlorophyll', type: 'grass', glyph: 'sun', desc: 'Moves 25% faster and attacks 15% faster.', mods: { speed: 1.25, cd: 0.85 } }),
  poisonpoint: P({ line: 'bulbasaur', name: 'Poison Point', type: 'grass', glyph: 'skull', desc: 'Attacks may poison (25%): damage over time.', mods: { onhit: { chance: 0.25, poison: { t: 4, dps: 3 } } } }),
  // --- Geodude line
  rockslide: A({ line: 'geodude', name: 'Rock Slide', type: 'rock', glyph: 'rock', cd: 18, range: 5, desc: 'Boulders crash down on an area and make enemies flinch.',
    eff: { k: 'area', radius: 2, dmg: 40, stun: 1, delay: 0.4, bld: 0.5 } }),
  selfdestruct: A({ line: 'geodude', name: 'Self-Destruct', type: 'normal', glyph: 'boom', cd: 30, range: 4, desc: 'One member rolls in and explodes. It comes back as a reinforcement.',
    eff: { k: 'explode', radius: 2.2, dmg: 130, bld: 0.6 } }),
  rollout: A({ line: 'geodude', name: 'Rollout', type: 'rock', glyph: 'roll', cd: 14, range: 6, desc: 'Every member rolls into the enemy, hitting everything on the way.',
    eff: { k: 'dash', each: true, dmg: 20, speed: 10, stun: 0.5 } }),
  sturdy: P({ line: 'geodude', name: 'Sturdy', type: 'rock', glyph: 'shield', desc: 'Survives a fatal hit with 1 HP (once every 30 s).', mods: { sturdy: 30 } }),
  rockhead: P({ line: 'geodude', name: 'Rock Head', type: 'rock', glyph: 'rock', desc: '+50% damage to buildings.', mods: { siege: 1.5 } }),
  solidrock: P({ line: 'geodude', name: 'Solid Rock', type: 'rock', glyph: 'shell', desc: 'Super-effective hits deal 30% less damage.', mods: { solid: 0.7 } }),
  // --- Eevee line
  quickattack: A({ line: 'eevee', name: 'Quick Attack', type: 'normal', glyph: 'dash', cd: 10, range: 6, desc: 'Every member dashes in and strikes first.',
    eff: { k: 'dash', each: true, dmg: 16, speed: 14 } }),
  swift: A({ line: 'eevee', name: 'Swift', type: 'normal', glyph: 'star', cd: 12, range: 5, desc: 'A shower of stars hits every enemy in an area.',
    eff: { k: 'area', radius: 2, dmg: 26 } }),
  helpinghand: A({ line: 'eevee', name: 'Helping Hand', type: 'normal', glyph: 'hand', cd: 25, range: 0, target: 'self', desc: 'Nearby allies deal 30% more damage for 8 seconds.',
    eff: { k: 'buff', who: 'allies', radius: 4, t: 8, mods: { dmg: 1.3 } } }),
  adaptability: P({ line: 'eevee', name: 'Adaptability', type: 'normal', glyph: 'star', desc: '+20% damage.', mods: { dmg: 1.2 } }),
  anticipation: P({ line: 'eevee', name: 'Anticipation', type: 'normal', glyph: 'eye', desc: 'Dodges 15% of attacks.', mods: { dodge: 0.15 } }),
  runaway: P({ line: 'eevee', name: 'Run Away', type: 'normal', glyph: 'wing', desc: 'Moves 25% faster.', mods: { speed: 1.25 } }),
  // --- Pikachu line
  thunder: A({ line: 'pikachu', name: 'Thunder', type: 'electric', glyph: 'bolt', cd: 22, range: 7, desc: 'Calls down lightning on an area.',
    eff: { k: 'area', radius: 2, dmg: 65, delay: 0.5, bld: 0.4 } }),
  thunderwave: A({ line: 'pikachu', name: 'Thunder Wave', type: 'electric', glyph: 'wave', cd: 20, range: 6, desc: 'Paralyzes enemies in an area for 2 seconds.',
    eff: { k: 'area', radius: 2, stun: 2 } }),
  volttackle: A({ line: 'pikachu', name: 'Volt Tackle', type: 'electric', glyph: 'dash', cd: 14, range: 6, desc: 'Every member charges in, electrified. Hurts itself a little.',
    eff: { k: 'dash', each: true, dmg: 28, speed: 14, stun: 0.5, recoil: 0.15 } }),
  static: P({ line: 'pikachu', name: 'Static', type: 'electric', glyph: 'bolt', desc: 'Close-range attackers may be paralyzed (25%).', mods: { contact: { chance: 0.25, stun: 1 } } }),
  lightningrod: P({ line: 'pikachu', name: 'Lightning Rod', type: 'electric', glyph: 'rod', desc: 'Takes half damage from Electric attacks and deals 10% more.', mods: { resist: { electric: 0.5 }, dmg: 1.1 } }),
  quickfeet: P({ line: 'pikachu', name: 'Quick Feet', type: 'normal', glyph: 'wing', desc: 'Attacks 25% faster.', mods: { cd: 0.8 } }),
  // --- Pidgey line
  hurricane: A({ line: 'pidgey', name: 'Hurricane', type: 'flying', glyph: 'swirl', cd: 18, range: 6, desc: 'A storm wind hits an area and throws enemies back.',
    eff: { k: 'area', radius: 2.2, dmg: 28, knock: 20 } }),
  whirlwind: A({ line: 'pidgey', name: 'Whirlwind', type: 'flying', glyph: 'wind', cd: 20, range: 5, desc: 'Blows enemies far out of an area.',
    eff: { k: 'area', radius: 2.5, dmg: 4, knock: 42 } }),
  roost: A({ line: 'pidgey', name: 'Roost', type: 'flying', glyph: 'heart', cd: 25, range: 0, target: 'self', desc: 'The squad lands and heals 40% of its HP.',
    eff: { k: 'roost', amount: 0.4 } }),
  bravebird: A({ line: 'pidgey', name: 'Brave Bird', type: 'flying', glyph: 'dash', cd: 16, range: 6, desc: 'Every member dives at the enemy. Hurts itself a little.',
    eff: { k: 'dash', each: true, dmg: 34, speed: 16, recoil: 0.2 } }),
  keeneye: P({ line: 'pidgey', name: 'Keen Eye', type: 'flying', glyph: 'eye', desc: '+1.5 range and +2 sight.', mods: { range: 1.5, sight: 2 } }),
  tailwind: P({ line: 'pidgey', name: 'Tailwind', type: 'flying', glyph: 'wind', desc: 'Allies near the squad move 20% faster.', mods: { aura: { radius: 4, mods: { speed: 1.2 } } } }),
  // --- Snorlax
  bodyslam: A({ line: 'snorlax', name: 'Body Slam', type: 'normal', glyph: 'body', cd: 14, range: 4, desc: 'Leaps onto the enemy, crushing and paralyzing them.',
    eff: { k: 'dash', each: true, dmg: 45, speed: 9, radius: 1.5, stun: 1, bld: 0.8 } }),
  rest: A({ line: 'snorlax', name: 'Rest', type: 'normal', glyph: 'zzz', cd: 40, range: 0, target: 'self', desc: 'Heals fully, then sleeps for 3 seconds.',
    eff: { k: 'rest', t: 3 } }),
  yawn: A({ line: 'snorlax', name: 'Yawn', type: 'normal', glyph: 'zzz', cd: 22, range: 5, desc: 'Enemies in an area fall asleep after 2 seconds.',
    eff: { k: 'area', radius: 2, sleep: 3, delay: 2 } }),
  thickfat: P({ line: 'snorlax', name: 'Thick Fat', type: 'normal', glyph: 'shell', desc: 'Takes half damage from Fire attacks.', mods: { resist: { fire: 0.5 } } }),
  immunity: P({ line: 'snorlax', name: 'Immunity', type: 'normal', glyph: 'shield', desc: 'Immune to sleep, paralysis, burn and poison.', mods: { immune: 1 } }),
  gluttony: P({ line: 'snorlax', name: 'Gluttony', type: 'normal', glyph: 'heart', desc: 'Regenerates twice as fast out of combat.', mods: { regen: 2 } }),
  // --- Rayquaza (legendary)
  ascent: A({ line: 'rayquaza', name: 'Dragon Ascent', type: 'dragon', glyph: 'up', cd: 40, range: 11, desc: 'Soars into the sky, then dives onto an area, draining life from everything it hits.',
    eff: { k: 'ascent', radius: 3, dmg: 190, drain: 0.6 }, legend: true }),
  dragonbreath: A({ line: 'rayquaza', name: 'Dragon Breath', type: 'dragon', glyph: 'breath', cd: 15, range: 6, desc: 'A huge breath of dragon fire that may paralyze (30%).',
    eff: { k: 'cone', dmg: 70, len: 6, ang: 1.0, stunChance: 0.3, stun: 1 }, legend: true }),
  outrage: A({ line: 'rayquaza', name: 'Outrage', type: 'dragon', glyph: 'fist', cd: 30, range: 0, target: 'self', desc: 'Rampages for 6 seconds: +60% damage, 30% faster attacks. Slowed afterwards.',
    eff: { k: 'buff', who: 'squad', t: 6, mods: { dmg: 1.6, cd: 0.7 }, after: { slow: { t: 2, m: 0.5 } } }, legend: true }),
  extremespeed: A({ line: 'rayquaza', name: 'Extreme Speed', type: 'normal', glyph: 'dash', cd: 12, range: 9, desc: 'Streaks across the battlefield, striking everything in its path.',
    eff: { k: 'dash', dmg: 60, speed: 22, width: 14 }, legend: true }),
  deltastream: P({ line: 'rayquaza', name: 'Delta Stream', type: 'flying', glyph: 'wind', desc: 'Takes 40% less damage from ranged attacks.', mods: { rangedArmor: 0.6 }, legend: true }),
  airlock: P({ line: 'rayquaza', name: 'Air Lock', type: 'dragon', glyph: 'shield', desc: 'Immune to sleep, paralysis, slow, burn and poison.', mods: { immune: 1 }, legend: true }),
};
export const SKILL_KEYS = Object.keys(SKILLS);
export const skillsOf = (line) => SKILL_KEYS.filter((k) => SKILLS[k].line === line);
// starting loadouts until decks are built (3 per line)
export const DEFAULT_SKILLS = {
  machop: ['hustle', 'strength', 'bulkup'],
  charmander: ['flamethrower', 'firespin', 'blaze'],
  squirtle: ['healpulse', 'hydropump', 'shellarmor'],
  bulbasaur: ['sleeppowder', 'leechseed', 'overgrow'],
  geodude: ['rockslide', 'rollout', 'sturdy'],
  eevee: ['quickattack', 'swift', 'adaptability'],
  pikachu: ['thunder', 'thunderwave', 'static'],
  pidgey: ['hurricane', 'roost', 'keeneye'],
  snorlax: ['bodyslam', 'rest', 'thickfat'],
  rayquaza: ['ascent', 'dragonbreath', 'deltastream'],
};
// research for a skill: sk_<key>
export const skillResearch = (k) => 'sk_' + k;

// every skill is a Lab research
for (const k of SKILL_KEYS) {
  const s = SKILLS[k];
  const m = s.legend ? 2 : 1;
  RESEARCH[skillResearch(k)] = {
    name: s.name, icon: 'i:' + k, line: s.line, skill: k, group: 'skill', reqB: s.legend ? 'skypillar' : undefined,
    cost: s.kind === 'a' ? { b: 125 * m, c: 100 * m } : { b: 100 * m, c: 75 * m }, time: (s.kind === 'a' ? 35 : 30) * (s.legend ? 1.4 : 1), desc: s.desc,
  };
}
BUILDINGS.lab.research = Object.keys(RESEARCH);
// lines a research belongs to (for grouping in the Lab)
export const researchLines = (key) => { const r = RESEARCH[key]; return r.lines || (r.line ? [r.line] : []); };

export const RESOURCES = {
  berry: { name: 'Berry Bush', amount: 600, per: 8, time: 1.6 },
  crystal: { name: 'Crystal', amount: 600, per: 5, time: 2.0 },
};

export const squadSize = (type) => UNITS[type].squad || 1;
export const squadPop = (type) => UNITS[type].pop * squadSize(type);
export function reinforceCost(type) {
  const c = UNITS[type].cost, n = squadSize(type);
  return { b: Math.round((c.b || 0) / n * REINFORCE_COST), c: Math.round((c.c || 0) / n * REINFORCE_COST) };
}

export const UNIT_KEYS = Object.keys(UNITS);
export const FORM_KEYS = Object.keys(FORMS);
export const BUILDING_KEYS = Object.keys(BUILDINGS);
export const RES_KEYS = Object.keys(RESOURCES);
export const RESEARCH_KEYS = Object.keys(RESEARCH);

export const DIFFICULTY = {
  easy: { think: 2.0, gather: 0.75, workers: 10, firstWave: 10, waveGrow: 2, counter: false, research: 0.4, moves: false, label: 'Easy' },
  normal: { think: 1.0, gather: 1.0, workers: 15, firstWave: 18, waveGrow: 4, counter: true, research: 1, moves: true, label: 'Normal' },
  hard: { think: 0.5, gather: 1.3, workers: 19, firstWave: 18, waveGrow: 6, counter: true, research: 1.5, moves: true, label: 'Hard' },
};
