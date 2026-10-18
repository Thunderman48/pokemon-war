// Deck building: 8 slots (1 worker, 1 legendary, 6 fighters), each with a held item and 3 skills.
// Three decks are kept on the device; the one in use is brought into every match.
import {
  DECK_POOL, DECK_CLASSES, DEFAULT_DECK, ITEMS, ITEM_KEYS, SKILLS, FORMS, UNITS, TYPE_COLORS, validDeck, skillsOf, squadSize,
} from './config.js';

const KEY = 'pw-decks-v3';
const $ = (id) => document.getElementById(id);
const CLASS_NAME = { worker: 'WORKER', legend: 'LEGENDARY', fighter: 'FIGHTER' };

export function loadDecks() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
  const decks = [0, 1, 2].map((i) => validDeck((st && st.decks && st.decks[i]) || { ...DEFAULT_DECK, name: `Deck ${i + 1}` }));
  decks.forEach((d, i) => { if (!d.name || d.name === 'Starter') d.name = `Deck ${i + 1}`; });
  return { active: st && st.active >= 0 && st.active < 3 ? st.active : 0, decks };
}
export function saveDecks(st) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked: decks last for this visit */ }
}
export function activeDeck() {
  const st = loadDecks();
  return st.decks[st.active];
}

// the final form's name for a line (shown under the base form)
function finalName(line) {
  const forms = Object.keys(FORMS).filter((f) => FORMS[f].line === line && !FORMS[f].isMega);
  return FORMS[forms[forms.length - 1]].name;
}
const canMega = (line) => Object.values(FORMS).some((f) => f.line === line && f.mega);

export class DeckEditor {
  constructor(onChange) {
    this.st = loadDecks();
    this.sel = 2; // selected slot
    this.info = '';
    this.onChange = onChange;
    $('s-deck').addEventListener('click', (e) => this.click(e));
  }

  open() {
    this.st = loadDecks();
    this.render();
  }

  get deck() { return this.st.decks[this.st.active]; }

  save() {
    this.st.decks[this.st.active] = validDeck(this.deck);
    saveDecks(this.st);
    if (this.onChange) this.onChange();
  }

  click(e) {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const a = b.dataset.d, v = b.dataset.v;
    const d = this.deck, slot = d.slots[this.sel];
    switch (a) {
      case 'tab': this.st.active = +v; saveDecks(this.st); if (this.onChange) this.onChange(); break;
      case 'slot': this.sel = +v; this.info = ''; break;
      case 'line': {
        if (slot.line === v) break;
        const other = d.slots.findIndex((s) => s.line === v);
        if (other >= 0) { d.slots[other].line = slot.line; d.slots[other].skills = []; d.slots[other].item = null; } // swap places
        slot.line = v; slot.skills = []; slot.item = null;
        this.save();
        this.info = `${FORMS[v].name}: ${UNITS[v].desc}`;
        break;
      }
      case 'item': slot.item = slot.item === v ? null : v; this.info = v ? `${ITEMS[v].name}: ${ITEMS[v].desc}` : ''; this.save(); break;
      case 'skill': {
        const i = slot.skills.indexOf(v);
        if (i >= 0) slot.skills.splice(i, 1);
        else {
          if (slot.skills.length >= 3) slot.skills.shift(); // replace the oldest pick
          slot.skills.push(v);
        }
        this.info = `${SKILLS[v].name}: ${SKILLS[v].desc}`;
        // only save complete loadouts (validDeck would refill a missing pick)
        if (slot.skills.length === 3) this.save();
        break;
      }
      case 'reset':
        if (b.textContent !== 'SURE?') { b.textContent = 'SURE?'; return; }
        this.st.decks[this.st.active] = validDeck({ ...DEFAULT_DECK, name: `Deck ${this.st.active + 1}` });
        saveDecks(this.st);
        break;
    }
    this.render();
  }

  render() {
    const d = this.deck, sel = this.sel;
    $('deck-tabs').innerHTML = this.st.decks.map((x, i) =>
      `<button class="tab${i === this.st.active ? ' on' : ''}" data-d="tab" data-v="${i}">${x.name}${i === this.st.active ? ' ✓' : ''}</button>`).join('');
    $('deck-slots').innerHTML = d.slots.map((s, i) => {
      const cls = DECK_CLASSES[i];
      return `<button class="dslot ${cls}${i === sel ? ' on' : ''}" data-d="slot" data-v="${i}">
        <span class="dcls">${CLASS_NAME[cls]}</span>
        <img class="dmon" src="assets/units/${s.line}.png" alt="">
        <span class="dname">${FORMS[s.line].name}</span>
        <span class="dicons">${s.skills.map((k) => `<img src="assets/icons/${k}.png" alt="">`).join('')}${s.item ? `<img class="ditem" src="assets/icons/${s.item}.png" alt="">` : ''}</span>
      </button>`;
    }).join('');
    const slot = d.slots[sel], cls = DECK_CLASSES[sel], line = slot.line, f = FORMS[line];
    const u = UNITS[line];
    const pool = DECK_POOL[cls];
    const items = ITEM_KEYS.filter((k) => !ITEMS[k].mega || ITEMS[k].mega === line);
    const skills = skillsOf(line);
    $('deck-edit').innerHTML = `
      <div class="dhead"><img src="assets/units/${line}.png" alt=""><div><b>${f.name}</b> <span class="type" style="background:${TYPE_COLORS[f.type]}">${f.type.toUpperCase()}</span>
        <div class="dsub">${CLASS_NAME[cls]}${squadSize(line) > 1 ? ` · SQUAD OF ${squadSize(line)}` : ''}${finalName(line) !== f.name ? ` · evolves to ${finalName(line)}` : ''}${canMega(line) || line === 'rayquaza' ? ' · MEGA' : ''}</div></div></div>
      <div class="dlabel">POKÉMON</div>
      <div class="dpick">${pool.map((l) => {
        const at = d.slots.findIndex((s) => s.line === l);
        return `<button class="dmon${l === line ? ' on' : ''}${at >= 0 && at !== sel ? ' used' : ''}" data-d="line" data-v="${l}"><img src="assets/units/${l}.png" alt=""><span>${FORMS[l].name}</span></button>`;
      }).join('')}</div>
      <div class="dlabel">HELD ITEM</div>
      <div class="dpick items">${items.map((k) => `<button class="ditem${slot.item === k ? ' on' : ''}" data-d="item" data-v="${k}"><img src="assets/icons/${k}.png" alt=""><span>${ITEMS[k].name}</span></button>`).join('')}</div>
      <div class="dlabel">SKILLS <span class="dcount${slot.skills.length < 3 ? ' warn' : ''}">${slot.skills.length}/3${slot.skills.length < 3 ? ' — pick 3' : ''}</span></div>
      <div class="dskills">${skills.map((k) => {
        const S = SKILLS[k];
        return `<button class="dskill${slot.skills.includes(k) ? ' on' : ''}" data-d="skill" data-v="${k}"><img src="assets/icons/${k}.png" alt="">
          <span class="sn">${S.name} <i class="${S.kind === 'a' ? 'act' : 'pas'}">${S.kind === 'a' ? 'ACTIVE' : 'PASSIVE'}</i></span><span class="sd">${S.desc}</span></button>`;
      }).join('')}</div>
      <div class="dinfo">${this.info || (u ? u.desc : '')}</div>`;
  }
}

// small "DECK: name" chooser shown before a match
export function deckChooserHtml() {
  const st = loadDecks();
  return `DECK: <b>${st.decks[st.active].name}</b> ▸`;
}
export function cycleDeck() {
  const st = loadDecks();
  st.active = (st.active + 1) % 3;
  saveDecks(st);
}
