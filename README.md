# Pokémon War

A real-time strategy game built for phones, playable in the browser and hosted on GitHub Pages.
Gather berries and crystals, build up your base, train Pokémon, evolve them in battle, and destroy every enemy Pokémon Center (their bases).

**Play:** https://thunderman48.github.io/pokemon-war/ (after GitHub Pages is enabled; see below)

> Free, non-profit fan game. Not affiliated with or endorsed by Nintendo, Game Freak, Creatures Inc. or
> The Pokémon Company. Pokémon and character names are trademarks of their respective owners.
> All pixel art in `assets/` is original art made for this project.

## What's new in V2

- **Evolution needs research**: Pokémon need battle XP *and* the matching Lab research to evolve
  (e.g. research Charmeleon, then Charizard). Stones unlock Raichu and Eevee's forms.
- **New Pokémon**: Eevee (you pick Vaporeon, Jolteon or Flareon), Geodude → Graveler → Golem,
  Pidgey → Pidgeotto → Pidgeot, and the legendary **Rayquaza → Mega Rayquaza**. Rayquaza is a huge flying dragon
  whose Dragon Breath hits an area, and you can only have one. Charizard can fly too.
- **Flying units** fly over trees and water. Close-range fighters (Machop, Snorlax) can't hit them.
- **New building**: the Sky Pillar trains flying Pokémon and Rayquaza, and unlocks the Mega Stone and Dragon Ascent research.
- **More research**, all at the Lab: Attack/Defense levels 1–3. Economy: Harvest, Big Bag, Mart Expansion. Buildings: Fortify, Training Drill, Tower Upgrade.
- **Special moves** you aim with a tap: Thunder (area damage), Heal Pulse (area heal), Sleep Powder (puts enemies to sleep) and Rayquaza's **Dragon Ascent** (rockets into the sky, then dives onto an area, stealing life from everything it hits).
- More types: Flying, Rock and Dragon.
- **Passive regeneration**: Pokémon out of combat for 5 seconds heal 2% of their max HP per second.
- The original game is still playable at `/v1/` (and saved on the `v1` branch).

## Features

- **Classic RTS**: workers, two resources, supply, buildings, tech requirements, research, fog of war.
- **VS Computer** on Easy, Normal or Hard. The AI researches, evolves, counters your army's types, uses special moves, focus-fires weak or type-weak targets, pulls wounded Pokémon back to heal, gathers its army before attacking and retreats from fights it can't win.
- **Online 1v1** with a 5-letter room code. Play is peer-to-peer over WebRTC (PeerJS), so no server is needed.
- **Made for touch**: tap to select and command, drag to scroll, pinch to zoom, long-press to box-select, a minimap, and quick ARMY / IDLE / BASE buttons. Mouse and keyboard also work on desktop.
- Can be installed to the home screen (PWA manifest) for fullscreen play.

## Roster

| Building | Cost (berries / crystals) | Trains | Research |
|---|---|---|---|
| Pokémon Center | 400 | Machop | |
| Poké Mart | 100 | | +10 supply |
| Gym | 150 | Charmander, Squirtle, Bulbasaur, Geodude, Eevee, Pikachu\*, Snorlax\* | |
| Lab (needs Gym) | 150 / 100 | | **All research**: Attack, Defense, every evolution, stones, special moves, Harvest, Big Bag, Mart Expansion, Fortify, Training Drill, Tower Upgrade, Mega Stone\*\*, Dragon Ascent\*\* |
| Tower (needs Gym) | 100 / 50 | | Defensive, hits flyers |
| Sky Pillar (needs Lab) | 300 / 250 | Pidgey, Rayquaza (max 1) | |

\*Pikachu and Snorlax need a Lab. \*\*Mega Stone and Dragon Ascent also need a Sky Pillar.

| Line | Type | Notes |
|---|---|---|
| Machop | Fighting | Worker |
| Charmander → Charmeleon → Charizard | Fire | Ranged. Charizard flies |
| Squirtle → Wartortle → Blastoise | Water | Tough brawler, Heal Pulse |
| Bulbasaur → Ivysaur → Venusaur | Grass | Long range, Sleep Powder |
| Geodude → Graveler → Golem | Rock | Tank, strong vs Fire & Flying |
| Eevee → Vaporeon / Jolteon / Flareon | Normal → Water / Electric / Fire | You choose. Vaporeon heals, Jolteon uses Thunder |
| Pikachu → Raichu | Electric | Fast, Thunder |
| Pidgey → Pidgeotto → Pidgeot | Flying | Fast flyer |
| Snorlax | Normal | Huge tank, double damage to buildings |
| Rayquaza → Mega Rayquaza | Dragon | Legendary flyer, area Dragon Breath, only one |

All numbers are in `js/config.js` if you want to rebalance.

## Turning on GitHub Pages

1. On GitHub, open the repo's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Pick the branch with the game (e.g. `main`) and the `/ (root)` folder, then **Save**.
4. After a minute the game is live at `https://<your-username>.github.io/pokemon-war/`.

There is no build step. The site is plain HTML, CSS, and JavaScript modules.

## Running locally

```bash
npx http-server -c-1 .     # then open http://localhost:8080
npm test                   # feature checks + headless AI-vs-AI match
```

(Opening `index.html` directly from disk won't work because browsers block ES modules on `file://`.)

## Editing the art

All sprites are PNGs in `assets/` (units, buildings, resources, tiles). Edit them in any pixel editor and refresh the page.
They are generated by `tools/make_assets.py` (needs Python + Pillow). Re-running that script **overwrites** the PNGs,
so either edit the character grids in the script or edit the PNGs directly, but not both.

## Online play notes

- The host's device runs the match, and the guest receives about 10 small updates per second.
- Matchmaking uses the free public PeerJS server. On some strict mobile or corporate networks, WebRTC can't connect.
  If that happens, try Wi-Fi or a different network.
- Keep the game in the foreground while hosting. Phones pause background tabs.

## Code map

| File | What it does |
|---|---|
| `js/config.js` | Units, buildings, research, type chart, AI difficulty |
| `js/map.js` | Seeded, mirror-symmetric map generator |
| `js/world.js` | Simulation: movement, combat, gathering, evolution, fog, network snapshots |
| `js/path.js` | A* pathfinding + path smoothing |
| `js/ai.js` | Computer opponent |
| `js/render.js` | Canvas renderer, effects, fog, minimap |
| `js/game.js` | Game loop, touch/mouse input, HUD |
| `js/net.js` | PeerJS multiplayer |
| `js/main.js` | Menus and lobby |
