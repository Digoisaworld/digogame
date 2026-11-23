-- PostgreSQL schema smoke test. Runs in CI after 001_initial_schema.sql.
BEGIN;

DO $$
DECLARE
  required_table TEXT;
  test_player UUID;
  test_run UUID;
  test_negative_run UUID;
  test_reason_run UUID;
  test_session UUID;
  second_player UUID;
  ownership_run UUID;
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
    WHERE schemaname = 'public' AND tablename = 'run_results'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%run_id%'
  ) THEN
    RAISE EXCEPTION 'run_results must enforce one result per run';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_sessions'
      AND column_name = 'token_sha256'
  ) THEN
    RAISE EXCEPTION 'Session token digest column is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_progress'
      AND column_name = 'revision'
  ) THEN
    RAISE EXCEPTION 'Progress revision column is missing';
  END IF;

  INSERT INTO players (wallet_address)
  VALUES ('11111111111111111111111111111111')
  RETURNING id INTO test_player;

  -- A second player cannot claim the same wallet.
  BEGIN
    INSERT INTO players (wallet_address)
    VALUES ('11111111111111111111111111111111');
    RAISE EXCEPTION 'Duplicate wallet unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO players (wallet_address)
  VALUES ('22222222222222222222222222222222')
  RETURNING id INTO second_player;

  INSERT INTO player_sessions (id, player_id, token_sha256, expires_at)
  VALUES (gen_random_uuid(), test_player, repeat('b', 64), now() + interval '7 days')
  RETURNING id INTO test_session;

  -- Session credential digests must be unique.
  BEGIN
    INSERT INTO player_sessions (id, player_id, token_sha256, expires_at)
    VALUES (gen_random_uuid(), test_player, repeat('b', 64), now() + interval '7 days');
    RAISE EXCEPTION 'Duplicate session digest unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

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

  -- A run can be submitted only once, including retries.
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

  INSERT INTO game_runs (id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at)
  VALUES (gen_random_uuid(), test_player, 1, 'island', 12348, repeat('e', 64), now(), now() + interval '30 minutes')
  RETURNING id INTO ownership_run;

  -- A different player cannot submit a result for this run.
  BEGIN
    INSERT INTO run_results (
      run_id, player_id, score, bonus, digo, elapsed_ms,
      stars, victory, accepted, rejection_code, submitted_payload
    ) VALUES (
      ownership_run, second_player, 1, 0, 0, 1000,
      0, false, true, NULL, '{}'::jsonb
    );
    RAISE EXCEPTION 'Run result with a different owner unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  INSERT INTO game_runs (id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at)
  VALUES (gen_random_uuid(), test_player, 1, 'island', 12346, repeat('c', 64), now(), now() + interval '30 minutes')
  RETURNING id INTO test_negative_run;

  -- Negative score must be rejected by the database.
  BEGIN
    INSERT INTO run_results (
      run_id, player_id, score, bonus, digo, elapsed_ms,
      stars, victory, accepted, rejection_code, submitted_payload
    ) VALUES (
      test_negative_run, test_player, -1, 0, 0, 1000,
      0, false, true, NULL, '{}'::jsonb
    );
    RAISE EXCEPTION 'Negative score unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO game_runs (id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at)
  VALUES (gen_random_uuid(), test_player, 1, 'island', 12347, repeat('d', 64), now(), now() + interval '30 minutes')
  RETURNING id INTO test_reason_run;

  -- Accepted results cannot carry a rejection code.
  BEGIN
    INSERT INTO run_results (
      run_id, player_id, score, bonus, digo, elapsed_ms,
      stars, victory, accepted, rejection_code, submitted_payload
    ) VALUES (
      test_reason_run, test_player, 0, 0, 0, 1000,
      0, false, true, 'invalid', '{}'::jsonb
    );
    RAISE EXCEPTION 'Inconsistent acceptance state unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

ROLLBACK;
