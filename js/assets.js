// Loads the pixel-art PNGs from assets/. Replace any PNG to reskin the game.
import { FORMS, FORM_KEYS, BUILDING_KEYS, RES_KEYS, SKILL_KEYS, ITEM_KEYS } from './config.js';

const ICONS = ['thunderstone', 'waterstone', 'firestone', 'keystone', ...SKILL_KEYS, ...ITEM_KEYS];

function load(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { console.warn('missing asset', src); res(null); };
    img.src = src;
  });
}

export async function loadAssets() {
  const A = { units: {}, buildings: {}, res: {}, icons: {}, anim: {}, fast: {}, tiles: null };
  const jobs = [];
  for (const s of FORM_KEYS) jobs.push(load(`assets/units/${s}.png`).then((i) => (A.units[s] = i)));
  // flying animation sheets (frames side by side)
  for (const s of FORM_KEYS) if (FORMS[s].anim) jobs.push(load(`assets/units/${s}_anim.png`).then((i) => { if (i) A.anim[s] = { img: i, n: FORMS[s].anim }; }));
  // fast-flight frames (used while moving and during Dragon Ascent)
  for (const s of FORM_KEYS) if (FORMS[s].fast) jobs.push(load(`assets/units/${s}_fast.png`).then((i) => { if (i) A.fast[s] = { img: i, n: FORMS[s].fast }; }));
  for (const s of ICONS) jobs.push(load(`assets/icons/${s}.png`).then((i) => (A.icons[s] = i)));
  for (const b of BUILDING_KEYS) jobs.push(load(`assets/buildings/${b}.png`).then((i) => (A.buildings[b] = i)));
  for (const r of RES_KEYS) jobs.push(load(`assets/res/${r}.png`).then((i) => (A.res[r] = i)));
  jobs.push(load('assets/tiles.png').then((i) => (A.tiles = i)));
  await Promise.all(jobs);
  return A;
}

export function spriteUrl(kind, name) {
  return `assets/${kind}/${name}.png`;
}
