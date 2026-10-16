// Loads the pixel-art PNGs from assets/. Replace any PNG to reskin the game.
import { UNITS, BUILDING_KEYS, RES_KEYS } from './config.js';

function load(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { console.warn('missing asset', src); res(null); };
    img.src = src;
  });
}

export async function loadAssets() {
  const A = { units: {}, buildings: {}, res: {}, tiles: null };
  const jobs = [];
  const sprites = new Set(Object.values(UNITS).flatMap((u) => u.stages));
  for (const s of sprites) jobs.push(load(`assets/units/${s}.png`).then((i) => (A.units[s] = i)));
  for (const b of BUILDING_KEYS) jobs.push(load(`assets/buildings/${b}.png`).then((i) => (A.buildings[b] = i)));
  for (const r of RES_KEYS) jobs.push(load(`assets/res/${r}.png`).then((i) => (A.res[r] = i)));
  jobs.push(load('assets/tiles.png').then((i) => (A.tiles = i)));
  await Promise.all(jobs);
  return A;
}

export function spriteUrl(kind, name) {
  return `assets/${kind}/${name}.png`;
}
