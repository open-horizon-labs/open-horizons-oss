-- Test Suite for Parent Relationship Functions
-- Run this after applying parent-relationship-optimizations.sql

-- Set up test data
BEGIN;

-- Create test user
INSERT INTO auth.users (id, email) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

-- Clean up any existing test data
DELETE FROM edges WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM endeavors WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';

-- Create test endeavors with hierarchy:
-- mission:A
--   ├── aim:B
--   │   └── initiative:C
--   │       └── task:D
--   └── aim:E
--       └── task:F

INSERT INTO endeavors (id, user_id, title, status) VALUES
  ('mission:test:A', '550e8400-e29b-41d4-a716-446655440000', 'Test Mission A', 'active'),
  ('aim:test:B', '550e8400-e29b-41d4-a716-446655440000', 'Test Aim B', 'active'),
  ('initiative:test:C', '550e8400-e29b-41d4-a716-446655440000', 'Test Initiative C', 'active'),
  ('task:test:D', '550e8400-e29b-41d4-a716-446655440000', 'Test Task D', 'active'),
  ('aim:test:E', '550e8400-e29b-41d4-a716-446655440000', 'Test Aim E', 'active'),
  ('task:test:F', '550e8400-e29b-41d4-a716-446655440000', 'Test Task F', 'active');

-- Create parent-child relationships
INSERT INTO edges (user_id, from_endeavor_id, to_endeavor_id, relationship, weight) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'aim:test:B', 'mission:test:A', 'supports', 1.0),
  ('550e8400-e29b-41d4-a716-446655440000', 'initiative:test:C', 'aim:test:B', 'supports', 1.0),
  ('550e8400-e29b-41d4-a716-446655440000', 'task:test:D', 'initiative:test:C', 'supports', 1.0),
  ('550e8400-e29b-41d4-a716-446655440000', 'aim:test:E', 'mission:test:A', 'supports', 1.0),
  ('550e8400-e29b-41d4-a716-446655440000', 'task:test:F', 'aim:test:E', 'supports', 1.0);

COMMIT;

-- TEST 1: Cycle Detection - Should detect direct cycle
DO $$
DECLARE
  cycle_count INTEGER;
BEGIN
  -- Try to make mission:A a child of aim:B (would create direct cycle)
  SELECT COUNT(*) INTO cycle_count
  FROM check_cycle_would_be_created(
    '550e8400-e29b-41d4-a716-446655440000',
    'mission:test:A',
    'aim:test:B'
  );

  IF cycle_count > 0 THEN
    RAISE NOTICE 'TEST 1 PASSED: Direct cycle correctly detected';
  ELSE
    RAISE EXCEPTION 'TEST 1 FAILED: Direct cycle not detected';
  END IF;
END $$;

-- TEST 2: Cycle Detection - Should detect indirect cycle
DO $$
DECLARE
  cycle_count INTEGER;
BEGIN
  -- Try to make mission:A a child of task:D (would create 3-level cycle)
  SELECT COUNT(*) INTO cycle_count
  FROM check_cycle_would_be_created(
    '550e8400-e29b-41d4-a716-446655440000',
    'mission:test:A',
    'task:test:D'
  );

  IF cycle_count > 0 THEN
    RAISE NOTICE 'TEST 2 PASSED: Indirect cycle correctly detected';
  ELSE
    RAISE EXCEPTION 'TEST 2 FAILED: Indirect cycle not detected';
  END IF;
END $$;

-- TEST 3: Cycle Detection - Should allow valid parent relationship
DO $$
DECLARE
  cycle_count INTEGER;
BEGIN
  -- Try to make task:F a child of initiative:C (valid move)
  SELECT COUNT(*) INTO cycle_count
  FROM check_cycle_would_be_created(
    '550e8400-e29b-41d4-a716-446655440000',
    'task:test:F',
    'initiative:test:C'
  );

  IF cycle_count = 0 THEN
    RAISE NOTICE 'TEST 3 PASSED: Valid relationship correctly allowed';
  ELSE
    RAISE EXCEPTION 'TEST 3 FAILED: Valid relationship incorrectly blocked';
  END IF;
END $$;

-- TEST 4: Atomic Update - Should successfully update parent
DO $$
DECLARE
  old_parent_count INTEGER;
  new_parent_count INTEGER;
BEGIN
  -- Check current state: task:F should be child of aim:E
  SELECT COUNT(*) INTO old_parent_count
  FROM edges
  WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
    AND from_endeavor_id = 'task:test:F'
    AND to_endeavor_id = 'aim:test:E'
    AND relationship = 'supports';

  IF old_parent_count != 1 THEN
    RAISE EXCEPTION 'TEST 4 SETUP FAILED: Initial state incorrect';
  END IF;

  -- Move task:F from aim:E to initiative:C
  PERFORM update_parent_relationship_atomic(
    '550e8400-e29b-41d4-a716-446655440000',
    'task:test:F',
    'initiative:test:C'
  );

  -- Check old relationship is gone
  SELECT COUNT(*) INTO old_parent_count
  FROM edges
  WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
    AND from_endeavor_id = 'task:test:F'
    AND to_endeavor_id = 'aim:test:E'
    AND relationship = 'supports';

  -- Check new relationship exists
  SELECT COUNT(*) INTO new_parent_count
  FROM edges
  WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
    AND from_endeavor_id = 'task:test:F'
    AND to_endeavor_id = 'initiative:test:C'
    AND relationship = 'supports';

  IF old_parent_count = 0 AND new_parent_count = 1 THEN
    RAISE NOTICE 'TEST 4 PASSED: Atomic update correctly moved parent';
  ELSE
    RAISE EXCEPTION 'TEST 4 FAILED: Atomic update failed (old: %, new: %)', old_parent_count, new_parent_count;
  END IF;
END $$;

-- TEST 5: Atomic Update - Should handle removing parent (making root)
DO $$
DECLARE
  parent_count INTEGER;
BEGIN
  -- Remove parent from task:F (make it root)
  PERFORM update_parent_relationship_atomic(
    '550e8400-e29b-41d4-a716-446655440000',
    'task:test:F',
    NULL
  );

  -- Check no parent relationship exists
  SELECT COUNT(*) INTO parent_count
  FROM edges
  WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
    AND from_endeavor_id = 'task:test:F'
    AND relationship = 'supports';

  IF parent_count = 0 THEN
    RAISE NOTICE 'TEST 5 PASSED: Atomic update correctly removed parent';
  ELSE
    RAISE EXCEPTION 'TEST 5 FAILED: Parent removal failed (count: %)', parent_count;
  END IF;
END $$;

-- TEST 6: User Isolation - Should not see other user's data
DO $$
DECLARE
  cycle_count INTEGER;
BEGIN
  -- Create second user with different UUID
  -- Try to detect cycle using wrong user_id
  SELECT COUNT(*) INTO cycle_count
  FROM check_cycle_would_be_created(
    '11111111-1111-1111-1111-111111111111', -- Wrong user ID
    'mission:test:A',
    'aim:test:B'
  );

  IF cycle_count = 0 THEN
    RAISE NOTICE 'TEST 6 PASSED: User isolation correctly enforced';
  ELSE
    RAISE EXCEPTION 'TEST 6 FAILED: User isolation breach detected';
  END IF;
END $$;

-- TEST 7: Performance Test - Should handle larger graphs efficiently
DO $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  duration INTERVAL;
  i INTEGER;
BEGIN
  start_time := clock_timestamp();

  -- Create a larger test hierarchy (50 levels deep)
  FOR i IN 1..50 LOOP
    INSERT INTO endeavors (id, user_id, title, status) VALUES
      ('perf:test:' || i, '550e8400-e29b-41d4-a716-446655440000', 'Performance Test ' || i, 'active');

    IF i > 1 THEN
      INSERT INTO edges (user_id, from_endeavor_id, to_endeavor_id, relationship, weight) VALUES
        ('550e8400-e29b-41d4-a716-446655440000', 'perf:test:' || i, 'perf:test:' || (i-1), 'supports', 1.0);
    END IF;
  END LOOP;

  -- Test cycle detection on deep hierarchy
  PERFORM check_cycle_would_be_created(
    '550e8400-e29b-41d4-a716-446655440000',
    'perf:test:1',
    'perf:test:50'
  );

  end_time := clock_timestamp();
  duration := end_time - start_time;

  IF duration < INTERVAL '1 second' THEN
    RAISE NOTICE 'TEST 7 PASSED: Performance test completed in % (< 1 second)', duration;
  ELSE
    RAISE WARNING 'TEST 7 SLOW: Performance test took % (> 1 second)', duration;
  END IF;
END $$;

-- Clean up test data
BEGIN;
DELETE FROM edges WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM endeavors WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
COMMIT;

-- Summary
RAISE NOTICE '=== PARENT RELATIONSHIP FUNCTION TESTS COMPLETED ===';
RAISE NOTICE 'If you see this message without exceptions, all tests passed!';
RAISE NOTICE 'Run this script in your Supabase SQL editor to verify the functions work correctly.';