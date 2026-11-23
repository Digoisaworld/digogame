-- PostgreSQL schema smoke test. Runs in CI after 001_initial_schema.sql.
BEGIN;

DO $$
DECLARE
  required_table TEXT;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'players', 'wallet_challenges', 'player_sessions',
    'player_progress', 'game_runs', 'run_results', 'reward_ledger'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Required DIGO table is missing: %', required_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'run_results'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%run_id%'
  ) THEN
    RAISE EXCEPTION 'run_results must enforce one result per run';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_sessions'
      AND column_name = 'token_sha256'
  ) THEN
    RAISE EXCEPTION 'Session token digest column is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_progress'
      AND column_name = 'revision'
  ) THEN
    RAISE EXCEPTION 'Progress revision column is missing';
  END IF;
END $$;

ROLLBACK;
