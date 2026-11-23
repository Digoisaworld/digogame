# PostgreSQL foundation

The initial schema is in `migrations/001_initial_schema.sql`.

## Status

This is a schema foundation only. The current Express API still uses its existing JSON snapshot and in-memory session/run maps. Creating this migration does **not** switch the running service to PostgreSQL, and it must not be described as durable account storage until the API repository layer is implemented and tested.

## Intended rollout

1. Provision a dedicated PostgreSQL database and least-privilege DIGO application role. Do not reuse an An Pardaz database or database credentials.
2. Keep PostgreSQL on a private Docker network; do not publish its port on the VPS.
3. Back up the empty/new DIGO database and apply migrations using a migration identity separate from the runtime role.
4. Implement and test transactional repository operations for player upsert, one-time challenge consumption, hashed session creation/revocation, run-ticket persistence, unique run submission, progress revision updates, and leaderboard reads.
5. Dual-read/write only through an explicitly tested migration plan. Do not silently discard the existing JSON snapshot.
6. Verify restore from backup and rollback before switching traffic.

## Security invariants

- Store only a SHA-256 digest of bearer tokens, never the bearer token itself.
- Consume each wallet challenge exactly once, in a transaction.
- Enforce one result per run with the unique `run_results.run_id` constraint.
- Keep wallet identity anchored to the address whose Ed25519 signature was verified by the server.
- Never store private keys or seed phrases.
- `reward_ledger` is preparatory only. Real DIGO transfers remain disabled until an independently reviewed payout worker, treasury controls, and reconciliation process exist.
