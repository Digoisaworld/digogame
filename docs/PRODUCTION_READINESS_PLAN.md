# DIGO production-readiness plan

Status: assessment only. This document records the gaps found in the current `main` branch; it does not claim that PostgreSQL, Android packaging, or VPS deployment has been implemented.

## Verified current architecture

- Client: React 19, TypeScript, Vite, and Three.js.
- Server: one Express process serves the built client and the API.
- Runtime: Node.js 20 or newer is declared in `package.json`.
- Persistence: `server/index.js` stores leaderboard and linked-wallet snapshots in a JSON file under `DATA_DIR`; without it, state is in memory.
- Campaign progress: `src/game/progress.ts` stores player progression in browser `localStorage`.
- Wallet: `src/lib/wallet.ts` supports Phantom public-key connection and message-signature verification, plus a clearly simulated wallet mode. The code states that it does not create or send Solana transactions.
- Deployment: Dockerfile and Compose configuration exist. Compose binds the app to host loopback by default and mounts a named data volume. The current deployment guide explicitly describes JSON-file persistence and lists PostgreSQL as future work.
- Android: the inspected `package.json` does not declare Capacitor, Cordova, React Native, or another native Android packaging dependency. No APK build has been verified.

## Required implementation work

### 1. PostgreSQL persistence

Introduce PostgreSQL as a separate service in the DIGO Compose project, on a private Compose network with no published database port. Keep the existing application port loopback-only.

Suggested initial tables:

- `players`: internal UUID, display name, created/updated timestamps.
- `wallet_links`: player ID, public Solana address, verification timestamp, unique address. Never store seed phrases or private keys.
- `run_tickets`: ticket ID, player/session binding, level, seed, issue/expiry timestamps, consumed timestamp.
- `runs`: run ID, player ID, level, score, elapsed time, collected counts, DIGO game-points, validation verdict, submitted timestamp.
- `leaderboard_entries`: derived or indexed ranking data, with a deterministic tie-break.
- `player_progress`: unlocked level, level records, achievements, lifetime game-points, schema version.

Use migrations, foreign keys, unique constraints, parameterized queries, and transactions. A run ticket must be consumed atomically so the same ticket cannot submit multiple rewards. Preserve the JSON data until a tested import and backup/restore procedure exists; do not silently discard existing records.

### 2. Server-authoritative progression

The current browser save in `localStorage` is not a cross-device account system and must not be treated as authoritative. Move validated campaign progress and earned game-points to the API/database. The server must calculate awards from validated run facts rather than accepting client-supplied lifetime totals, stars, or balances.

Add request validation, per-player and per-IP rate limits, idempotency, ticket replay protection, and audit events. Keep game-points distinct from on-chain DIGO tokens.

### 3. Phantom boundary

Retain public-address connection and signed-message ownership verification only. Do not add token-transfer, withdrawal, claim, custody, or signing endpoints in this phase. The mock wallet must remain visibly labelled as simulated and must never be eligible for real payouts.

### 4. Android deliverable

First verify the web build and mobile controls on physical Android devices. Then choose and document a wrapper approach (Capacitor is a candidate, not yet installed or verified), configure app ID, icons, splash screen, orientation, safe areas, and network policy, and build a signed release APK/AAB. Keep signing credentials outside GitHub and the repository.

### 5. Isolated VPS deployment

Deploy as a separate Compose project under `/opt/digo-game`, with its own app and PostgreSQL containers, network, and persistent database volume. Run the app as non-root, with a read-only root filesystem where compatible, dropped capabilities, resource limits, health checks, and secrets injected from a protected environment file. Do not modify existing An Pardaz containers, databases, Nginx, firewall, or DNS as part of the initial isolated deployment.

Before public exposure, obtain an explicit hostname/reverse-proxy decision, configure HTTPS, verify backup/restore, and run health, API, migration, and rollback checks.

## Acceptance gates

1. Existing campaign verification test and TypeScript check pass.
2. Database migrations run on an empty database and on a representative backup copy.
3. A submitted run cannot be replayed to award points twice.
4. Client edits to local storage cannot mint authoritative points.
5. Wallet verification proves control of a public address without collecting secrets.
6. No token transfer or withdrawal endpoint exists.
7. Android release installs and runs on a real Android device.
8. VPS health checks pass without changing any existing An Pardaz production service.
9. Backup restoration and rollback are demonstrated before launch.

## Out of scope for this phase

- Real DIGO token payouts or withdrawals.
- Custody of user wallets or private keys.
- Changes to existing An Pardaz production services.
- Public database exposure.
