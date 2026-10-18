# Pokémon War

A real-time strategy game built for phones, playable in the browser and hosted on GitHub Pages.
Gather berries and crystals, build up your base, train Pokémon, evolve them in battle, and destroy every enemy Pokémon Center (their bases).

**Play:** https://thunderman48.github.io/pokemon-war/ (after GitHub Pages is enabled; see below)

> Free, non-profit fan game. Not affiliated with or endorsed by Nintendo, Game Freak, Creatures Inc. or
> The Pokémon Company. Pokémon and character names are trademarks of their respective owners.
> All pixel art in `assets/` is original art made for this project.

## What's new in V3: combat rework

- **Squads** (Dawn of War style): battle Pokémon train in squads (4 small Pokémon, 3 Geodude, 2 Snorlax or Duraludon,
  1 legendary) that move and fight together, share XP and evolve together. Fallen members come back on their own after a
  few seconds out of combat, for 30% of a member's price. Supply is bigger (200) and a squad holds supply for its full size.
- **Deck building**: on the DECK screen pick 1 worker, 1 legendary and 6 fighters (no Pokémon twice), and for each one a
  held item and 3 of its 6 skills. Three decks are saved on your device; bring one into every match (online too).
- **Skills**: every Pokémon has 6 skills, passive (always on) or active. Each skill is researched at the Lab. Active skills
  are used automatically when a good target is near; turn AUTO off on a squad to aim them yourself. Burn, poison,
  paralysis, sleep, slow, knock-back, buffs, debuffs and auras.
- **Held items**: Mega Stones, Leftovers, Choice Band, Quick Claw, Rocky Helmet, Eviolite, Expert Belt, Focus Sash,
  Scope Lens, Shell Bell, Amulet Coin.
- **Mega Evolution**: with the Key Stone researched and its Mega Stone held (Rayquaza needs none), a fully evolved squad's
  leader can Mega Evolve with the MEGA button: an invincible 2-second transformation, 60 seconds as a Mega with a special
  effect (Mega Rayquaza's storm darkens the sky and calls down lightning), then a cooldown.
- **New Pokémon**: Timburr (worker that repairs buildings), Mewtwo (legendary, Mega X or Y), Gastly → Haunter → Gengar,
  Machop → Machoke → Machamp, Abra → Kadabra → Alakazam, Duraludon → Archaludon (a slow, long-range siege tank with
  Stamina and Electro Shot). New types: Psychic, Ghost and Steel.
- The AI brings its own decks, uses skills and Mega Evolution, and waits a while before its first attack (Easy 7 min,
  Normal 5 min, Hard 3.5 min).
- V2 is still playable at `/v2/` (and on the `v2` branch), V1 at `/v1/`.

## Features

- **Classic RTS**: workers, two resources, supply, buildings, tech requirements, research, fog of war.
- **VS Computer** on Easy, Normal or Hard. The AI researches, evolves, counters your army's types, uses skills and Mega
  Evolution, focus-fires, pulls wounded squads back to heal and refill, gathers its army before attacking and retreats
  from fights it can't win.
- **Online 1v1** with a 5-letter room code. Play is peer-to-peer over WebRTC (PeerJS), so no server is needed.
- **Made for touch**: tap to select and command, drag to scroll, pinch to zoom, long-press to box-select, a minimap,
  and quick ARMY / IDLE / BASE buttons. Mouse and keyboard also work on desktop.
- Can be installed to the home screen (PWA manifest) for fullscreen play.

## Buildings

| Building | Cost (berries / crystals) | Trains | Notes |
|---|---|---|---|
| Pokémon Center | 400 | Your deck's worker | Drop-off, heals nearby Pokémon, +15 supply |
| Poké Mart | 100 | | +15 supply (+20 with Mart Expansion) |
| Gym | 150 | Your deck's 6 fighters | Pikachu, Abra, Snorlax and Duraludon need a Lab |
| Lab (needs Gym) | 150 / 100 | | **All research**, in pages: GENERAL and one per Pokémon in your deck |
| Tower (needs Gym) | 100 / 50 | | Defensive, hits flyers |
| Sky Pillar (needs Lab) | 300 / 250 | Your deck's legendary (max 1) | Unlocks legendary skills and the Key Stone |

## Pokémon

| Class | Line | Type | Squad | Mega |
|---|---|---|---|---|
| Worker | Machop | Fighting | 1 | |
| Worker | Timburr | Fighting | 1 | |
| Legendary | Rayquaza | Dragon | 1 | Mega Rayquaza (no stone) |
| Legendary | Mewtwo | Psychic | 1 | Mega Mewtwo X / Y |
| Fighter | Charmander → Charmeleon → Charizard | Fire | 4 | Mega Charizard Y |
| Fighter | Squirtle → Wartortle → Blastoise | Water | 4 | Mega Blastoise |
| Fighter | Bulbasaur → Ivysaur → Venusaur | Grass | 4 | Mega Venusaur |
| Fighter | Geodude → Graveler → Golem | Rock | 3 | |
| Fighter | Eevee → Vaporeon / Jolteon / Flareon | Normal | 4 | |
| Fighter | Pikachu → Raichu | Electric | 4 | |
| Fighter | Pidgey → Pidgeotto → Pidgeot | Flying | 4 | Mega Pidgeot |
| Fighter | Snorlax | Normal | 2 | |
| Fighter | Gastly → Haunter → Gengar | Ghost | 4 | Mega Gengar |
| Fighter | Machop → Machoke → Machamp | Fighting | 4 | |
| Fighter | Abra → Kadabra → Alakazam | Psychic | 4 | Mega Alakazam |
| Fighter | Duraludon → Archaludon | Steel | 2 | |

Every line's 6 skills are listed in the DECK screen. All numbers are in `js/config.js` if you want to rebalance.

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
node tests/difficulty.mjs 6 hard normal   # AI difficulty ladder
```

(Opening `index.html` directly from disk won't work because browsers block ES modules on `file://`.)

## Editing the art

All sprites are PNGs in `assets/` (units, buildings, resources, tiles). Edit them in any pixel editor and refresh the page.
They are generated by `tools/make_assets.py` (sprites, items, buildings; V3 Pokémon live in `tools/new_sprites.py`,
Megas in `tools/mega_sprites.py`, Rayquaza in `tools/rayquaza.py`) and `tools/skill_icons.py` (skill icons). Both need
Python + Pillow. Re-running them **overwrites** the PNGs, so either edit the character grids in the scripts or edit the
PNGs directly, but not both.

## Online play notes

- The host's device runs the match, and the guest receives about 10 small updates per second.
- Matchmaking uses the free public PeerJS server. On some strict mobile or corporate networks, WebRTC can't connect.
  If that happens, try Wi-Fi or a different network.
- Keep the game in the foreground while hosting. Phones pause background tabs.

## Code map

| File | What it does |
|---|---|
| `js/config.js` | Units, forms, buildings, research, skills, items, decks, type chart, AI difficulty |
| `js/map.js` | Seeded, mirror-symmetric map generator |
| `js/world.js` | Simulation: movement, combat, squads, gathering, evolution, fog, network snapshots |
| `js/skills.js` | Skill engine: passives, status effects, active skills, auto-casting |
| `js/mega.js` | Mega Evolution and each Mega's special effect |
| `js/deck.js` | Deck builder screen and saved decks |
| `js/path.js` | A* pathfinding + path smoothing |
| `js/ai.js` | Computer opponent |
| `js/render.js` | Canvas renderer, effects, fog, minimap |
| `js/skillfx.js`, `js/megafx.js` | Skill, status and Mega visuals |
| `js/game.js` | Game loop, touch/mouse input, HUD |
| `js/net.js` | PeerJS multiplayer |
| `js/main.js` | Menus and lobby |
