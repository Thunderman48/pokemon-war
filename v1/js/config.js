// Game data: units, buildings, type chart. Tweak numbers here to rebalance.
export const TILE = 16;
export const MAP_SIZE = 64;
export const TICK = 1 / 20; // simulation step (seconds)
export const MAX_POP = 100;

export const TEAM_COLORS = ['#3d8bff', '#ff4d4d'];
export const TEAM_NAMES = ['Blue', 'Red'];

// attacker type -> defender type -> multiplier
const EFF = {
  fire: { grass: 1.5, water: 0.67, fire: 0.67 },
  water: { fire: 1.5, grass: 0.67, water: 0.67 },
  grass: { water: 1.5, fire: 0.67, grass: 0.67 },
  electric: { water: 1.5, grass: 0.67, electric: 0.67 },
  fighting: { normal: 1.5 },
  normal: {},
};
export function effectiveness(atk, def) {
  return (EFF[atk] && EFF[atk][def]) || 1;
}

export const TYPE_COLORS = {
  fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030',
  normal: '#a8a878', fighting: '#c03028', building: '#888',
};

// Evolution thresholds (XP = damage dealt) and stat multipliers per stage.
export const EVO_XP = [0, 120, 400];
export const EVO_MULT = [
  { hp: 1, dmg: 1, range: 0 },
  { hp: 1.5, dmg: 1.4, range: 0.5 },
  { hp: 2.2, dmg: 1.9, range: 1 },
];

// range/speed/sight in tiles, cd in seconds
export const UNITS = {
  machop: {
    name: 'Machop', type: 'fighting', hp: 60, dmg: 5, cd: 1.0, range: 0.4, speed: 2.6, sight: 6,
    cost: { b: 50, c: 0 }, time: 12, pop: 1, radius: 5, worker: true,
    stages: ['machop'], names: ['Machop'],
    desc: 'Worker. Gathers berries & crystals and builds.',
  },
  charmander: {
    name: 'Charmander', type: 'fire', hp: 90, dmg: 11, cd: 1.0, range: 3.5, speed: 2.4, sight: 7,
    cost: { b: 75, c: 25 }, time: 16, pop: 2, radius: 5, proj: 'ember',
    stages: ['charmander', 'charmeleon', 'charizard'], names: ['Charmander', 'Charmeleon', 'Charizard'],
    desc: 'Ranged fire attacker. Strong vs Grass.',
  },
  squirtle: {
    name: 'Squirtle', type: 'water', hp: 160, dmg: 9, cd: 0.9, range: 1.2, speed: 2.2, sight: 6,
    cost: { b: 100, c: 0 }, time: 16, pop: 2, radius: 6, proj: 'water',
    stages: ['squirtle', 'wartortle', 'blastoise'], names: ['Squirtle', 'Wartortle', 'Blastoise'],
    desc: 'Tough short-range fighter. Strong vs Fire.',
  },
  bulbasaur: {
    name: 'Bulbasaur', type: 'grass', hp: 105, dmg: 13, cd: 1.3, range: 4.5, speed: 2.1, sight: 7,
    cost: { b: 75, c: 50 }, time: 18, pop: 2, radius: 6, proj: 'leaf',
    stages: ['bulbasaur', 'ivysaur', 'venusaur'], names: ['Bulbasaur', 'Ivysaur', 'Venusaur'],
    desc: 'Long-range grass sniper. Strong vs Water.',
  },
  pikachu: {
    name: 'Pikachu', type: 'electric', hp: 85, dmg: 7, cd: 0.55, range: 3, speed: 3.3, sight: 8,
    cost: { b: 100, c: 50 }, time: 18, pop: 2, radius: 5, proj: 'bolt', req: 'lab',
    stages: ['pikachu', 'raichu'], names: ['Pikachu', 'Raichu'],
    desc: 'Fast, rapid attacks. Strong vs Water. Needs a Lab.',
  },
  snorlax: {
    name: 'Snorlax', type: 'normal', hp: 650, dmg: 30, cd: 1.6, range: 0.6, speed: 1.4, sight: 6,
    cost: { b: 200, c: 150 }, time: 35, pop: 6, radius: 10, siege: 2, req: 'lab',
    stages: ['snorlax'], names: ['Snorlax'],
    desc: 'Huge tank. Smashes buildings for double damage.',
  },
};

export const BUILDINGS = {
  center: {
    name: 'Pokémon Center', w: 3, h: 3, hp: 1500, cost: { b: 400, c: 0 }, time: 60, pop: 10, sight: 8,
    trains: ['machop'], dropoff: true, heal: true,
    desc: 'HQ. Trains workers, stores resources, heals nearby Pokémon.',
  },
  mart: {
    name: 'Poké Mart', w: 2, h: 2, hp: 450, cost: { b: 100, c: 0 }, time: 20, pop: 10, sight: 5,
    desc: '+10 supply.',
  },
  gym: {
    name: 'Gym', w: 3, h: 3, hp: 1000, cost: { b: 150, c: 0 }, time: 35, sight: 6,
    trains: ['charmander', 'squirtle', 'bulbasaur', 'pikachu'],
    desc: 'Trains battle Pokémon.',
  },
  lab: {
    name: 'Lab', w: 3, h: 3, hp: 800, cost: { b: 150, c: 100 }, time: 40, sight: 6, req: 'gym',
    trains: ['snorlax'], research: ['xattack', 'xdefend'],
    desc: 'Unlocks Pikachu, Snorlax, final evolutions and upgrades.',
  },
  tower: {
    name: 'Tower', w: 2, h: 2, hp: 550, cost: { b: 100, c: 50 }, time: 30, sight: 8, req: 'gym',
    dmg: 12, cd: 1.0, range: 6, type: 'normal', proj: 'ball',
    desc: 'Defensive tower that throws Poké Balls.',
  },
};

export const RESEARCH = {
  xattack: { name: 'X Attack', cost: { b: 150, c: 150 }, time: 45, desc: '+20% damage for all Pokémon.' },
  xdefend: { name: 'X Defend', cost: { b: 150, c: 150 }, time: 45, desc: 'All Pokémon take 20% less damage.' },
};

export const RESOURCES = {
  berry: { name: 'Berry Bush', amount: 400, per: 8, time: 1.6 },
  crystal: { name: 'Crystal', amount: 600, per: 5, time: 2.0 },
};

export const UNIT_KEYS = Object.keys(UNITS);
export const BUILDING_KEYS = Object.keys(BUILDINGS);
export const RES_KEYS = Object.keys(RESOURCES);
export const RESEARCH_KEYS = Object.keys(RESEARCH);

export const DIFFICULTY = {
  easy: { think: 2.0, gather: 0.75, workers: 10, firstWave: 10, waveGrow: 2, counter: false, label: 'Easy' },
  normal: { think: 1.0, gather: 1.0, workers: 15, firstWave: 18, waveGrow: 4, counter: true, label: 'Normal' },
  hard: { think: 0.5, gather: 1.3, workers: 19, firstWave: 16, waveGrow: 6, counter: true, label: 'Hard' },
};
