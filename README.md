# DIGO EVOLUTION

A mobile-first 3D arcade survival game. DIGO runs along the ground near the bottom of a
portrait screen while rewards and hazards rain down from above. Move, collect, dodge,
survive, evolve.

**Not a clicker game.** You never tap individual coins. You hold a control pad (or the
optional arrow buttons) and DIGO follows your finger horizontally while the world falls
toward you.

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
| Campaign | 12 handcrafted levels across all 7 worlds. Every level has one clear objective (collect DIGO, survive the clock, clear hazards), a time limit, a unique completion bonus and a 1–3 star score ladder. Levels unlock in order and the difficulty curve is tuned so each one is beatable. |
| Progression | Level records, stars, accumulated DIGO, best scores and settings persisted in `localStorage`; 5 character evolution stages; achievements; per-level leaderboard on the server. |
| Audio | Fully procedural Web Audio engine (no binary assets): per-reward collect sounds, bomb warning, explosion, damage, power-up, level up, victory/defeat, plus per-world generative background music and independent music/SFX volume. |
| Controls | Pointer Events with pointer capture, multitouch-safe drag pad, smooth interpolation, plus optional left/right buttons. No text selection, no page scroll, no stuck movement. |
| Backend | Express API with HMAC-signed run tickets, server-side score plausibility validation, per-mode leaderboard, and Phantom wallet ownership verification via ed25519 signature. |

---

## Tech stack

- **React 18 + TypeScript + Vite** — UI, menus, HUD, routing between screens.
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
2. Tap **PLAY**.
3. Press and **hold** the large control pad at the bottom of the screen. Slide your
   finger left/right — DIGO follows smoothly and keeps moving as long as you hold.
4. Collect bright, glowing rewards. Avoid everything black/red/burning/spiky.
5. Release to stop. Optional arrow buttons can be enabled in Settings → Controls.

Portrait orientation is the primary layout; the game also runs in landscape and on
desktop (mouse drag and `A`/`D` or arrow keys).

---

## Architecture

```
src/
  main.tsx                  app bootstrap
  App.tsx                   screen router + profile state + run configuration
  game/
    types.ts                shared types, reward/danger/power tables, RunConfig, RunResult
    worlds.ts               7 world definitions (palette, fog, music scale, hazard flavour)
    modes.ts                5 mode definitions (duration, spawn rate, danger bias, objectives)
    progression.ts          profile persistence, XP/levels, evolution stages, missions,
                            achievements, run result application
    DigoGame.ts             engine: renderer, camera, lights, loop, entity update, HUD emit
    entities/
      DigoCharacter.ts      procedural DIGO rig + 10 animations + stage variations
      objectFactory.ts      reward/danger/power-up/boss meshes with VFX and pooling support
      environment.ts        world-specific ground, sky, props, lighting
    systems/
      InputController.ts    pointer-capture drag pad + button input, smoothing
      SpawnManager.ts       weighted spawning, difficulty curve, boss scheduling, pooling
      CollisionSystem.ts    circle/AABB collision, once-only reward pickup, i-frames
      ScoreSystem.ts        points, combo multipliers, reward bookkeeping
      HealthSystem.ts       health, lives, damage, invulnerability window
      PowerUpSystem.ts      timed power-up effects and HUD state
    audio/AudioManager.ts   procedural SFX + generative music
  lib/
    api.ts                  typed client for the run/leaderboard/wallet endpoints
    phantom.ts              Phantom provider discovery, connect, sign, short address
  ui/
    Menu.tsx                main menu, mode select, world select, character select, codex
    Progress.tsx            missions, achievements, leaderboard, profile
    SettingsView.tsx        audio, controls, haptics, quality, wallet, reset
    GameScreen.tsx          canvas host, HUD, pause, game over, wallet link
    styles.css              mobile-first theme
server/
  index.js                  Express API + static hosting
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

- The game is fully playable **without** a wallet.
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

- Hold-and-drag horizontal movement (continuous while held, no stuck state).
- One-finger drag, then a second finger: no jump, no cancellation.
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
