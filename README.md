# DIGO EVOLUTION

A mobile-first 3D arcade survival game. DIGO runs along the ground near the bottom of a
portrait screen while rewards and hazards rain down from above. Move, collect, dodge,
survive, evolve.

**Not a clicker game.** You never tap individual coins. You drag your finger left and right
across the play area and DIGO follows it horizontally, while the world falls toward you.
Swipe up to jump. There are no on-screen arrow buttons.

---

## Feature overview

| Area | What is implemented |
| --- | --- |
| Character | Real-time 3D DIGO built procedurally in Three.js from the reference art: round cream body, big cyan eyes, pink inner ears, glowing chest crystal, tail. 5 evolution stages with distinct palettes, scale, crown/wings/aura features. |
| Animations | `idle`, `run`, `left`, `right`, `dodge`, `collect`, `damage`, `jump`, `victory`, `defeat` — all blended, all preserving the same face and silhouette. |
| Rewards | Gold DIGO coin, rare diamond, energy crystal, mystery chest, legendary reward. Each has a unique silhouette, glow, particles and sound. |
| Dangers | Bomb (fuse + sparks + flashing red), meteor (flame + smoke), electric hazard (arcs), spike trap, hostile enemy. Never visually confusable with rewards. |
| Power-ups | Shield, magnet, slow motion, double reward, speed boost, invincibility. |
| Worlds | Tropical Island, Cyberpunk Neon City, Ancient Treasure Temple, Space Galaxy, Lava World, Crystal Kingdom, Frozen Mountain. Each has its own sky, fog, lighting, ground, music scale/tempo and hazard flavour. |
| Campaign | 100 levels across all 7 worlds, grouped into 10 chapters of 10. Every level has one clear objective (collect DIGO, survive the clock, reach a score), its own time limit, its own completion bonus and a 1–3 star score ladder. Difficulty ramps from level 1 to 100, every target is reachable, and progress unlocks in order and saves automatically. |
| Progression | Level records, stars, accumulated DIGO, lifetime totals and settings persisted in `localStorage`; 5 character evolution stages; achievements; per-level leaderboard on the server. Finishing level 100 opens a completion screen where **Start New Journey** replays the campaign from level 1 while keeping lifetime points, DIGO and achievements. |
| Audio | Fully procedural Web Audio engine (no binary assets): per-reward collect sounds, bomb warning, explosion, damage, power-up, level up, victory/defeat, plus per-world generative background music and independent music/SFX volume. |
| Controls | Finger swipes over Pointer Events with pointer capture: drag left/right to steer (relative to DIGO's position, so the character never teleports under your thumb), swipe up to jump, multi-touch safe, and releasing or cancelling the touch stops movement instantly. No text selection, no page scroll, no stuck movement. Desktop keeps `A`/`D`, arrow keys and `Space`. |
| Backend | Express API with HMAC-signed run tickets, server-side score plausibility validation, per-mode leaderboard, and Phantom wallet ownership verification via ed25519 signature. |

---

## Tech stack

- **React 19 + TypeScript + Vite** — UI, menus, HUD, routing between screens.
- **Three.js** — 3D character, worlds, falling objects, particles, lighting.
- **Express + Node** — one server that serves the built client and the JSON API.
- **tweetnacl + bs58** — Solana wallet signature verification (verification only).

The client and server are ordinary, portable source files. Nothing is locked inside a
proprietary platform; `npm install && npm run build && npm start` reproduces the game.

---

## Quick start

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173 (proxies /api to :3000)
# in a second terminal:
npm run server     # API + static server on http://localhost:3000
```

Production-style run (single port, this is what the container does):

```bash
npm install
npm run build
npm start          # http://localhost:3000
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with API proxy |
| `npm run server` | API + built client on `PORT` (default 3000) |
| `npm run build` | Type-check-free production bundle into `dist/` |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm start` | Serve `dist/` + API (production entry) |

---

## Playing on a phone

1. Open the deployed URL in Chrome on Android (or any modern mobile browser).
2. Tap **Connect Phantom** first — this build runs the wallet gate in mock/test mode,
   so connecting unlocks the level select. No transaction is sent and no keys are requested.
3. Pick a level and press **Play**.
3. Touch anywhere in the play area and **drag** left or right — DIGO follows your finger
   and keeps moving while you hold.
4. **Swipe up** to jump over a hazard.
5. Collect bright, glowing rewards. Avoid everything black/red/burning/spiky.
6. Release to stop.

Portrait orientation is the primary layout; the game also runs in landscape and on
desktop (mouse drag and `A`/`D` or arrow keys).

---

## Full ownership / fresh clone

This repository is the complete, self-contained game. Nothing lives only in a hosted
builder: clone it anywhere with Node 20+ and it builds and runs.

```bash
git clone https://github.com/Digoisaworld/digogame.git
cd digogame
git checkout appjet          # active development branch (latest game code)
npm ci                       # exact, locked dependency tree
npm run build                # production bundle -> dist/
npm start                    # http://localhost:3000
```

All art, geometry, textures, animation and audio are generated in code at runtime, so
there are no external asset packs, CDN downloads or binary model files to fetch — the
two PNG files are the only image assets and both are committed. `dist/` and
`node_modules/` are build outputs and are intentionally not committed.

---

## Architecture

```
public/digo/digo-logo.png    official DIGO logo (served with the app)
digo-logo-transparent.png    official DIGO logo reference image (repo root)
index.html                   Vite entry + mobile viewport meta
package.json                 dependencies, scripts, engines (Node >= 20)
package-lock.json            exact dependency lock (npm ci is reproducible)
vite.config.ts               Vite + React plugin, /api dev proxy
tsconfig.json                strict TypeScript config
Dockerfile                   multi-stage Alpine production image, non-root user
.env.example                 every supported environment variable, documented
server/
  index.js                   Express API + static hosting + run validation
  campaign.js                server copy of the 100-level table used for validation
src/
  main.tsx                   app bootstrap
  App.tsx                    screen router, wallet gate, run configuration
  game/
    types.ts                 shared types, reward/danger/power tables, RunConfig, RunResult
    worlds.ts                7 world definitions (palette, fog, music, hazard flavour)
    levels.ts                100-level campaign: 10 chapters, objectives, time limits, stars
    rewards.ts               logarithmic bonus curve + transparent payout breakdown
    progress.ts              profile persistence, XP, evolution stages, settings
    DigoGame.ts              engine: renderer, camera, lights, loop, entities, HUD events
    character/DigoModel.ts   procedural DIGO rig, materials, 10 animations, 5 stages
    entities/objectFactory.ts reward, danger and power-up meshes with VFX + pooling
    render/textures.ts       procedural canvas textures (metal, rock, crystal, ground)
    render/ParticleSystem.ts pooled particle bursts for pickups, hits, explosions
    systems/InputController.ts pointer-capture finger swipes (steer + jump), keyboard
    audio/AudioManager.ts    procedural SFX + generative per-world music
  lib/
    wallet.ts                wallet state store + mock/test mode adapter
    phantom.ts               Phantom provider discovery, connect, sign, short address
    api.ts                   typed client for run/leaderboard/wallet endpoints
  ui/
    Menu.tsx                 main menu, level select, character select
    GameScreen.tsx           canvas host, HUD, pause, victory/game-over
    icons.tsx                inline SVG icon set (no icon font dependency)
    styles.css               mobile-first theme
```

### Key contracts

- `new DigoGame(container, config, emit)` — `config: RunConfig`, `emit(event: GameEvent)`.
  Engine methods: `attachPad(el)`, `setButton(dir, down)`, `pause()`, `resume()`,
  `togglePause()`, `setVolumes(music, sfx)`, `dispose()`.
- `GameEvent`: `{type:'hud', hud}` | `{type:'over', result}` | `{type:'toast', ...}` | `{type:'ready'}`.
- `RunResult`: `{world, mode, stage, score, coins, xp, elapsed, collected, hits, dodged,
  maxCombo, victory, bossDefeated, powerupsUsed, reason}`.

### Performance notes

- Objects are pooled per kind and reused instead of allocated per spawn.
- One shared renderer; geometry/material disposal is tracked and released on teardown.
- Pixel ratio is capped by the quality setting (low/medium/high) to protect mid-range phones.
- HUD updates are throttled and emitted as plain objects, keeping React out of the render loop.

---

### Scoring and rewards

Everything the player earns is computed from one place, so the numbers on screen always
match the numbers in the save file.

- **Level score** — points from collected rewards during the run, with the combo
  multiplier applied. Kept in full.
- **DIGO collected** — the in-game currency for that level, kept in full.
- **Completion bonus** — paid once when the level's objective is met. Bonuses follow a
  logarithmic curve, so later levels are worth more while each step adds less:

  ```
  bonus(level) = round(180 × (1 + 1.1 × log2(1 + level)))
  ```

  Level 1 pays 180, level 10 pays about 690, level 100 about 1,370. Raise `BONUS_BASE` or
  `BONUS_LOG_FACTOR` in `src/game/rewards.ts` to re-tune the whole curve; the server
  table in `server/campaign.js` is generated from the same two constants and
  `npm test` asserts that both sides agree on all 100 levels.
- **Achievement bonus** — 250 points per achievement unlocked, credited once.
- **Lifetime points** — every payout is added to a lifetime total that is never reset,
  not even by **Start New Journey**.

The victory screen lists each of these rows and their sum, so a player can always see
exactly how a total was reached.

---

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service status, storage mode, run counters |
| `POST` | `/api/runs/start` | Issues a signed run ticket (`runId`, `seed`, `token`) |
| `POST` | `/api/runs` | Submits a finished run; validated against the ticket, then ranked |
| `GET` | `/api/leaderboard?mode=` | Top scores for a mode |
| `POST` | `/api/wallet/nonce` | Returns a human-readable challenge message to sign |
| `POST` | `/api/wallet/verify` | Verifies the ed25519 signature and links the address |

### Server-side reward validation

1. A run may only be submitted with a ticket the server issued (HMAC-SHA256, 3h TTL).
2. Reported play time cannot exceed real elapsed time since the ticket was issued, nor
   the mode's time limit.
3. Score is bounded by a plausible points-per-second rate, and collection counts are
   bounded by play time.
4. Rejected runs are counted and returned with a reason; only accepted runs enter the
   leaderboard.

The server never trusts client-submitted best scores, and never claims on-chain rewards.

---

## Phantom / Solana preparation

- **The wallet gate is mandatory before play in this build**, running in mock/test mode:
  connect Phantom (or the built-in test adapter) and the campaign unlocks. No transaction
  is created and no funds can move.
- Wallet linking is optional and lives in Settings → Wallet.
- The flow is: connect → request a server challenge message → user signs the message in
  Phantom → server verifies the ed25519 signature against the public key.
- **No private key or seed phrase is ever requested, transmitted or stored.** Signing a
  plain message cannot move funds.
- **No transaction is created, no token transfer is faked, and no deposits/withdrawals are
  simulated.** DIGO points and coins are game points, clearly separate from any future
  SPL token. Real token integration would require an explicit user-approved transaction
  and server-side verification; that is intentionally not implemented here.

---

## Environment variables

Copy `.env.example` to `.env`. Everything has a safe default; nothing is required to run.

| Name | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port (the platform provides this in production) |
| `RUN_SECRET` | random per boot | HMAC secret for run tickets. **Set this in production** so tickets survive restarts. |
| `DATA_DIR` | unset (in-memory) | Directory for the leaderboard snapshot file |
| `ALLOWED_ORIGINS` | unset (same-origin only) | Comma-separated CORS allowlist |
| `SOLANA_CLUSTER` | `mainnet-beta` | Cluster label reported by `/api/health` (no RPC calls are made) |

Without `DATA_DIR` the leaderboard lives in memory and resets on restart. On AppJet's
Free plan no persistent disk is available, so the in-memory default is expected; set
`DATA_DIR` when you run the app somewhere with a writable volume.

---

## Deployment

The included `Dockerfile` is a multi-stage Node build: it installs dependencies, builds
the Vite bundle, prunes dev dependencies, and runs the server as a non-root user on an
Alpine image with current OS packages.

```bash
docker build -t digo-evolution .
docker run -p 3000:3000 -e RUN_SECRET=change-me digo-evolution
```

Any Node host works too:

```bash
npm ci && npm run build && NODE_ENV=production npm start
```

The server listens on `0.0.0.0:$PORT` and serves the SPA plus `/api` from the same port.

---

## Manual test checklist

- Drag left/right movement (continuous while held, no stuck state).
- Swipe up to jump, once per gesture.
- One-finger drag, then a second finger: no jump, no cancellation.
- No arrow buttons on screen; keyboard still steers and jumps on desktop.
- Level 100 completion → **Start New Journey** keeps lifetime points and achievements.
- Reward collection increments score exactly once per object.
- Bomb/hazard collision reduces health and grants brief invulnerability.
- Power-up activation changes behaviour and shows in the HUD.
- Difficulty ramps: more objects, faster falls, tougher patterns.
- Pause/resume, restart, and return to menu from game over.
- Portrait mobile layout, safe-area aware HUD.
- Android Chrome touch behaviour: no page scroll, no text selection.
- Multiple simultaneous falling objects stay smooth (pooling in effect).

---

## Credits

All art, geometry, animation, music and sound are generated procedurally in code from
the DIGO reference character. No third-party asset packs are bundled.
