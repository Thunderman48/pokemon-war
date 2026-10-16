// Peer-to-peer online play via PeerJS (works on static hosting like GitHub Pages).
// The host runs the simulation; the guest sends commands and receives snapshots.
const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'pkmnwar-rts-';

let loading = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PEERJS_URL;
      s.onload = () => res();
      s.onerror = () => { loading = null; rej(new Error('Could not load the multiplayer library. Check your connection.')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function wrap(peer, conn) {
  const handlers = { message: () => {}, close: () => {} };
  let closed = false;
  const fireClose = () => { if (!closed) { closed = true; handlers.close(); } };
  conn.on('data', (d) => handlers.message(d));
  conn.on('close', fireClose);
  conn.on('error', fireClose);
  peer.on('disconnected', () => { /* signalling lost; data channel may still be alive */ });
  return {
    send(msg) { if (conn.open) conn.send(msg); },
    onMessage(fn) { handlers.message = fn; },
    onClose(fn) { handlers.close = fn; },
    close() { closed = true; try { conn.close(); } catch (e) { /* ignore */ } try { peer.destroy(); } catch (e) { /* ignore */ } },
  };
}

// Host: resolves with a connection once a guest joins. onCode(code) is called when ready.
export async function host(onCode) {
  await loadPeer();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    try {
      const result = await new Promise((resolve, reject) => {
        const peer = new window.Peer(PREFIX + code.toLowerCase());
        let ready = false;
        peer.on('open', () => { ready = true; onCode(code, () => { peer.destroy(); reject(new Error('cancelled')); }); });
        peer.on('error', (e) => { if (!ready) { peer.destroy(); reject(e); } });
        peer.on('connection', (conn) => {
          conn.on('open', () => resolve(wrap(peer, conn)));
        });
      });
      return result;
    } catch (e) {
      if (e.message === 'cancelled') throw e;
      if (e.type !== 'unavailable-id') throw new Error(friendly(e));
    }
  }
  throw new Error('Could not create a room. Try again.');
}

export async function join(code) {
  await loadPeer();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer();
    const timer = setTimeout(() => { peer.destroy(); reject(new Error('Timed out. Check the code and try again.')); }, 15000);
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code.trim().toLowerCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => { clearTimeout(timer); resolve(wrap(peer, conn)); });
    });
    peer.on('error', (e) => { clearTimeout(timer); peer.destroy(); reject(new Error(friendly(e))); });
  });
}

function friendly(e) {
  if (e.type === 'peer-unavailable') return 'No game found with that code.';
  if (e.type === 'network' || e.type === 'server-error') return 'Could not reach the matchmaking server.';
  if (e.type === 'browser-incompatible') return 'Your browser does not support online play.';
  return e.message || String(e);
}
