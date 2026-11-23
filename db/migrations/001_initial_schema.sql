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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_runs_id_player_unique UNIQUE (id, player_id)
);
CREATE INDEX IF NOT EXISTS game_runs_player_started_idx ON game_runs (player_id, started_at DESC);
CREATE INDEX IF NOT EXISTS game_runs_expiry_idx ON game_runs (expires_at);

CREATE TABLE IF NOT EXISTS run_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE,
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
  CONSTRAINT run_results_run_owner_fk FOREIGN KEY (run_id, player_id)
    REFERENCES game_runs(id, player_id) ON DELETE RESTRICT,
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


-- Atomically consume a wallet challenge. Concurrent verifiers can receive
-- the challenge at most once; expired, mismatched, or already-consumed rows
-- produce no result. The caller must still verify the returned message signature.
CREATE OR REPLACE FUNCTION consume_wallet_challenge(
  p_wallet_address VARCHAR(44),
  p_message_sha256 CHAR(64)
)
RETURNS TABLE (
  challenge_id UUID,
  challenge_message TEXT,
  challenge_expires_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
  UPDATE wallet_challenges AS challenge
  SET consumed_at = clock_timestamp()
  WHERE challenge.wallet_address = p_wallet_address
    AND challenge.message_sha256 = p_message_sha256
    AND challenge.consumed_at IS NULL
    AND challenge.expires_at > clock_timestamp()
  RETURNING challenge.id, challenge.message, challenge.expires_at;
$$;


-- Optimistic progress upsert. expected_revision=0 creates a new row;
-- otherwise the existing row must match the caller's last observed revision.
CREATE OR REPLACE FUNCTION save_player_progress(
  p_player_id UUID,
  p_progress JSONB,
  p_expected_revision BIGINT
)
RETURNS TABLE (new_revision BIGINT, changed_at TIMESTAMPTZ)
LANGUAGE sql
AS $$
  INSERT INTO player_progress (player_id, progress, revision, updated_at)
  VALUES (p_player_id, p_progress, 1, clock_timestamp())
  ON CONFLICT (player_id) DO UPDATE
    SET progress = EXCLUDED.progress,
        revision = player_progress.revision + 1,
        updated_at = clock_timestamp()
    WHERE player_progress.revision = p_expected_revision
  RETURNING player_progress.revision, player_progress.updated_at;
$$;

-- Revoke only the specified player's session; repeated revocation is harmless.
CREATE OR REPLACE FUNCTION revoke_player_session(
  p_session_id UUID,
  p_player_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  WITH revoked AS (
    UPDATE player_sessions
    SET revoked_at = COALESCE(revoked_at, clock_timestamp())
    WHERE id = p_session_id
      AND player_id = p_player_id
      AND revoked_at IS NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM revoked);
$$;

-- Public leaderboard data contains only wallet address, level, score and time.
CREATE OR REPLACE VIEW public_level_leaderboard AS
SELECT
  ranked.level_id,
  ranked.player_id,
  ranked.wallet_address,
  ranked.score,
  ranked.created_at,
  ranked.rank
FROM (
  SELECT
    runs.level_id,
    results.player_id,
    players.wallet_address,
    results.score,
    results.created_at,
    row_number() OVER (
      PARTITION BY runs.level_id
      ORDER BY results.score DESC, results.created_at ASC, results.player_id
    ) AS rank
  FROM run_results AS results
  JOIN game_runs AS runs ON runs.id = results.run_id
  JOIN players ON players.id = results.player_id
  WHERE results.accepted = true
    AND players.disabled_at IS NULL
) AS ranked;


-- Finalize a run exactly once, only for its owner and before ticket expiry.
-- A NULL return means the run was missing, expired, already submitted, or the
-- player was disabled. The result insert and submitted_at transition are one
-- database statement/transaction from the caller's perspective.
CREATE OR REPLACE FUNCTION finalize_game_run(
  p_run_id UUID,
  p_player_id UUID,
  p_score BIGINT,
  p_bonus BIGINT,
  p_digo BIGINT,
  p_elapsed_ms BIGINT,
  p_stars SMALLINT,
  p_victory BOOLEAN,
  p_accepted BOOLEAN,
  p_rejection_code TEXT,
  p_submitted_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  finalized_run UUID;
  result_id UUID;
BEGIN
  UPDATE game_runs AS runs
  SET submitted_at = clock_timestamp()
  FROM players
  WHERE runs.id = p_run_id
    AND runs.player_id = p_player_id
    AND players.id = runs.player_id
    AND players.disabled_at IS NULL
    AND runs.submitted_at IS NULL
    AND runs.expires_at > clock_timestamp()
  RETURNING runs.id INTO finalized_run;

  IF finalized_run IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO run_results (
    run_id, player_id, score, bonus, digo, elapsed_ms,
    stars, victory, accepted, rejection_code, submitted_payload
  ) VALUES (
    finalized_run, p_player_id, p_score, p_bonus, p_digo, p_elapsed_ms,
    p_stars, p_victory, p_accepted, p_rejection_code, p_submitted_payload
  )
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;


-- Create a session only for an enabled player. The caller supplies a random
-- opaque token digest; the bearer token itself must never enter PostgreSQL.
CREATE OR REPLACE FUNCTION create_player_session(
  p_session_id UUID,
  p_player_id UUID,
  p_token_sha256 CHAR(64),
  p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  INSERT INTO player_sessions (id, player_id, token_sha256, expires_at)
  SELECT p_session_id, players.id, p_token_sha256, p_expires_at
  FROM players
  WHERE players.id = p_player_id
    AND players.disabled_at IS NULL
    AND p_expires_at > clock_timestamp()
    AND p_expires_at <= clock_timestamp() + interval '7 days'
  RETURNING true;
$$;

-- Validate a token by digest, update last_seen, and return only public player
-- identity fields. Expired, revoked, disabled, or unknown sessions return no row.
CREATE OR REPLACE FUNCTION validate_player_session(p_token_sha256 CHAR(64))
RETURNS TABLE (
  player_id UUID,
  wallet_address VARCHAR(44),
  session_expires_at TIMESTAMPTZ
)
LANGUAGE sql
AS $$
  UPDATE player_sessions AS sessions
  SET last_seen_at = clock_timestamp()
  FROM players
  WHERE sessions.token_sha256 = p_token_sha256
    AND sessions.player_id = players.id
    AND sessions.revoked_at IS NULL
    AND sessions.expires_at > clock_timestamp()
    AND players.disabled_at IS NULL
  RETURNING sessions.player_id, players.wallet_address, sessions.expires_at;
$$;
