# Self-Contained API Integration Tests

This directory contains **real API integration tests** that start the actual Next.js application and test HTTP endpoints with live database interactions.

## What Makes These Tests Special

🚀 **Self-Contained**: Zero manual setup required - everything happens automatically

✅ **Real Integration**: Start actual Next.js app, make real HTTP requests, use real database

🔧 **Idempotent**: Safe to run multiple times, handles existing/missing test users gracefully

🔒 **Isolated**: Runs on port 3003, never conflicts with development environment

## Zero Setup Required

Just run the tests! The harness automatically:

1. **Checks** if test users and API keys exist
2. **Creates** test users if missing (calls `setup-test-users` script)
3. **Validates** API keys work with live app
4. **Runs** comprehensive test suite

```bash
# That's it! Everything is automatic
pnpm test:api
```

## Environment Requirements

Only basic Supabase configuration needed in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key
SUPABASE_JWT_SECRET=your_jwt_secret
```

**Test API keys are created automatically** - no manual configuration needed!

## Test Architecture

### ApiTestHarness

The `ApiTestHarness` class manages the test lifecycle:

1. **App Startup:** Spawns `npx next dev -p 3003`
2. **Health Checking:** Polls `/api/test` until app is ready
3. **Request Making:** Provides authenticated and public request methods
4. **Cleanup:** Properly stops the app process

### Test Structure

```typescript
beforeAll(async () => {
  // Start app and wait for readiness
  await harness.startApp()
  await harness.waitForReady()
}, 120000) // 2 minute timeout

afterAll(async () => {
  // Clean shutdown
  await harness.stopApp()
}, 30000)
```

## Running Tests

**Step 1: Setup (if not done already)**
```bash
npm run setup-test-users
```

**Step 2: Run the tests**
```bash
# Run all API tests (recommended)
pnpm test:api

# Run specific test file
npx jest --config=jest.api.config.js __tests__/api/profile.api.test.ts

# Run with verbose output
pnpm test:api --verbose
```

## Test Types

### Authentication Tests
- Verify unauthenticated requests are rejected (401)
- Verify invalid API keys are rejected (401)
- Verify valid API keys are accepted (200)

### Data Operation Tests
- Profile CRUD operations (GET/POST)
- Data validation and error handling
- Partial updates and edge cases

### Reliability Tests
- Response time validation
- Concurrent request handling
- Proper Content-Type headers

## Current Test Status

✅ **Working (8/12 tests passing):**
- Authentication rejection (unauthenticated)
- Authentication rejection (invalid API key)
- Authentication acceptance (valid API key)
- Profile GET requests
- Response headers validation
- Performance testing
- Concurrent request handling
- Malformed JSON error handling (500 is correct)

❌ **Real Issues Found (4/12 tests failing):**
- Profile POST requests fail due to Supabase RLS policies
- These failures indicate legitimate database configuration issues that need to be fixed

## Key Benefits

1. **Catches Real Issues:** Tests actual API behavior, not mock behavior
2. **End-to-End Validation:** Includes auth, database, API layers
3. **Production-Like:** Uses real HTTP, real auth, real database
4. **Maintainable:** No complex mocking setup to maintain
5. **Fast Feedback:** Quickly identifies breaking changes

## Test User Information

**After running `npm run setup-test-users`, you get:**

- **User 1:** test-user-1@example.com (password: testpassword123)
- **User 2:** test-user-2@example.com (password: testpassword123)

Each user has an API key that allows:
- Profile read/write operations
- Endeavor read/write operations
- All standard app functionality

**The API keys are automatically stored in `.env.local` as:**
- `TEST_API_KEY_1=ak_...` (for user 1)
- `TEST_API_KEY_2=ak_...` (for user 2)

## Port Usage

- **Port 3001:** Reserved for user development (`pnpm dev`)
- **Port 3003:** Used by API tests (isolation from dev environment)
- **Port 3000:** Web app (landing page)

This ensures tests never interfere with the developer's local environment.