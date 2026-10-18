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
  fire: { grass: 1.5, steel: 1.5, water: 0.67, fire: 0.67, rock: 0.67, dragon: 0.67 },
  water: { fire: 1.5, rock: 1.5, grass: 0.67, water: 0.67, dragon: 0.67 },
  grass: { water: 1.5, rock: 1.5, fire: 0.67, grass: 0.67, flying: 0.67, dragon: 0.67, steel: 0.67 },
  electric: { water: 1.5, flying: 1.5, grass: 0.67, electric: 0.67, rock: 0.5, dragon: 0.67 },
  fighting: { normal: 1.5, rock: 1.5, steel: 1.5, flying: 0.67, psychic: 0.67, ghost: 0.3 },
  normal: { rock: 0.67, steel: 0.67, ghost: 0.3 },
  flying: { grass: 1.5, fighting: 1.5, rock: 0.67, electric: 0.67, steel: 0.67 },
  rock: { fire: 1.5, flying: 1.5, fighting: 0.67, steel: 0.67 },
  dragon: { dragon: 1.5, steel: 0.67 },
  psychic: { fighting: 1.5, ghost: 1.5, psychic: 0.67, steel: 0.67 },
  ghost: { psychic: 1.5, ghost: 1.5, normal: 0.3 },
  steel: { rock: 1.5, fire: 0.67, water: 0.67, electric: 0.67, steel: 0.67 },
};
export function effectiveness(atk, def) {
  return (EFF[atk] && EFF[atk][def]) || 1;
}

export const TYPE_COLORS = {
  fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#e0b820', normal: '#a8a878',
  fighting: '#c03028', flying: '#a890f0', rock: '#b8a038', dragon: '#7038f8', building: '#888',
  psychic: '#f85888', ghost: '#705898', steel: '#b8b8d0',
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
  timburr: {
    name: 'Timburr', hp: 75, dmg: 6, cd: 1.0, range: 0.4, speed: 2.4, sight: 6,
    cost: { b: 55, c: 0 }, time: 13, pop: 1, radius: 5, worker: true,
    desc: 'Worker. Gathers and builds; carries a beam it can use to repair buildings.',
  },
  mewtwo: {
    name: 'Mewtwo', hp: 820, dmg: 32, cd: 1.2, range: 5, speed: 2.9, sight: 10,
    cost: { b: 450, c: 450 }, time: 60, pop: 10, radius: 9, proj: 'psy', splash: 0.8, limit: 1,
    desc: 'Legendary psychic. Huge damage from range, but fragile. Only one allowed.',
  },
  gastly: {
    name: 'Gastly', hp: 46, dmg: 6.5, cd: 1.0, range: 3.5, speed: 2.8, sight: 7, squad: 4,
    cost: { b: 115, c: 115 }, time: 22, pop: 1, radius: 5, proj: 'shadow',
    desc: 'Ghost. Normal and Fighting attacks barely touch it. Strong vs Psychic & Ghost.',
  },
  machopf: {
    name: 'Machop', hp: 105, dmg: 9, cd: 0.9, range: 0.5, speed: 2.5, sight: 6, squad: 4,
    cost: { b: 135, c: 40 }, time: 22, pop: 1, radius: 5,
    desc: 'Close-range brawler. Strong vs Normal, Rock & Steel. Can\'t hit flyers.',
  },
  abra: {
    name: 'Abra', hp: 40, dmg: 7.5, cd: 1.1, range: 4.5, speed: 2.3, sight: 8, squad: 4,
    cost: { b: 120, c: 125 }, time: 24, pop: 1, radius: 5, proj: 'psy', req: 'lab',
    desc: 'Psychic sniper. Fragile, but can teleport. Strong vs Fighting & Ghost.',
  },
  duraludon: {
    name: 'Duraludon', hp: 380, dmg: 26, cd: 2.4, range: 7.5, speed: 1.4, sight: 9, squad: 2,
    cost: { b: 220, c: 260 }, time: 40, pop: 3, radius: 9, proj: 'steelbeam', siege: 1.8, req: 'lab',
    desc: 'Siege tank of steel: slow, tough and very long range. Evolves into Archaludon.',
  },
};

// Every form a Pokémon can take. `next` lists evolutions: reach the XP and finish the research.
// `choice` evolutions are picked by the player with the Evolve button (Eevee).
export const FORMS = {
  machop: { line: 'machop', name: 'Machop', type: 'fighting', stage: 0 },
  charmander: { line: 'charmander', name: 'Charmander', type: 'fire', stage: 0, next: [{ to: 'charmeleon', r: 'evo_charmeleon' }] },
  charmeleon: { line: 'charmander', name: 'Charmeleon', type: 'fire', stage: 1, next: [{ to: 'charizard', r: 'evo_charizard' }] },
  charizard: { line: 'charmander', name: 'Charizard', type: 'fire', stage: 2, flying: true, mega: 'megacharizard' },
  megacharizard: { line: 'charmander', name: 'Mega Charizard Y', type: 'fire', stage: 3, flying: true, isMega: true, mult: { hp: 3.0, dmg: 3.0, range: 1.5 } },
  squirtle: { line: 'squirtle', name: 'Squirtle', type: 'water', stage: 0, next: [{ to: 'wartortle', r: 'evo_wartortle' }] },
  wartortle: { line: 'squirtle', name: 'Wartortle', type: 'water', stage: 1, next: [{ to: 'blastoise', r: 'evo_blastoise' }] },
  blastoise: { line: 'squirtle', name: 'Blastoise', type: 'water', stage: 2, mega: 'megablastoise' },
  megablastoise: { line: 'squirtle', name: 'Mega Blastoise', type: 'water', stage: 3, isMega: true, mult: { hp: 3.2, dmg: 2.6, range: 2 } },
  bulbasaur: { line: 'bulbasaur', name: 'Bulbasaur', type: 'grass', stage: 0, next: [{ to: 'ivysaur', r: 'evo_ivysaur' }] },
  ivysaur: { line: 'bulbasaur', name: 'Ivysaur', type: 'grass', stage: 1, next: [{ to: 'venusaur', r: 'evo_venusaur' }] },
  venusaur: { line: 'bulbasaur', name: 'Venusaur', type: 'grass', stage: 2, mega: 'megavenusaur' },
  megavenusaur: { line: 'bulbasaur', name: 'Mega Venusaur', type: 'grass', stage: 3, isMega: true, mult: { hp: 3.4, dmg: 2.5, range: 1.5 } },
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
  pidgeot: { line: 'pidgey', name: 'Pidgeot', type: 'flying', stage: 2, mega: 'megapidgeot' },
  megapidgeot: { line: 'pidgey', name: 'Mega Pidgeot', type: 'flying', stage: 3, isMega: true, mult: { hp: 2.8, dmg: 2.8, range: 1.5, speed: 1.15 }, mods: { noguard: 1 } },
  rayquaza: { line: 'rayquaza', name: 'Rayquaza', type: 'dragon', stage: 0, mouth: [66, -42], anim: 8, fast: 8, mega: 'megarayquaza' },
  megarayquaza: { line: 'rayquaza', name: 'Mega Rayquaza', type: 'dragon', stage: 1, isMega: true, mouth: [71, -48], anim: 8, fast: 8, proj: 'megabreath', mult: { hp: 1.8, dmg: 1.6, range: 1.5, speed: 1.2 } },
};

Object.assign(FORMS, {
  timburr: { line: 'timburr', name: 'Timburr', type: 'fighting', stage: 0 },
  mewtwo: { line: 'mewtwo', name: 'Mewtwo', type: 'psychic', stage: 0, scale: 1.35, mega: { mewtwonitex: 'megamewtwox', mewtwonitey: 'megamewtwoy' } },
  megamewtwox: { line: 'mewtwo', name: 'Mega Mewtwo X', type: 'fighting', stage: 1, isMega: true, scale: 1.35, proj: 'psy', mult: { hp: 1.7, dmg: 1.6, range: 0, speed: 1.15 }, mods: { onhit: { chance: 0.3, stun: 0.6 }, armor: 0.85 } },
  megamewtwoy: { line: 'mewtwo', name: 'Mega Mewtwo Y', type: 'psychic', stage: 1, isMega: true, scale: 1.35, mult: { hp: 1.4, dmg: 1.9, range: 1.5 } },
  gastly: { line: 'gastly', name: 'Gastly', type: 'ghost', stage: 0, next: [{ to: 'haunter', r: 'evo_haunter' }] },
  haunter: { line: 'gastly', name: 'Haunter', type: 'ghost', stage: 1, next: [{ to: 'gengar', r: 'evo_gengar' }] },
  gengar: { line: 'gastly', name: 'Gengar', type: 'ghost', stage: 2, mega: 'megagengar' },
  megagengar: { line: 'gastly', name: 'Mega Gengar', type: 'ghost', stage: 3, isMega: true, mult: { hp: 2.8, dmg: 3.0, range: 1.5 } },
  machopf: { line: 'machopf', name: 'Machop', type: 'fighting', stage: 0, next: [{ to: 'machoke', r: 'evo_machoke' }] },
  machoke: { line: 'machopf', name: 'Machoke', type: 'fighting', stage: 1, next: [{ to: 'machamp', r: 'evo_machamp' }] },
  machamp: { line: 'machopf', name: 'Machamp', type: 'fighting', stage: 2, mult: { hp: 2.5, dmg: 2.2, range: 0, cd: 0.85 } },
  abra: { line: 'abra', name: 'Abra', type: 'psychic', stage: 0, next: [{ to: 'kadabra', r: 'evo_kadabra' }] },
  kadabra: { line: 'abra', name: 'Kadabra', type: 'psychic', stage: 1, next: [{ to: 'alakazam', r: 'evo_alakazam' }] },
  alakazam: { line: 'abra', name: 'Alakazam', type: 'psychic', stage: 2, mega: 'megaalakazam' },
  megaalakazam: { line: 'abra', name: 'Mega Alakazam', type: 'psychic', stage: 3, isMega: true, mult: { hp: 2.6, dmg: 2.8, range: 2 }, mods: { chain: 2 } },
  duraludon: { line: 'duraludon', name: 'Duraludon', type: 'steel', stage: 0, next: [{ to: 'archaludon', r: 'evo_archaludon' }] },
  archaludon: { line: 'duraludon', name: 'Archaludon', type: 'steel', stage: 1, mult: { hp: 1.7, dmg: 1.6, range: 1.5 } },
});

export const BUILDINGS = {
  center: {
    name: 'Pokémon Center', short: 'CENTER', w: 3, h: 3, hp: 2600, cost: { b: 400, c: 0 }, time: 60, pop: 15, sight: 8,
    trains: ['machop'], dropoff: true, heal: true,
    desc: 'HQ. Trains workers, stores resources, heals nearby Pokémon.',
  },
  mart: {
    name: 'Poké Mart', short: 'MART', w: 2, h: 2, hp: 700, cost: { b: 100, c: 0 }, time: 20, pop: 15, sight: 5,
    desc: '+15 supply (+20 with Mart Expansion).',
  },
  gym: {
    name: 'Gym', short: 'GYM', w: 3, h: 3, hp: 1600, cost: { b: 150, c: 0 }, time: 35, sight: 6,
    trains: [], // the fighters in your deck (filled in below)
    desc: 'Trains the battle Pokémon in your deck. Pikachu and Snorlax need a Lab.',
  },
  lab: {
    name: 'Lab', short: 'LAB', w: 3, h: 3, hp: 1300, cost: { b: 150, c: 100 }, time: 40, sight: 6, req: 'gym',
    // every research in the game lives here (filled in below); the panel groups it by deck slot
    research: [],
    desc: 'All research: general upgrades, evolutions and every skill, grouped by Pokémon. Unlocks Pikachu and Snorlax.',
  },
  tower: {
    name: 'Tower', short: 'TOWER', w: 2, h: 2, hp: 900, cost: { b: 100, c: 50 }, time: 30, sight: 8, req: 'gym',
    dmg: 18, cd: 1.0, range: 6, type: 'normal', proj: 'ball',
    desc: 'Defensive tower that throws Poké Balls. Hits flyers too.',
  },
  skypillar: {
    name: 'Sky Pillar', short: 'PILLAR', w: 3, h: 3, hp: 1900, cost: { b: 300, c: 250 }, time: 60, sight: 9, req: 'lab',
    trains: [], // the legendary in your deck
    desc: 'Trains the legendary Pokémon in your deck. Unlocks legendary research and the Key Stone.',
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
  evo_pidgeotto: evo('pidgey', 'Pidgeotto', 'pidgeotto', 100, 75, 30),
  evo_pidgeot: evo('pidgey', 'Pidgeot', 'pidgeot', 200, 175, 45, 'evo_pidgeotto'),
  evo_haunter: evo('gastly', 'Haunter', 'haunter', 100, 90, 30),
  evo_gengar: evo('gastly', 'Gengar', 'gengar', 200, 200, 45, 'evo_haunter'),
  evo_machoke: evo('machopf', 'Machoke', 'machoke', 100, 60, 30),
  evo_machamp: evo('machopf', 'Machamp', 'machamp', 200, 150, 45, 'evo_machoke'),
  evo_kadabra: evo('abra', 'Kadabra', 'kadabra', 110, 100, 30),
  evo_alakazam: evo('abra', 'Alakazam', 'alakazam', 220, 200, 45, 'evo_kadabra'),
  evo_archaludon: { ...evo('duraludon', 'Archaludon', 'archaludon', 250, 250, 50), name: 'Metal Alloy', desc: 'Duraludon evolves into Archaludon once it has enough XP.' },
  thunderstone: { lines: ['pikachu', 'eevee'], name: 'Thunder Stone', icon: 'i:thunderstone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Pikachu → Raichu and Eevee → Jolteon.' },
  waterstone: { lines: ['eevee'], name: 'Water Stone', icon: 'i:waterstone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Eevee → Vaporeon.' },
  firestone: { lines: ['eevee'], name: 'Fire Stone', icon: 'i:firestone', cost: { b: 125, c: 100 }, time: 35, group: 'evo', desc: 'Eevee → Flareon.' },
  keystone: { name: 'Key Stone', icon: 'i:keystone', cost: { b: 250, c: 250 }, time: 50, reqB: 'skypillar', desc: 'Unlocks Mega Evolution: a Pokémon holding its Mega Stone (Rayquaza needs none) can Mega Evolve with the MEGA button.' },
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

// Mega Evolution: the squad leader transforms (invincible) for `transform` s, stays Mega for `time` s,
// then the squad waits `cd` s before it can Mega Evolve again. Needs the Key Stone research and the
// Pokémon's Mega Stone as its held item (Rayquaza needs no stone).
export const MEGA = { transform: 2, time: 60, cd: 150 };

// Held items: one per deck slot, used by every Pokémon from that slot.
export const ITEMS = {
  charizardite: { name: 'Charizardite', mega: 'charmander', color: '#f08030', desc: 'Lets Charizard Mega Evolve into Mega Charizard Y.' },
  blastoisinite: { name: 'Blastoisinite', mega: 'squirtle', color: '#6890f0', desc: 'Lets Blastoise Mega Evolve.' },
  venusaurite: { name: 'Venusaurite', mega: 'bulbasaur', color: '#78c850', desc: 'Lets Venusaur Mega Evolve.' },
  pidgeotite: { name: 'Pidgeotite', mega: 'pidgey', color: '#d8b060', desc: 'Lets Pidgeot Mega Evolve.' },
  gengarite: { name: 'Gengarite', mega: 'gastly', color: '#705898', desc: 'Lets Gengar Mega Evolve.' },
  alakazite: { name: 'Alakazite', mega: 'abra', color: '#f8c048', desc: 'Lets Alakazam Mega Evolve.' },
  mewtwonitex: { name: 'Mewtwonite X', mega: 'mewtwo', color: '#5878e8', desc: 'Mewtwo Mega Evolves into Mega Mewtwo X (Fighting).' },
  mewtwonitey: { name: 'Mewtwonite Y', mega: 'mewtwo', color: '#c068f0', desc: 'Mewtwo Mega Evolves into Mega Mewtwo Y (Psychic).' },
  leftovers: { name: 'Leftovers', desc: 'Heals 1% HP per second, even in combat.', mods: { cregen: 0.01 } },
  choiceband: { name: 'Choice Band', desc: '+25% damage.', mods: { dmg: 1.25 } },
  quickclaw: { name: 'Quick Claw', desc: 'Attacks 15% faster.', mods: { cd: 0.85 } },
  rockyhelmet: { name: 'Rocky Helmet', desc: 'Close-range attackers take 30% of their damage back.', mods: { thorns: 0.3 } },
  eviolite: { name: 'Eviolite', desc: 'Takes 30% less damage until fully evolved.', mods: { eviolite: 0.7 } },
  expertbelt: { name: 'Expert Belt', desc: 'Super-effective hits deal 25% more.', mods: { expert: 1.25 } },
  focussash: { name: 'Focus Sash', desc: 'Survives a fatal hit with 1 HP (once a minute).', mods: { sturdy: 60 } },
  scopelens: { name: 'Scope Lens', desc: '+1 attack range.', mods: { range: 1 } },
  shellbell: { name: 'Shell Bell', desc: 'Heals for 12% of the damage it deals.', mods: { lifesteal: 0.12 } },
  amuletcoin: { name: 'Amulet Coin', desc: 'Workers bring back 15% more per trip.', mods: { carry: 1.15 } },
};
export const ITEM_KEYS = Object.keys(ITEMS);
export const megaStoneFor = (line) => ITEM_KEYS.find((k) => ITEMS[k].mega === line);

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
  // --- Timburr (worker)
  repair: P({ line: 'timburr', name: 'Repair', type: 'fighting', glyph: 'hammer', desc: 'Idle workers repair damaged buildings nearby.', mods: { repair: 1 } }),
  construction: P({ line: 'timburr', name: 'Construction', type: 'fighting', glyph: 'hammer', desc: 'Workers build 60% faster.', mods: { build: 1.6 } }),
  ironfist: P({ line: 'timburr', name: 'Iron Fist', type: 'fighting', glyph: 'fist', desc: 'Workers deal triple damage.', mods: { dmg: 3 } }),
  sheerforce: P({ line: 'timburr', name: 'Sheer Force', type: 'fighting', glyph: 'muscle', desc: 'Workers have +70% HP.', mods: { hp: 1.7 } }),
  quickhaul: P({ line: 'timburr', name: 'Quick Haul', type: 'normal', glyph: 'bag', desc: 'Workers gather 15% faster and carry 20% more.', mods: { gather: 1.15, carry: 1.2 } }),
  rockclimb: P({ line: 'timburr', name: 'Rock Climb', type: 'rock', glyph: 'wing', desc: 'Workers move 30% faster.', mods: { speed: 1.3 } }),
  // --- Mewtwo (legendary)
  psystrike: A({ line: 'mewtwo', name: 'Psystrike', type: 'psychic', glyph: 'psy', cd: 14, range: 7, desc: 'A crushing psychic blast on a small area.',
    eff: { k: 'area', radius: 1.4, dmg: 170, delay: 0.3, bld: 0.5 }, legend: true }),
  psychic: A({ line: 'mewtwo', name: 'Psychic', type: 'psychic', glyph: 'swirl', cd: 20, range: 7, desc: 'Lifts enemies in an area into the air: damage and 1.5 s of helplessness.',
    eff: { k: 'area', radius: 2.2, dmg: 60, stun: 1.5 }, legend: true }),
  barrier: A({ line: 'mewtwo', name: 'Barrier', type: 'psychic', glyph: 'shield', cd: 24, range: 0, target: 'self', desc: 'Takes 70% less damage for 5 seconds.',
    eff: { k: 'buff', who: 'squad', t: 5, mods: { armor: 0.3 } }, legend: true }),
  recover: A({ line: 'mewtwo', name: 'Recover', type: 'normal', glyph: 'heart', cd: 35, range: 0, target: 'self', desc: 'Heals half of its HP.',
    eff: { k: 'roost', amount: 0.5 }, legend: true }),
  futuresight: A({ line: 'mewtwo', name: 'Future Sight', type: 'psychic', glyph: 'eye', cd: 22, range: 9, desc: 'Foresees an attack: 2.5 s later a huge blast hits the area.',
    eff: { k: 'area', radius: 2.6, dmg: 130, delay: 2.5, bld: 0.6 }, legend: true }),
  pressure: P({ line: 'mewtwo', name: 'Pressure', type: 'psychic', glyph: 'eye', desc: 'Enemies near Mewtwo attack 25% slower.', mods: { aura: { radius: 5, enemy: true, mods: { cd: 1.25 } } }, legend: true }),
  // --- Gastly line
  shadowball: A({ line: 'gastly', name: 'Shadow Ball', type: 'ghost', glyph: 'ghost', cd: 12, range: 5, desc: 'Every member hurls a ball of shadow.',
    eff: { k: 'line', each: true, dmg: 22, width: 10 } }),
  hypnosis: A({ line: 'gastly', name: 'Hypnosis', type: 'psychic', glyph: 'zzz', cd: 22, range: 6, desc: 'Puts enemies in an area to sleep for 3 seconds.',
    eff: { k: 'area', radius: 1.8, sleep: 3 } }),
  curse: A({ line: 'gastly', name: 'Curse', type: 'ghost', glyph: 'skull', cd: 20, range: 6, desc: 'Cursed enemies in an area take 35% more damage for 6 seconds.',
    eff: { k: 'area', radius: 2, debuff: { t: 6, mods: { armor: 1.35 } } } }),
  nightshade: A({ line: 'gastly', name: 'Night Shade', type: 'ghost', glyph: 'moon', cd: 14, range: 6, desc: 'Fixed damage to everything in an area, whatever its type.',
    eff: { k: 'area', radius: 2, dmg: 34, fixed: true } }),
  levitate: P({ line: 'gastly', name: 'Levitate', type: 'ghost', glyph: 'wing', desc: 'Floats: takes half damage from Rock and Fighting attacks.', mods: { resist: { rock: 0.5, fighting: 0.5 } } }),
  cursedbody: P({ line: 'gastly', name: 'Cursed Body', type: 'ghost', glyph: 'body', desc: 'Close-range attackers are slowed (40%).', mods: { contact: { chance: 0.4, slow: { t: 2, m: 0.6 } } } }),
  // --- Machop line (fighters)
  crosschop: A({ line: 'machopf', name: 'Cross Chop', type: 'fighting', glyph: 'fist', cd: 10, range: 5, desc: 'Every member leaps in with a chop.',
    eff: { k: 'dash', each: true, dmg: 26, speed: 12, radius: 0.8 } }),
  dynamicpunch: A({ line: 'machopf', name: 'Dynamic Punch', type: 'fighting', glyph: 'boom', cd: 16, range: 2, desc: 'A huge punch that stuns everything around the target.',
    eff: { k: 'area', radius: 1.4, dmg: 50, stun: 1.2 } }),
  seismictoss: A({ line: 'machopf', name: 'Seismic Toss', type: 'fighting', glyph: 'up', cd: 14, range: 2, desc: 'Throws enemies far away.',
    eff: { k: 'area', radius: 1.4, dmg: 32, knock: 30, fixed: true } }),
  focusenergy: A({ line: 'machopf', name: 'Focus Energy', type: 'fighting', glyph: 'muscle', cd: 24, range: 0, target: 'self', desc: '+50% damage for 6 seconds.',
    eff: { k: 'buff', who: 'squad', t: 6, mods: { dmg: 1.5 } } }),
  noguard: P({ line: 'machopf', name: 'No Guard', type: 'fighting', glyph: 'eye', desc: 'Attacks never miss and deal 10% more.', mods: { noguard: 1, dmg: 1.1 } }),
  innerfocus: P({ line: 'machopf', name: 'Inner Focus', type: 'fighting', glyph: 'shield', desc: 'Immune to sleep, paralysis, slow, burn and poison.', mods: { immune: 1 } }),
  // --- Abra line
  psybeam: A({ line: 'abra', name: 'Psybeam', type: 'psychic', glyph: 'beam', cd: 12, range: 6, desc: 'Every member fires a psychic beam that may confuse (stun 1 s).',
    eff: { k: 'line', each: true, dmg: 22, width: 8, stunChance: 0.3, stun: 1 } }),
  teleport: A({ line: 'abra', name: 'Teleport', type: 'psychic', glyph: 'swirl', cd: 18, range: 9, target: 'point', desc: 'The squad teleports anywhere close by.',
    eff: { k: 'teleport' } }),
  calmmind: A({ line: 'abra', name: 'Calm Mind', type: 'psychic', glyph: 'eye', cd: 24, range: 0, target: 'self', desc: '+40% damage and 20% less damage taken for 8 seconds.',
    eff: { k: 'buff', who: 'squad', t: 8, mods: { dmg: 1.4, armor: 0.8 } } }),
  lightscreen: A({ line: 'abra', name: 'Light Screen', type: 'psychic', glyph: 'shield', cd: 26, range: 0, target: 'self', desc: 'Allies nearby take 40% less damage from ranged attacks for 6 seconds.',
    eff: { k: 'buff', who: 'allies', radius: 4, t: 6, mods: { rangedArmor: 0.6 } } }),
  magicguard: P({ line: 'abra', name: 'Magic Guard', type: 'psychic', glyph: 'shield', desc: 'Burn and poison do no damage.', mods: { magicguard: 1 } }),
  telepathy: P({ line: 'abra', name: 'Telepathy', type: 'psychic', glyph: 'eye', desc: 'Dodges 20% of attacks.', mods: { dodge: 0.2 } }),
  // --- Duraludon line
  electroshot: A({ line: 'duraludon', name: 'Electro Shot', type: 'electric', glyph: 'beam', cd: 20, range: 9, desc: 'Charges for 2 s, then fires a huge beam; afterwards +40% damage for 6 s.',
    eff: { k: 'line', each: true, charge: 2, dmg: 110, width: 14, selfbuff: { t: 6, mods: { dmg: 1.4 } } } }),
  flashcannon: A({ line: 'duraludon', name: 'Flash Cannon', type: 'steel', glyph: 'beam', cd: 14, range: 8, desc: 'Every member fires a beam of light.',
    eff: { k: 'line', each: true, dmg: 55, width: 12 } }),
  dracometeor: A({ line: 'duraludon', name: 'Draco Meteor', type: 'dragon', glyph: 'rock', cd: 26, range: 9, desc: 'Meteors rain on an area. Lowers its own damage for 6 s.',
    eff: { k: 'area', radius: 2.6, dmg: 90, delay: 1.2, bld: 0.6, selfdebuff: { t: 6, mods: { dmg: 0.7 } } } }),
  irondefense: A({ line: 'duraludon', name: 'Iron Defense', type: 'steel', glyph: 'shield', cd: 22, range: 0, target: 'self', desc: 'Takes half damage for 6 seconds.',
    eff: { k: 'buff', who: 'squad', t: 6, mods: { armor: 0.5 } } }),
  stamina: P({ line: 'duraludon', name: 'Stamina', type: 'steel', glyph: 'shell', desc: 'Every hit taken raises its defense (up to 36% less damage).', mods: { stamina: 6 } }),
  stalwart: P({ line: 'duraludon', name: 'Stalwart', type: 'steel', glyph: 'rod', desc: 'Cannot be pushed or pulled, and +2 range.', mods: { stalwart: 1, range: 2 } }),
  airlock: P({ line: 'rayquaza', name: 'Air Lock', type: 'dragon', glyph: 'shield', desc: 'Immune to sleep, paralysis, slow, burn and poison.', mods: { immune: 1 }, legend: true }),
};
export const SKILL_KEYS = Object.keys(SKILLS);
export const skillsOf = (line) => SKILL_KEYS.filter((k) => SKILLS[k].line === line);
// starting loadouts until decks are built (3 per line)
export const DEFAULT_ITEMS = {
  machop: 'amuletcoin', charmander: 'charizardite', squirtle: 'blastoisinite', bulbasaur: 'venusaurite', geodude: 'quickclaw',
  eevee: 'eviolite', pikachu: 'expertbelt', pidgey: 'pidgeotite', snorlax: 'leftovers', rayquaza: 'shellbell',
  timburr: 'amuletcoin', mewtwo: 'mewtwonitey', gastly: 'gengarite', machopf: 'choiceband', abra: 'alakazite', duraludon: 'leftovers',
};
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
  timburr: ['repair', 'construction', 'ironfist'],
  mewtwo: ['psystrike', 'barrier', 'pressure'],
  gastly: ['shadowball', 'hypnosis', 'levitate'],
  machopf: ['crosschop', 'dynamicpunch', 'noguard'],
  abra: ['psybeam', 'teleport', 'magicguard'],
  duraludon: ['electroshot', 'flashcannon', 'stamina'],
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

// ---------------------------------------------------------------- decks
// A deck has 8 slots: 1 worker, 1 legendary and 6 fighters, each with a held item and 3 skills.
export const DECK_POOL = {
  worker: ['machop', 'timburr'],
  legend: ['rayquaza', 'mewtwo'],
  fighter: ['charmander', 'squirtle', 'bulbasaur', 'geodude', 'eevee', 'pikachu', 'pidgey', 'snorlax', 'gastly', 'machopf', 'abra', 'duraludon'],
};
export const DECK_CLASSES = ['worker', 'legend', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'];
export const lineClass = (line) => Object.keys(DECK_POOL).find((c) => DECK_POOL[c].includes(line));
BUILDINGS.center.trains = DECK_POOL.worker;
BUILDINGS.gym.trains = DECK_POOL.fighter;
BUILDINGS.skypillar.trains = DECK_POOL.legend;

const slot = (line, skills, item) => ({ line, skills: skills || DEFAULT_SKILLS[line], item: item === undefined ? DEFAULT_ITEMS[line] || null : item });
export const DEFAULT_DECK = {
  name: 'Starter',
  slots: ['machop', 'rayquaza', 'charmander', 'squirtle', 'bulbasaur', 'geodude', 'pikachu', 'snorlax'].map((l) => slot(l)),
};
// decks the computer plays with
export const AI_DECKS = [
  { name: 'Classic', slots: ['machop', 'rayquaza', 'charmander', 'squirtle', 'bulbasaur', 'geodude', 'pikachu', 'snorlax'].map((l) => slot(l)) },
  {
    name: 'Sky Storm',
    slots: [slot('machop'), slot('rayquaza', ['ascent', 'dragonbreath', 'deltastream']), slot('pidgey', ['hurricane', 'bravebird', 'keeneye']),
      slot('charmander', ['flamethrower', 'heatwave', 'blaze']), slot('pikachu', ['thunder', 'volttackle', 'static']), slot('eevee', ['quickattack', 'helpinghand', 'adaptability']),
      slot('squirtle', ['healpulse', 'hydropump', 'protect']), slot('geodude', ['rockslide', 'selfdestruct', 'sturdy'])],
  },
  {
    name: 'Bulwark',
    slots: [slot('machop', ['hustle', 'strength', 'guts']), slot('rayquaza', ['ascent', 'outrage', 'airlock']), slot('snorlax', ['bodyslam', 'yawn', 'immunity'], 'leftovers'),
      slot('squirtle', ['healpulse', 'protect', 'shellarmor']), slot('bulbasaur', ['sleeppowder', 'solarbeam', 'poisonpoint']), slot('geodude', ['rockslide', 'rollout', 'solidrock'], 'rockyhelmet'),
      slot('eevee', ['swift', 'helpinghand', 'anticipation']), slot('charmander', ['flamethrower', 'firespin', 'solarpower'])],
  },
  {
    name: 'Mind Games',
    slots: [slot('timburr'), slot('mewtwo', ['psystrike', 'futuresight', 'pressure'], 'mewtwonitey'), slot('abra', ['psybeam', 'calmmind', 'magicguard']),
      slot('gastly', ['shadowball', 'curse', 'levitate']), slot('machopf', ['crosschop', 'dynamicpunch', 'noguard']), slot('duraludon', ['electroshot', 'dracometeor', 'stamina']),
      slot('squirtle', ['healpulse', 'hydropump', 'shellarmor']), slot('pikachu', ['thunder', 'thunderwave', 'static'])],
  },
];

// Fixes up a deck (from storage or the network) so it is always legal: 8 slots of the right classes,
// no duplicate Pokémon, 3 different skills of that Pokémon, a known item.
export function validDeck(deck) {
  const out = { name: (deck && typeof deck.name === 'string' ? deck.name : 'Deck').slice(0, 16), slots: [] };
  const used = new Set();
  DECK_CLASSES.forEach((cls, i) => {
    const s = (deck && deck.slots && deck.slots[i]) || {};
    let line = DECK_POOL[cls].includes(s.line) && !used.has(s.line) ? s.line : null;
    if (!line) line = DEFAULT_DECK.slots.map((x) => x.line).concat(DECK_POOL[cls]).find((l) => DECK_POOL[cls].includes(l) && !used.has(l));
    used.add(line);
    const all = skillsOf(line);
    let skills = Array.isArray(s.skills) ? [...new Set(s.skills.filter((k) => all.includes(k)))] : [];
    for (const k of DEFAULT_SKILLS[line] || all) if (skills.length < 3 && !skills.includes(k)) skills.push(k);
    for (const k of all) if (skills.length < 3 && !skills.includes(k)) skills.push(k);
    const item = s.item === null || ITEMS[s.item] ? s.item ?? null : null;
    out.slots.push({ line, skills: skills.slice(0, 3), item });
  });
  return out;
}

export const UNIT_KEYS = Object.keys(UNITS);
export const FORM_KEYS = Object.keys(FORMS);
export const BUILDING_KEYS = Object.keys(BUILDINGS);
export const RES_KEYS = Object.keys(RESOURCES);
export const RESEARCH_KEYS = Object.keys(RESEARCH);

export const DIFFICULTY = {
  easy: { think: 2.0, gather: 0.75, workers: 10, firstWave: 10, waveGrow: 2, firstAttack: 420, counter: false, research: 0.4, moves: false, label: 'Easy' },
  normal: { think: 1.0, gather: 1.0, workers: 15, firstWave: 18, waveGrow: 4, firstAttack: 300, counter: true, research: 1, moves: true, label: 'Normal' },
  hard: { think: 0.5, gather: 1.3, workers: 19, firstWave: 18, waveGrow: 6, firstAttack: 210, counter: true, research: 1.5, moves: true, label: 'Hard' },
};
