-- DIGO PostgreSQL foundation
-- Apply with a dedicated DIGO database role. Never expose PostgreSQL publicly.
-- Wallet addresses are public identifiers; session tokens and signatures are not stored.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) NOT NULL UNIQUE,
  display_name VARCHAR(32) NOT NULL DEFAULT 'Player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  CONSTRAINT players_wallet_address_length CHECK (length(wallet_address) BETWEEN 32 AND 44)
);

CREATE TABLE IF NOT EXISTS wallet_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) NOT NULL,
  message TEXT NOT NULL,
  message_sha256 CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_challenges_expiry_idx ON wallet_challenges (expires_at);

CREATE TABLE IF NOT EXISTS player_sessions (
  id UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_sha256 CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_sessions_player_idx ON player_sessions (player_id);
CREATE INDEX IF NOT EXISTS player_sessions_expiry_idx ON player_sessions (expires_at);

CREATE TABLE IF NOT EXISTS player_progress (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_runs (
  id UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  level_id INTEGER NOT NULL CHECK (level_id > 0),
  world_id TEXT NOT NULL,
  seed BIGINT NOT NULL,
  ticket_sha256 CHAR(64) NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_runs_player_started_idx ON game_runs (player_id, started_at DESC);
CREATE INDEX IF NOT EXISTS game_runs_expiry_idx ON game_runs (expires_at);

CREATE TABLE IF NOT EXISTS run_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES game_runs(id) ON DELETE RESTRICT,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  score BIGINT NOT NULL CHECK (score >= 0),
  bonus BIGINT NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  digo BIGINT NOT NULL DEFAULT 0 CHECK (digo >= 0),
  elapsed_ms BIGINT NOT NULL CHECK (elapsed_ms >= 0),
  stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  victory BOOLEAN NOT NULL DEFAULT false,
  accepted BOOLEAN NOT NULL,
  rejection_code TEXT,
  submitted_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT run_results_acceptance_reason CHECK (
    (accepted = true AND rejection_code IS NULL) OR
    (accepted = false AND rejection_code IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS run_results_leaderboard_idx
  ON run_results (accepted, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS run_results_player_idx
  ON run_results (player_id, created_at DESC);

-- Future real-token payouts: do not enable until a separate audited payout worker exists.
-- Unique idempotency_key prevents duplicate reward issuance on retries.
CREATE TABLE IF NOT EXISTS reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  source_run_id UUID REFERENCES game_runs(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  asset_mint VARCHAR(44),
  amount_atomic NUMERIC(40,0) NOT NULL CHECK (amount_atomic > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'confirmed', 'failed', 'cancelled')),
  transaction_signature TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_ledger_player_idx ON reward_ledger (player_id, created_at DESC);
