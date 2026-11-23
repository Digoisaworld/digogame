# PostgreSQL foundation

The initial schema is in `migrations/001_initial_schema.sql`.

## Status

This is a schema foundation plus PostgreSQL CI smoke tests only. The current Express API still uses its existing JSON snapshot and in-memory session/run maps; `pg` is not yet a runtime dependency and no API route reads or writes PostgreSQL. Creating this migration does **not** switch the running service to PostgreSQL, and it must not be described as durable account storage until the API repository layer is implemented and tested.

## Intended rollout

1. Provision a dedicated PostgreSQL database and least-privilege DIGO application role. Do not reuse an An Pardaz database or database credentials.
2. Keep PostgreSQL on a private Docker network; do not publish its port on the VPS.
3. Back up the empty/new DIGO database and apply migrations using a migration identity separate from the runtime role.
4. Add the PostgreSQL driver with a reproducible lockfile update, then implement a bounded connection pool and readiness/health checks.
5. Implement and test transactional repository operations for player upsert, one-time challenge consumption (`UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() RETURNING ...`), hashed session creation/revocation, run-ticket persistence, unique run submission, progress revision updates (`UPDATE ... WHERE revision = expected_revision`), and leaderboard reads.
6. Add integration tests for concurrent challenge consumption, concurrent duplicate submissions, session revocation/expiry, database outage behavior, and restart persistence.
7. Dual-read/write only through an explicitly tested migration plan. Do not silently discard the existing JSON snapshot.
8. Verify restore from backup and rollback before switching traffic.

## Security invariants

- Store only a SHA-256 digest of bearer tokens, never the bearer token itself.
- Consume each wallet challenge exactly once, in a transaction.
- Enforce one result per run with the unique `run_results.run_id` constraint.
- Keep wallet identity anchored to the address whose Ed25519 signature was verified by the server.
- Never store private keys or seed phrases.
- `reward_ledger` is preparatory only. Real DIGO transfers remain disabled until an independently reviewed payout worker, treasury controls, and reconciliation process exist.

## Runtime secret requirement

The hardened API signs run tickets and session tokens with `RUN_SECRET`. In production this value must be supplied explicitly and contain at least 32 bytes; the process now refuses to start when it is absent or too short. Generate it once with a cryptographically secure generator, store it in the DIGO-only secret store, and keep it stable across restarts and replicas. Rotating it invalidates existing sessions and run tickets. Never commit the value, put it in a client bundle, or reuse an An Pardaz secret.

The current runtime still uses process-local session/run maps and the optional JSON snapshot for leaderboard counters. This is not multi-instance safe and is not durable account/gameplay persistence. PostgreSQL integration and server-authoritative gameplay simulation are still outstanding.

## Database constraints already covered by CI

The schema smoke test verifies required tables, unique wallet and session digests, one result per run, run/player ownership via a composite foreign key, non-negative score constraints, consistent acceptance/rejection state, and optimistic progress revision updates. These tests validate PostgreSQL constraints; they do not prove that the Express API uses them.

## Release gate

Do not deploy this branch as a durable multiplayer backend while `/api/health` reports memory/JSON storage. Runtime PostgreSQL persistence, production-like integration tests, backup/restore verification, and an explicit deployment approval are mandatory gates. The current score plausibility checks are heuristic and client-reported; they are not server-authoritative anti-cheat.


## Process-local state limits (interim only)

The API now periodically expires stale in-process sessions, used-run markers, wallet challenges, and rate-limit buckets. It also applies explicit capacity ceilings to sessions, challenges, and rate-limit keys, returning a controlled retry response when a ceiling is reached. This protects a single process from unbounded growth; it does not provide cross-process consistency, restart persistence, or a distributed rate limit. These maps remain an interim implementation and must be replaced by transactional PostgreSQL operations (and shared rate limiting where multiple instances are used) before production scale or token rewards.


## Applying the initial schema

The repository includes a non-destructive schema runner:

```sh
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE' npm run db:migrate
```

It requires the PostgreSQL `psql` client, stops on the first SQL error, and wraps migration 001 in a transaction. Run it with a dedicated least-privilege DIGO migration role against the intended database. Keep credentials in the deployment secret manager; do not commit connection strings. The runner only creates/ensures the declared schema objects; it does not wire the Express API to PostgreSQL or migrate the current JSON snapshot data.


## Atomic wallet challenge consumption

Migration 001 defines `consume_wallet_challenge(wallet_address, message_sha256)`. It atomically marks a matching, unexpired, unused challenge as consumed and returns its message only to the transaction that changed the row. Repeated or concurrent calls cannot consume the same challenge twice. The application must still verify the returned message's Ed25519 signature before creating a player session; consuming a challenge is not proof of wallet ownership by itself. CI smoke tests cover successful single use, replay rejection, and expiry.


## Additional database primitives

Migration 001 also provides:

- `save_player_progress(player_id, progress, expected_revision)`: inserts at revision 1 when the expected revision is 0, or updates only when the stored revision matches the caller's expected revision. No returned row means the caller had a stale revision.
- `revoke_player_session(session_id, player_id)`: revokes only an active session owned by that player; repeated revocation is a no-op.
- `public_level_leaderboard`: exposes accepted results for enabled players, ranked per level by score descending and then submission time ascending.

These are database primitives, not yet wired into Express routes. The CI schema test exercises create/update/stale progress writes, owner-only session revocation, repeated revocation, and leaderboard-view existence.
