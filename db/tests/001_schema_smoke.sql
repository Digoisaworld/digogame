-- PostgreSQL schema smoke test. Runs in CI after 001_initial_schema.sql.
BEGIN;

DO $$
DECLARE
  required_table TEXT;
  test_player UUID;
  test_run UUID;
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

  INSERT INTO players (wallet_address)
  VALUES ('11111111111111111111111111111111')
  RETURNING id INTO test_player;

  INSERT INTO game_runs (
    id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at
  ) VALUES (
    gen_random_uuid(), test_player, 1, 'island', 12345, repeat('a', 64),
    now(), now() + interval '30 minutes'
  ) RETURNING id INTO test_run;

  INSERT INTO run_results (
    run_id, player_id, score, bonus, digo, elapsed_ms,
    stars, victory, accepted, rejection_code, submitted_payload
  ) VALUES (
    test_run, test_player, 100, 0, 1, 1000,
    1, false, true, NULL, '{}'::jsonb
  );

  BEGIN
    INSERT INTO run_results (
      run_id, player_id, score, bonus, digo, elapsed_ms,
      stars, victory, accepted, rejection_code, submitted_payload
    ) VALUES (
      test_run, test_player, 100, 0, 1, 1000,
      1, false, true, NULL, '{}'::jsonb
    );
    RAISE EXCEPTION 'Duplicate result unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
