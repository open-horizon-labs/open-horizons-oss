# @oh/app — App

Auth-gated app with magic links and Daily Review.

Routes:
- Public: `/login`, `/signup`, `/auth/callback`
- Protected: `/dashboard`, `/daily/[date]`, `/settings`

Env (`apps/app/.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (required for API key authentication)
- `OPENAI_API_KEY` (server-side only)
- `OPENAI_MODEL` (default: `gpt-5-nano`)
 - `OPENAI_REASONING_EFFORT` (default: `minimal`; one of `minimal|low|medium|high`)

Dev:
- `PORT=3001 pnpm dev:app` → http://localhost:3001
- Supabase Auth Redirect (dev): `http://localhost:3001/auth/callback`

Supabase:
- (No Daily table required). In Auth > URL config, add the redirect URL above (and production `https://app.openhorizons.me/auth/callback`).

Setup:
- `cp apps/app/.env.example apps/app/.env.local`
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Set `OPENAI_API_KEY` (optional for walking skeleton; stub used if missing) and optionally `OPENAI_MODEL`.

Run:
- `pnpm dev` (from repo root) and open the App at your configured port.

Test the walking skeleton:
- Sign in → navigate to `/daily/YYYY-MM-DD` (e.g., `/daily/2025-09-11`).
- Write free-form notes. Optionally add sections `## Done`, `## Aims`, `## Next`, `## Reflection`.
- Click “Regenerate Review” to propose blocks. Append/Replace updates only the chosen section.
- A status line shows provenance/metrics (model, tokens, latency, timestamp). No secrets are exposed.
- Click “Use this draft” → a Diff & Replace modal opens. Confirm to replace the Reflection (Win text) with the draft summary, then click Save as usual. No automatic overwrite occurs.

Performance note:
- Set `OPENAI_REASONING_EFFORT` to `minimal` or `low` for faster time-to-first-token on simple instruction-following. Use `medium`/`high` if you later need deeper reasoning.

## API Key Management

The app supports API key authentication for programmatic access to all endpoints.

### UI Management
- Navigate to `/settings/api-keys` to create and manage API keys
- Each key has configurable scopes, permissions, and expiration
- Keys are displayed with prefix only (e.g., `ak_1234...`) for security

### Test User Setup
For development and testing, use the npm command to create test users with API keys:

```bash
npm run setup-test-users
```

This creates:
- 2 test users: `test-user-1@example.com` and `test-user-2@example.com` (password: `testpassword123`)
- 2 API keys automatically stored in `.env.local` as `TEST_API_KEY_1` and `TEST_API_KEY_2`

### API Usage
All API endpoints support both session authentication (web UI) and API key authentication:

```bash
# Using API key with profile endpoint
curl -H "Authorization: Bearer $TEST_API_KEY_1" http://localhost:3001/api/profile

# Using API key with other endpoints
curl -H "Authorization: Bearer $TEST_API_KEY_1" http://localhost:3001/api/dashboard
curl -H "Authorization: Bearer $TEST_API_KEY_1" http://localhost:3001/api/contexts
```

### Security Model
- API keys are SHA-256 hashed in database storage
- Service role used only for authentication lookup (not data access)
- Standard RLS policies apply once user context is established
- Keys support scopes (`read`, `write`) and granular permissions

## API Testing

The app includes comprehensive **self-contained** API integration tests that start the actual Next.js server and test HTTP endpoints with real database interactions.

### Running API Tests

```bash
# Just run the tests - everything is automatic!
pnpm test:api

# Or run specific test suites
NODE_ENV=test npx jest --config=jest.api.config.js __tests__/api/profile.api.test.ts
NODE_ENV=test npx jest --config=jest.api.config.js __tests__/api/security.api.test.ts
```

### Self-Contained Testing Features

🚀 **Zero Setup Required**: Test users and API keys are created automatically if missing

✅ **Fast When Ready**: If test users already exist, tests start immediately

🔧 **Idempotent**: Safe to run multiple times - won't create duplicate users

🔒 **Isolated**: Tests run on port 3003, never conflicts with development (port 3001)

### What the API Tests Do
- **Auto-setup**: Creates test users and API keys if they don't exist
- **Real HTTP**: Starts Next.js app on port 3003 and makes actual HTTP requests
- **Authentication**: Tests both session and API key authentication flows
- **Security**: Cross-user isolation testing with multiple API keys
- **Database**: Real Supabase interactions with RLS policy validation
- **Edge cases**: Error handling, malformed requests, concurrent access

### Test Coverage
- **Profile API** (12 tests): CRUD operations, authentication, data validation
- **Security** (6 tests): User isolation, invalid keys, authorization edge cases

See [`__tests__/api/README.md`](__tests__/api/README.md) for detailed documentation.

Notes:
- No SLO enforcement in MVP; latency/tokens are surfaced as UI metrics only.
- "Fresh day" rule: the draft uses only the selected day's blocks; no cross-day cues.
- Attachments: all explicitly attached/forward-linked items are included when present.
