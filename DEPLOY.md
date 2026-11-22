# DIGO game — VPS deployment

This guide deploys the single-container game/API service on a Linux VPS with Docker Engine and Docker Compose v2.

## What this deploys

- React/Vite game served by the Express API on port 3000 inside the container.
- Host binding defaults to `127.0.0.1:3100`, intended to sit behind an existing HTTPS reverse proxy.
- Persistent Docker volume `digo-game-data` mounted at `/data` for the current JSON leaderboard/wallet snapshot.
- Non-root container, read-only root filesystem, dropped Linux capabilities, health check, and restart policy.

## 1. Prepare the VPS

Install Docker Engine and the Docker Compose v2 plugin. Confirm:

```bash
docker --version
docker compose version
```

## 2. Get the verified source

```bash
git clone https://github.com/Digoisaworld/digogame.git
cd digogame
git checkout main
git pull --ff-only origin main
```

## 3. Create production secrets

Do not commit the production `.env` file or send its contents in chat.

```bash
cp .env.example .env
chmod 600 .env
```

Generate a strong persistent run-ticket secret:

```bash
openssl rand -hex 32
```

Edit `.env` and set at least:

```dotenv
PORT=3000
RUN_SECRET=PASTE_THE_GENERATED_RANDOM_SECRET_HERE
DATA_DIR=/data
SOLANA_CLUSTER=mainnet-beta
ALLOWED_ORIGINS=
```

Keep the same `RUN_SECRET` across restarts and deployments. The game is same-origin by default, so leave `ALLOWED_ORIGINS` empty when the reverse proxy serves the game and API on the same host.

## 4. Build and start

Default host port is 3100 and is bound only to loopback:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 digo-game
```

To use another local port, set `HOST_PORT` in the shell before starting, for example:

```bash
HOST_PORT=3200 docker compose up -d --build
```

## 5. Verify the API

```bash
curl --fail http://127.0.0.1:3100/api/health
```

Expected response includes `"ok":true` and `"storage":"file"`.

Then configure the VPS reverse proxy to forward the chosen loopback port to the public game hostname with HTTPS. Do not expose port 3000 or the Docker container directly to the public internet.

## 6. Updates and rollback

Update to the latest verified main branch:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3100/api/health
```

Keep a backup of the persistent volume before upgrades. The volume is named `digo-game-data`.

## Important current product limitations

- The API's leaderboard and linked-wallet snapshot are persisted as a JSON file. This is suitable only for a single application instance; do not run multiple replicas sharing independent local stores.
- Player campaign progress and lifetime points are currently stored in browser localStorage, not in a server-side player account database. Clearing browser storage or switching devices can therefore lose/split that progress. Do not promise cross-device account recovery yet.
- Phantom integration verifies wallet ownership/signatures and supports the current mock/test gate. It does not send SPL token transactions or pay real DIGO tokens.
- Before real token rewards or a large public launch, add PostgreSQL-backed player profiles, idempotent reward ledgering, stronger anti-cheat/rate limiting, monitoring, backups, and a security review.
