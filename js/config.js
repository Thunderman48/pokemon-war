// Game data: units, evolutions, buildings, research, moves, type chart.
// Tweak numbers here to rebalance.
export const VERSION = 'V2';
export const TILE = 16;
export const MAP_SIZE = 64;
export const TICK = 1 / 20; // simulation step (seconds)
export const MAX_POP = 120;

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
export const UNITS = {
  machop: {
    name: 'Machop', hp: 60, dmg: 5, cd: 1.0, range: 0.4, speed: 2.6, sight: 6,
    cost: { b: 50, c: 0 }, time: 12, pop: 1, radius: 5, worker: true,
    desc: 'Worker. Gathers berries & crystals and builds.',
  },
  charmander: {
    name: 'Charmander', hp: 90, dmg: 11, cd: 1.0, range: 3.5, speed: 2.4, sight: 7,
    cost: { b: 75, c: 25 }, time: 16, pop: 2, radius: 5, proj: 'ember',
    desc: 'Ranged fire attacker. Strong vs Grass. Charizard can fly!',
  },
  squirtle: {
    name: 'Squirtle', hp: 160, dmg: 9, cd: 0.9, range: 1.2, speed: 2.2, sight: 6,
    cost: { b: 75, c: 25 }, time: 16, pop: 2, radius: 6, proj: 'water',
    desc: 'Tough short-range fighter. Strong vs Fire & Rock. Knows Heal Pulse.',
  },
  bulbasaur: {
    name: 'Bulbasaur', hp: 105, dmg: 13, cd: 1.3, range: 4.5, speed: 2.1, sight: 7,
    cost: { b: 60, c: 60 }, time: 18, pop: 2, radius: 6, proj: 'leaf',
    desc: 'Long-range grass sniper. Strong vs Water & Rock. Knows Sleep Powder.',
  },
  geodude: {
    name: 'Geodude', hp: 175, dmg: 10, cd: 1.2, range: 2, speed: 1.8, sight: 6,
    cost: { b: 60, c: 50 }, time: 18, pop: 2, radius: 6, proj: 'rock', siege: 1.3,
    desc: 'Rocky tank that throws stones. Strong vs Fire & Flying.',
  },
  eevee: {
    name: 'Eevee', hp: 100, dmg: 9, cd: 0.9, range: 2.5, speed: 2.7, sight: 7,
    cost: { b: 60, c: 50 }, time: 16, pop: 2, radius: 5, proj: 'star',
    desc: 'Can evolve into Vaporeon, Jolteon or Flareon — your choice!',
  },
  pikachu: {
    name: 'Pikachu', hp: 85, dmg: 7, cd: 0.55, range: 3, speed: 3.3, sight: 8,
    cost: { b: 75, c: 75 }, time: 18, pop: 2, radius: 5, proj: 'bolt', req: 'lab',
    desc: 'Fast, rapid attacks. Strong vs Water & Flying. Knows Thunder.',
  },
  snorlax: {
    name: 'Snorlax', hp: 650, dmg: 30, cd: 1.6, range: 0.6, speed: 1.4, sight: 6,
    cost: { b: 150, c: 200 }, time: 35, pop: 6, radius: 10, siege: 2, req: 'lab',
    desc: 'Huge tank. Smashes buildings for double damage. Can\'t hit flyers.',
  },
  pidgey: {
    name: 'Pidgey', hp: 75, dmg: 8, cd: 0.8, range: 2, speed: 3.8, sight: 8,
    cost: { b: 60, c: 60 }, time: 16, pop: 2, radius: 5, proj: 'gust', flying: true,
    desc: 'Flies over trees and water. Strong vs Grass & Fighting.',
  },
  rayquaza: {
    name: 'Rayquaza', hp: 1400, dmg: 34, cd: 1.5, range: 4, speed: 2.6, sight: 10,
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
  squirtle: { line: 'squirtle', name: 'Squirtle', type: 'water', stage: 0, ability: 'heal', next: [{ to: 'wartortle', r: 'evo_wartortle' }] },
  wartortle: { line: 'squirtle', name: 'Wartortle', type: 'water', stage: 1, ability: 'heal', next: [{ to: 'blastoise', r: 'evo_blastoise' }] },
  blastoise: { line: 'squirtle', name: 'Blastoise', type: 'water', stage: 2, ability: 'heal' },
  bulbasaur: { line: 'bulbasaur', name: 'Bulbasaur', type: 'grass', stage: 0, ability: 'sleep', next: [{ to: 'ivysaur', r: 'evo_ivysaur' }] },
  ivysaur: { line: 'bulbasaur', name: 'Ivysaur', type: 'grass', stage: 1, ability: 'sleep', next: [{ to: 'venusaur', r: 'evo_venusaur' }] },
  venusaur: { line: 'bulbasaur', name: 'Venusaur', type: 'grass', stage: 2, ability: 'sleep' },
  geodude: { line: 'geodude', name: 'Geodude', type: 'rock', stage: 0, next: [{ to: 'graveler', r: 'evo_graveler' }] },
  graveler: { line: 'geodude', name: 'Graveler', type: 'rock', stage: 1, next: [{ to: 'golem', r: 'evo_golem' }] },
  golem: { line: 'geodude', name: 'Golem', type: 'rock', stage: 2 },
  eevee: {
    line: 'eevee', name: 'Eevee', type: 'normal', stage: 0,
    next: [{ to: 'vaporeon', r: 'waterstone', choice: true }, { to: 'jolteon', r: 'thunderstone', choice: true }, { to: 'flareon', r: 'firestone', choice: true }],
  },
  vaporeon: { line: 'eevee', name: 'Vaporeon', type: 'water', stage: 1, ability: 'heal', proj: 'water', mult: { hp: 2.1, dmg: 1.4, range: 0.5 } },
  jolteon: { line: 'eevee', name: 'Jolteon', type: 'electric', stage: 1, ability: 'thunder', proj: 'bolt', mult: { hp: 1.4, dmg: 1.4, range: 1, speed: 1.3, cd: 0.6 } },
  flareon: { line: 'eevee', name: 'Flareon', type: 'fire', stage: 1, proj: 'ember', mult: { hp: 1.6, dmg: 2.2, range: 0.5 } },
  pikachu: { line: 'pikachu', name: 'Pikachu', type: 'electric', stage: 0, ability: 'thunder', next: [{ to: 'raichu', r: 'thunderstone' }] },
  raichu: { line: 'pikachu', name: 'Raichu', type: 'electric', stage: 1, ability: 'thunder' },
  snorlax: { line: 'snorlax', name: 'Snorlax', type: 'normal', stage: 0 },
  pidgey: { line: 'pidgey', name: 'Pidgey', type: 'flying', stage: 0, next: [{ to: 'pidgeotto', r: 'evo_pidgeotto' }] },
  pidgeotto: { line: 'pidgey', name: 'Pidgeotto', type: 'flying', stage: 1, next: [{ to: 'pidgeot', r: 'evo_pidgeot' }] },
  pidgeot: { line: 'pidgey', name: 'Pidgeot', type: 'flying', stage: 2 },
  rayquaza: { line: 'rayquaza', name: 'Rayquaza', type: 'dragon', stage: 0, mouth: [65, -45], anim: 8, next: [{ to: 'megarayquaza', r: 'megastone' }] },
  megarayquaza: { line: 'rayquaza', name: 'Mega Rayquaza', type: 'dragon', stage: 1, mouth: [70, -52], anim: 8, proj: 'megabreath', mult: { hp: 2, dmg: 1.8, range: 1.5, speed: 1.2 } },
};

export const BUILDINGS = {
  center: {
    name: 'Pokémon Center', short: 'CENTER', w: 3, h: 3, hp: 1500, cost: { b: 400, c: 0 }, time: 60, pop: 10, sight: 8,
    trains: ['machop'], dropoff: true, heal: true,
    research: ['harvest', 'bigbag', 'martplus', 'fortify', 'drill', 'towerup'],
    desc: 'HQ. Trains workers, stores resources, heals nearby Pokémon. Economy & building upgrades.',
  },
  mart: {
    name: 'Poké Mart', short: 'MART', w: 2, h: 2, hp: 450, cost: { b: 100, c: 0 }, time: 20, pop: 10, sight: 5,
    desc: '+10 supply (+15 with Mart Expansion).',
  },
  gym: {
    name: 'Gym', short: 'GYM', w: 3, h: 3, hp: 1000, cost: { b: 150, c: 0 }, time: 35, sight: 6,
    trains: ['charmander', 'squirtle', 'bulbasaur', 'geodude', 'eevee', 'pikachu'],
    research: ['move_thunder', 'move_heal', 'move_sleep'],
    desc: 'Trains battle Pokémon and teaches special moves.',
  },
  lab: {
    name: 'Lab', short: 'LAB', w: 3, h: 3, hp: 800, cost: { b: 150, c: 100 }, time: 40, sight: 6, req: 'gym',
    trains: ['snorlax'],
    research: ['attack', 'defense', 'evo_charmeleon', 'evo_charizard', 'evo_wartortle', 'evo_blastoise', 'evo_ivysaur',
      'evo_venusaur', 'evo_graveler', 'evo_golem', 'evo_pidgeotto', 'evo_pidgeot', 'thunderstone', 'waterstone', 'firestone'],
    desc: 'Evolution research, combat upgrades. Unlocks Pikachu and Snorlax.',
  },
  tower: {
    name: 'Tower', short: 'TOWER', w: 2, h: 2, hp: 550, cost: { b: 100, c: 50 }, time: 30, sight: 8, req: 'gym',
    dmg: 12, cd: 1.0, range: 6, type: 'normal', proj: 'ball',
    desc: 'Defensive tower that throws Poké Balls. Hits flyers too.',
  },
  skypillar: {
    name: 'Sky Pillar', short: 'PILLAR', w: 3, h: 3, hp: 1200, cost: { b: 300, c: 250 }, time: 60, sight: 9, req: 'lab',
    trains: ['pidgey', 'rayquaza'], research: ['megastone'],
    desc: 'Trains flying Pokémon and the legendary Rayquaza.',
  },
};

// Research. `levels` > 1 means it can be researched several times (cost/time grow per level).
// `req` is another research that must be done first; `reqB` a building that must exist.
const evo = (name, icon, b, c, time, req) => ({ name, icon, cost: { b, c }, time, req, group: 'evo', desc: `Lets Pokémon evolve into ${name} once they have enough XP.` });
export const RESEARCH = {
  attack: { name: 'Attack', levels: 3, cost: { b: 100, c: 100 }, time: 40, desc: '+15% damage for all Pokémon per level.' },
  defense: { name: 'Defense', levels: 3, cost: { b: 100, c: 100 }, time: 40, desc: 'Pokémon take 12% less damage per level.' },
  evo_charmeleon: evo('Charmeleon', 'charmeleon', 100, 75, 30),
  evo_charizard: evo('Charizard', 'charizard', 200, 175, 45, 'evo_charmeleon'),
  evo_wartortle: evo('Wartortle', 'wartortle', 100, 75, 30),
  evo_blastoise: evo('Blastoise', 'blastoise', 200, 175, 45, 'evo_wartortle'),
  evo_ivysaur: evo('Ivysaur', 'ivysaur', 100, 75, 30),
  evo_venusaur: evo('Venusaur', 'venusaur', 200, 175, 45, 'evo_ivysaur'),
  evo_graveler: evo('Graveler', 'graveler', 100, 75, 30),
  evo_golem: evo('Golem', 'golem', 200, 175, 45, 'evo_graveler'),
  evo_pidgeotto: { ...evo('Pidgeotto', 'pidgeotto', 100, 75, 30), reqB: 'skypillar' },
  evo_pidgeot: { ...evo('Pidgeot', 'pidgeot', 200, 175, 45, 'evo_pidgeotto'), reqB: 'skypillar' },
  thunderstone: { name: 'Thunder Stone', icon: 'i:thunderstone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Pikachu → Raichu and Eevee → Jolteon.' },
  waterstone: { name: 'Water Stone', icon: 'i:waterstone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Eevee → Vaporeon.' },
  firestone: { name: 'Fire Stone', icon: 'i:firestone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Eevee → Flareon.' },
  megastone: { name: 'Mega Stone', icon: 'i:megastone', cost: { b: 400, c: 400 }, time: 60, group: 'evo', desc: 'Rayquaza → Mega Rayquaza.' },
  move_thunder: { name: 'Thunder', icon: 'i:thunder', cost: { b: 150, c: 125 }, time: 40, reqB: 'lab', desc: 'Pikachu, Raichu & Jolteon can call down lightning on an area.' },
  move_heal: { name: 'Heal Pulse', icon: 'i:heal', cost: { b: 125, c: 100 }, time: 35, desc: 'Squirtle line & Vaporeon heal nearby allies.' },
  move_sleep: { name: 'Sleep Powder', icon: 'i:sleep', cost: { b: 125, c: 100 }, time: 35, desc: 'Bulbasaur line puts enemies in an area to sleep.' },
  harvest: { name: 'Harvest', levels: 2, cost: { b: 100, c: 50 }, time: 35, desc: 'Workers gather 20% faster per level.' },
  bigbag: { name: 'Big Bag', cost: { b: 150, c: 50 }, time: 40, desc: 'Workers carry 50% more per trip.' },
  martplus: { name: 'Mart Expansion', cost: { b: 125, c: 50 }, time: 35, desc: 'Each Poké Mart gives +15 supply instead of +10.' },
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

// Special moves: research it, then select a Pokémon that knows it and tap a target area.
export const ABILITIES = {
  thunder: { name: 'Thunder', research: 'move_thunder', icon: 'thunder', range: 7, radius: 2, cd: 25, dmg: 70, delay: 0.5 },
  heal: { name: 'Heal Pulse', research: 'move_heal', icon: 'heal', range: 6, radius: 2.5, cd: 20, amount: 100 },
  sleep: { name: 'Sleep Powder', research: 'move_sleep', icon: 'sleep', range: 6, radius: 2, cd: 30, dur: 4 },
};

export const RESOURCES = {
  berry: { name: 'Berry Bush', amount: 600, per: 8, time: 1.6 },
  crystal: { name: 'Crystal', amount: 600, per: 5, time: 2.0 },
};

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
