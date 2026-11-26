# DIGO EVOLUTION — production VPS deployment

This guide targets the isolated DIGO game stack on the existing An Pardaz Docker VPS. It does **not** modify An Pardaz services. Deploy only after reviewing the commands and confirming the target host and backup location.

## Deployment architecture

- Express serves the built React/Vite game and API on container port 3000.
- Docker publishes the game API only on host loopback: `127.0.0.1:3100` by default. Put the public game hostname behind the existing HTTPS reverse proxy.
- PostgreSQL is the dedicated `digogame-postgres` container on the private external Docker network `digogame-net`. The database has no public host port.
- The Compose app container is `digo-game`; its persistent application volume is `digo-game-data`.
- Production startup is fail-closed: it requires a 32-byte `RUN_SECRET`, a `DATABASE_URL`, and the migrated PostgreSQL schema. Do not start it before the migration is verified.
- No real DIGO token transfer or payout is implemented. Game points are not on-chain tokens.

## 1. Preflight — read-only checks

Run from the VPS:

```bash
docker --version
docker compose version
docker network inspect digogame-net
docker inspect --format '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' digogame-postgres
docker exec digogame-postgres pg_isready -U digogame -d digogame
df -h /
free -h
```

Stop if the dedicated database is not healthy, the network is missing, or disk space is insufficient. Do not recreate, remove, prune, or modify any existing An Pardaz container, network, or volume.

## 2. Fetch the reviewed application branch

The PostgreSQL integration is on the dedicated branch below. Do not deploy `main` or merge the draft pull request as part of this procedure.

```bash
cd /opt
git clone --branch feat/digogame-production-postgres --single-branch https://github.com/Digoisaworld/digogame.git digogame
cd /opt/digogame
git status --short --branch
git log -1 --oneline
```

If `/opt/digogame` already exists, do not clone over it. Inspect its status and back it up before changing branches or files.

## 3. Configure secrets without exposing them

Create the project-level `.env` file. Compose interpolates `RUN_SECRET` and `DATABASE_URL` from this file before container creation; the service's `env_file` alone is not sufficient for those required interpolations.

```bash
cd /opt/digogame
umask 077
cp .env.example .env
openssl rand -hex 32
```

Edit `.env` locally on the VPS and set:

- `RUN_SECRET`: output of `openssl rand -hex 32` (keep stable across restarts).
- `DATABASE_URL`: `postgresql://digogame:<URL-ENCODED_PASSWORD>@digogame-postgres:5432/digogame`.
- `HOST_PORT=3100` (optional; default is 3100).

Use the existing dedicated database password stored on the VPS; do not print it, paste it into chat, or commit it. URL-encode special characters in the password. Keep the file private:

```bash
chmod 600 .env

grep -E '^(RUN_SECRET|DATABASE_URL)=' .env | sed -E 's/=.*/=<redacted>/'
```

Do not replace or rotate the database password during this deployment.

## 4. Back up PostgreSQL before migration

Use a timestamped backup path with adequate free space. This exports only the DIGO database:

```bash
mkdir -p /opt/digogame/backups
chmod 700 /opt/digogame/backups
BACKUP="/opt/digogame/backups/digogame-before-migration-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker exec digogame-postgres pg_dump -U digogame -d digogame -Fc > "$BACKUP"
test -s "$BACKUP"
chmod 600 "$BACKUP"
```

Do not continue unless the dump exists and is non-empty. Keep the backup outside the application container and do not upload it to GitHub.

## 5. Apply schema migration

The migration is a database write. Confirm the backup first, then run:

```bash
cd /opt/digogame
set -a
. ./.env
set +a
docker run --rm --network digogame-net \
  -e DATABASE_URL="$DATABASE_URL" \
  -v "$PWD:/app:ro" -w /app node:22-alpine sh -c \
  'apk add --no-cache postgresql-client >/dev/null && sh db/migrate.sh'
unset DATABASE_URL RUN_SECRET
```

Then verify required tables exist:

```bash
docker exec digogame-postgres psql -U digogame -d digogame -v ON_ERROR_STOP=1 -c \
"SELECT to_regclass('public.players'), to_regclass('public.wallet_challenges'), to_regclass('public.player_sessions'), to_regclass('public.game_runs'), to_regclass('public.run_results');"
```

All five results must be non-NULL. If migration or verification fails, do not start the app; preserve the backup and investigate.

## 6. Build and start only the DIGO service

Run Compose from `/opt/digogame`, where the project-level `.env` is located:

```bash
cd /opt/digogame
docker compose config --quiet
docker compose build digo-game
docker compose up -d --no-deps digo-game
docker compose ps digo-game
docker compose logs --tail=100 digo-game
```

Do not run `docker compose down`, global prune commands, or commands against other projects. The app binds to loopback only; do not publish PostgreSQL or container port 3000 publicly.

## 7. Verify before enabling public traffic

```bash
curl --fail --silent --show-error http://127.0.0.1:3100/api/health
docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' digo-game
```

Expected health JSON has `"ok":true`, `"database":{"configured":true,"ready":true,...}`, and PostgreSQL storage. If health is not successful, keep the reverse-proxy route disabled and inspect the DIGO container logs. Do not weaken the fail-closed database check.

Only after the health check succeeds should the existing reverse proxy be configured to forward the game hostname to `http://127.0.0.1:3100` with HTTPS. Review the proxy configuration and reload only the relevant proxy service after taking its configuration backup; do not replace the site's existing configuration wholesale.

## 8. Rollback

If the application fails after the schema migration:

1. Disable/withdraw only the DIGO game reverse-proxy route.
2. Stop only the DIGO application container: `docker compose stop digo-game`.
3. Preserve container logs, the Git commit SHA, and the database backup.
4. Rebuild/redeploy the previously verified DIGO application revision only after confirming schema compatibility.

Do not restore the database dump over the live database unless a deliberate recovery decision has been made; restore is destructive to data written after the backup. Never delete `digogame_pgdata` or `digo-game-data`.

## Current limitations and release gates

- This branch contains PostgreSQL persistence for wallet challenges, player sessions, game runs, results, and leaderboard. It does not import historical JSON leaderboard data.
- GitHub Actions validates the PostgreSQL schema, runs a PostgreSQL-backed HTTP API integration flow (wallet challenge/signature verification, run ticket, accepted result, replay rejection, and persistent leaderboard), checks TypeScript/gameplay regressions, builds the production bundle, and builds the production Docker image. This is CI evidence, not a live VPS or real Phantom mobile-device test.
- Campaign progress/local UI state may still be browser-local; do not promise cross-device recovery unless separately verified.
- Phantom ownership verification is not a token payout. No SPL transfer, withdrawal, or real DIGO reward is enabled.
- Do not enable token withdrawals or advertise monetary rewards until idempotent on-chain payout controls, anti-cheat review, rate limiting, monitoring, and tested backup/restore procedures are implemented.
- Android APK/AAB packaging and Phantom mobile deep-link integration are separate work and are not delivered by this VPS deployment.
