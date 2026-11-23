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
  progress_revision BIGINT;
  challenge_id UUID;
  challenge_count INTEGER;
  saved_revision BIGINT;
  revoked BOOLEAN;
  finalized_result UUID;
  finalize_run UUID;
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

  -- Wallet challenge consumption is atomic and can succeed only once.
  INSERT INTO wallet_challenges (
    wallet_address, message, message_sha256, expires_at
  ) VALUES (
    '11111111111111111111111111111111',
    'Sign in to DIGO test challenge',
    repeat('f', 64),
    now() + interval '5 minutes'
  ) RETURNING id INTO challenge_id;

  SELECT count(*) INTO challenge_count
  FROM consume_wallet_challenge('11111111111111111111111111111111', repeat('f', 64));
  IF challenge_count <> 1 THEN
    RAISE EXCEPTION 'A valid wallet challenge was not consumed exactly once';
  END IF;

  SELECT count(*) INTO challenge_count
  FROM consume_wallet_challenge('11111111111111111111111111111111', repeat('f', 64));
  IF challenge_count <> 0 THEN
    RAISE EXCEPTION 'A consumed wallet challenge was accepted a second time';
  END IF;

  INSERT INTO wallet_challenges (
    wallet_address, message, message_sha256, expires_at
  ) VALUES (
    '11111111111111111111111111111111',
    'Expired DIGO test challenge',
    repeat('e', 64),
    now() - interval '1 minute'
  );

  SELECT count(*) INTO challenge_count
  FROM consume_wallet_challenge('11111111111111111111111111111111', repeat('e', 64));
  IF challenge_count <> 0 THEN
    RAISE EXCEPTION 'An expired wallet challenge was consumed';
  END IF;

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

  -- Progress writes use optimistic concurrency to avoid lost updates.
  INSERT INTO player_progress (player_id, progress, revision)
  VALUES (test_player, '{"level":1}'::jsonb, 1);

  UPDATE player_progress
  SET progress = '{"level":2}'::jsonb, revision = revision + 1, updated_at = now()
  WHERE player_id = test_player AND revision = 1
  RETURNING revision INTO progress_revision;
  IF progress_revision IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Progress revision did not advance atomically';
  END IF;

  UPDATE player_progress
  SET progress = '{"level":99}'::jsonb, revision = revision + 1, updated_at = now()
  WHERE player_id = test_player AND revision = 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Stale progress revision unexpectedly overwrote newer progress';
  END IF;

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

  -- The progress function creates at revision zero and rejects stale writers.
  SELECT new_revision INTO saved_revision
  FROM save_player_progress(second_player, '{"stage":1}'::jsonb, 0);
  IF saved_revision IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Initial progress save did not create revision 1';
  END IF;

  SELECT new_revision INTO saved_revision
  FROM save_player_progress(second_player, '{"stage":2}'::jsonb, 1);
  IF saved_revision IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Progress save did not advance to revision 2';
  END IF;

  SELECT new_revision INTO saved_revision
  FROM save_player_progress(second_player, '{"stage":99}'::jsonb, 1);
  IF saved_revision IS NOT NULL THEN
    RAISE EXCEPTION 'Stale progress writer unexpectedly succeeded';
  END IF;

  -- A session can be revoked only by its owning player.
  SELECT revoke_player_session(test_session, second_player) INTO revoked;
  IF revoked THEN
    RAISE EXCEPTION 'A different player revoked this session';
  END IF;

  SELECT revoke_player_session(test_session, test_player) INTO revoked;
  IF NOT revoked THEN
    RAISE EXCEPTION 'Session owner could not revoke the session';
  END IF;

  SELECT revoke_player_session(test_session, test_player) INTO revoked;
  IF revoked THEN
    RAISE EXCEPTION 'Repeated session revocation should be a no-op';
  END IF;

  IF to_regclass('public.public_level_leaderboard') IS NULL THEN
    RAISE EXCEPTION 'Public level leaderboard view is missing';
  END IF;

  -- Finalization binds the result to the owner and consumes the run once.
  INSERT INTO game_runs (id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at)
  VALUES (gen_random_uuid(), test_player, 2, 'island', 22222, repeat('9', 64), now(), now() + interval '5 minutes')
  RETURNING id INTO finalize_run;

  SELECT finalize_game_run(
    finalize_run, test_player, 250, 5, 2, 45000, 2, true,
    true, NULL, '{"source":"smoke-test"}'::jsonb
  ) INTO finalized_result;
  IF finalized_result IS NULL THEN
    RAISE EXCEPTION 'Valid game run did not finalize';
  END IF;

  SELECT finalize_game_run(
    finalize_run, test_player, 250, 5, 2, 45000, 2, true,
    true, NULL, '{"source":"replay"}'::jsonb
  ) INTO finalized_result;
  IF finalized_result IS NOT NULL THEN
    RAISE EXCEPTION 'A game run was finalized more than once';
  END IF;

  INSERT INTO game_runs (id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at)
  VALUES (gen_random_uuid(), test_player, 2, 'island', 22223, repeat('8', 64), now() - interval '1 hour', now() - interval '30 minutes')
  RETURNING id INTO finalize_run;

  SELECT finalize_game_run(
    finalize_run, test_player, 1, 0, 0, 1000, 0, false,
    true, NULL, '{}'::jsonb
  ) INTO finalized_result;
  IF finalized_result IS NOT NULL THEN
    RAISE EXCEPTION 'An expired game run was finalized';
  END IF;

  INSERT INTO game_runs (id, player_id, level_id, world_id, seed, ticket_sha256, started_at, expires_at)
  VALUES (gen_random_uuid(), test_player, 2, 'island', 22224, repeat('7', 64), now(), now() + interval '5 minutes')
  RETURNING id INTO finalize_run;

  SELECT finalize_game_run(
    finalize_run, second_player, 1, 0, 0, 1000, 0, false,
    true, NULL, '{}'::jsonb
  ) INTO finalized_result;
  IF finalized_result IS NOT NULL THEN
    RAISE EXCEPTION 'A different player finalized another player run';
  END IF;
END $;

ROLLBACK;
