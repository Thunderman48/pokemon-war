// Entry point: menus, lobby, starting/stopping games.
import { loadAssets } from './assets.js';
import { Game } from './game.js';
import { host, join } from './net.js';
import { unlockAudio, isMuted, setMuted, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
let assets = null;
let game = null;
let cancelHost = null;
let lobbyConn = null;

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}
function hideScreens() {
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
}

function start(opts) {
  hideScreens();
  if (game) game.destroy();
  game = new Game({ ...opts, assets });
  if (window.matchMedia('(orientation: portrait)').matches && 'ontouchstart' in window && !sessionStorage.getItem('pw-rot')) {
    $('rotate-hint').hidden = false;
  }
}

function endGame() {
  if (game) game.destroy();
  game = null;
  show('s-title');
}

function setStatus(html) { $('online-status').innerHTML = html; }

function resetLobby() {
  if (cancelHost) { cancelHost(); cancelHost = null; }
  if (lobbyConn) { lobbyConn.close(); lobbyConn = null; }
  $('btn-host').disabled = false;
  $('btn-join').disabled = false;
  setStatus('');
}

async function hostGame() {
  unlockAudio();
  resetLobby();
  $('btn-host').disabled = true;
  $('btn-join').disabled = true;
  setStatus('Creating room…');
  try {
    const conn = await host((code, cancel) => {
      cancelHost = cancel;
      setStatus(`Share this code with your friend:<span class="code">${code}</span>Waiting for them to join…`);
    });
    cancelHost = null;
    const seed = Math.floor(Math.random() * 1e9);
    conn.send({ t: 'start', seed });
    start({ mode: 'host', seed, conn });
  } catch (e) {
    if (e.message !== 'cancelled') setStatus(e.message);
    $('btn-host').disabled = false;
    $('btn-join').disabled = false;
  }
}

async function joinGame() {
  unlockAudio();
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length < 5) { setStatus('Enter the 5-letter code from the host.'); return; }
  resetLobby();
  $('btn-host').disabled = true;
  $('btn-join').disabled = true;
  setStatus('Connecting…');
  try {
    const conn = await join(code);
    lobbyConn = conn;
    setStatus('Connected! Starting…');
    conn.onMessage((m) => {
      if (m && m.t === 'start') {
        lobbyConn = null;
        start({ mode: 'guest', seed: m.seed, conn });
      }
    });
    conn.onClose(() => { if (lobbyConn) { setStatus('Host left.'); resetLobby(); } });
  } catch (e) {
    setStatus(e.message);
    $('btn-host').disabled = false;
    $('btn-join').disabled = false;
  }
}

function updateSoundBtn() { $('btn-sound').textContent = `SOUND: ${isMuted() ? 'OFF' : 'ON'}`; }

async function init() {
  assets = await loadAssets();
  $('loading').hidden = true;
  $('hero').innerHTML = ['charmander', 'squirtle', 'pikachu', 'bulbasaur', 'snorlax']
    .map((s) => `<img src="assets/units/${s}.png" alt="">`).join('');

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { unlockAudio(); sfx('select'); show(go.dataset.go); }
    const diff = e.target.closest('[data-diff]');
    if (diff) {
      unlockAudio();
      start({ mode: 'ai', difficulty: diff.dataset.diff, seed: Math.floor(Math.random() * 1e9) });
    }
  });
  $('btn-host').addEventListener('click', hostGame);
  $('btn-join').addEventListener('click', joinGame);
  $('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinGame(); });
  $('btn-online-back').addEventListener('click', () => { resetLobby(); show('s-title'); });
  $('btn-fullscreen').addEventListener('click', async () => {
    unlockAudio();
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement) await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
    } catch (e) { /* not supported (e.g. iPhone): use Add to Home Screen */ }
  });

  // pause menu
  $('btn-menu').addEventListener('click', () => {
    if (!game) return;
    if (game.mode === 'ai') game.paused = true;
    updateSoundBtn();
    $('btn-quit').textContent = 'SURRENDER';
    $('s-pause').hidden = false;
  });
  $('btn-resume').addEventListener('click', () => { $('s-pause').hidden = true; if (game) game.paused = false; });
  $('btn-sound').addEventListener('click', () => { setMuted(!isMuted()); updateSoundBtn(); });
  $('btn-help2').addEventListener('click', () => { $('s-pause').hidden = true; show('s-help'); $('s-help').dataset.back = 'game'; });
  $('btn-quit').addEventListener('click', () => {
    const b = $('btn-quit');
    if (b.textContent !== 'TAP AGAIN') { b.textContent = 'TAP AGAIN'; return; }
    $('s-pause').hidden = true;
    if (!game) return;
    game.paused = false;
    game.issue({ c: 'surrender' });
    if (game.mode === 'guest') setTimeout(() => game && !game.over && game.finish('lose'), 1500);
  });
  $('btn-again').addEventListener('click', () => { $('s-over').hidden = true; endGame(); });
  $('btn-rotate-ok').addEventListener('click', () => { $('rotate-hint').hidden = true; sessionStorage.setItem('pw-rot', '1'); });
  window.addEventListener('orientationchange', () => {
    if (window.matchMedia('(orientation: landscape)').matches) $('rotate-hint').hidden = true;
  });
  // "How to play" opened from the pause menu returns to the game
  document.querySelector('#s-help [data-go]').addEventListener('click', (e) => {
    if ($('s-help').dataset.back === 'game' && game) {
      e.stopPropagation();
      $('s-help').dataset.back = '';
      hideScreens();
      $('s-pause').hidden = false;
    }
  });
  // pause when the tab is hidden (single player)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && game.mode === 'ai' && !game.over) {
      game.paused = true;
      updateSoundBtn();
      $('s-pause').hidden = false;
    }
  });
  show('s-title');
}

// handy for debugging from the browser console
window.pokewar = { get game() { return game; } };

init();
