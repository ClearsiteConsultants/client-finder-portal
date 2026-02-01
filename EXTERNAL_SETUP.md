# External Setup Outline (Local / Preview / Prod)

This document lists expected **manual external setup tasks** by phase and what must be in place before each phase can be developed and validated. It also documents what information should be added back into the repo/dev environment so setup is reproducible.

Scope:
- Environments: **local**, **preview**, **prod**.
- Database: **Neon** for Postgres (integrated with Vercel).

---

## Global Conventions

### Environments
- **Local**: developer machine (uses `.env.local`, local Next.js dev server).
- **Preview**: Vercel preview deployments created per branch/PR.
- **Prod**: Vercel production deployment.

### Secrets + Configuration Storage
- Do **not** commit secrets.
- Store env vars in:
  - Local: `.env.local` (gitignored)
  - Preview: Vercel “Preview” environment variables
  - Prod: Vercel “Production” environment variables

### Add To Repo (After Setup)
Add/keep these files so the team has a single reference point:
- `EXTERNAL_SETUP.md` (this file)
- `DATABASE_SCHEMA.md` (schema reference)
- `.env.example` (non-secret template of required variables)
- Provider webhook endpoint paths (documented; no secrets)

---

## Phase 1 — Foundation

### External Setup Tasks

#### 1) Vercel Project
- Create a Vercel project connected to this repo.
- Confirm Preview deployments are enabled.

**Dependencies**:
- Git repo accessible to Vercel.

**Repo/dev additions**:
- Document required env vars in `.env.example`.

#### 2) Neon Postgres (Local/Preview/Prod)
Recommended simple structure:
- One Neon project with:
  - a **production branch** (for prod)
  - a **preview branch** (or allow Vercel to create per-preview branches if desired)
  - optional **dev branch** (for shared dev), plus local pointing to dev branch

Setup steps:
- Create Neon project.
- Create branches:
  - `prod`
  - `preview`
  - (optional) `dev`
- Obtain connection strings for each.
- In Vercel, configure `DATABASE_URL` for Preview and Production.

**Dependencies**:
- Vercel project created.

**Repo/dev additions**:
- Add `.env.example` entries:
  - `DATABASE_URL=`
- Add a short note in this doc about branch naming conventions.

#### 3) Domain / Auth URL Baseline (even before auth)
- Decide the canonical URLs:
  - Local: `http://localhost:3000`
  - Preview: Vercel preview URL pattern
  - Prod: `https://<your-domain>`

**Dependencies**:
- None (but needed soon for NextAuth callbacks).

**Repo/dev additions**:
- `.env.example` entries (placeholders):
  - `NEXTAUTH_URL=`
  - `NEXTAUTH_SECRET=`

### Phase 1 “Ready to Develop” Checklist
- Vercel project exists.
- Neon database branches exist.
- `DATABASE_URL` set for local + preview + prod.
- `.env.example` created/updated.

---

## Phase 2 — Business Discovery (Google Places)

### External Setup Tasks

#### 1) Google Cloud Project + Places API
- Create a Google Cloud project.
- Enable the correct APIs:
  - Places API (and any supporting Maps APIs your chosen endpoints require)
- Create an API key.
- Restrict the key:
  - **HTTP referrers** (for browser calls) OR **server IP / service restrictions** (for server calls)
  - Restrict by API as well.

Recommendation for security/cost control:
- Call Google Places from **server-side only** (Next.js API route) so the key is not exposed.

**Dependencies**:
- Phase 1: app can run, env vars management in place.

**Repo/dev additions**:
- `.env.example` entries:
  - `GOOGLE_MAPS_API_KEY=`
- Document (in this file) whether the key is server-only and what restrictions were applied.

### Phase 2 “Ready to Develop” Checklist
- Google Cloud project + billing enabled.
- Places API enabled.
- API key created and restricted.
- Env vars set in local/preview/prod.

---

## Phase 3 — Website Validation & Scraping

### External Setup Tasks

#### 1) Outbound Networking Expectations (Vercel)
Website validation/scraping requires outbound HTTP(S) from the runtime.

Notes:
- Some sites block bots; expect partial success.
- Respect robots.txt where feasible.

**Dependencies**:
- Phase 2 can create leads to validate.

**Repo/dev additions**:
- `.env.example` entries (tunable behavior, not secrets):
  - `SCRAPER_USER_AGENT=`
  - `SCRAPER_TIMEOUT_MS=`
  - `SCRAPER_MAX_PAGES=`
  - `RESPECT_ROBOTS_TXT=true|false`

#### 2) Optional: Monitoring (Sentry)
Not required, but helpful once scraping starts.

**Repo/dev additions**:
- `.env.example`:
  - `SENTRY_DSN=`

### Phase 3 “Ready to Develop” Checklist
- No new required external systems beyond Phase 2.
- Scraper config documented.

---

## Phase 4 — Manual Review Workflow (UI + Manual Lead Entry)

### External Setup Tasks

#### 1) Team Authentication Provider Choice
If using NextAuth:
- Decide auth approach:
  - Credentials (username/password)
  - Google OAuth
  - Microsoft OAuth

**Dependencies**:
- Phase 1: `NEXTAUTH_URL`, `NEXTAUTH_SECRET` in each environment.

**Manual provider setup (if OAuth)**:
- Create OAuth app in provider console.
- Add callback URLs:
  - Local: `http://localhost:3000/api/auth/callback/<provider>`
  - Preview: `https://<preview-url>/api/auth/callback/<provider>`
  - Prod: `https://<prod-domain>/api/auth/callback/<provider>`

**Repo/dev additions**:
- `.env.example`:
  - `AUTH_PROVIDER_CLIENT_ID=`
  - `AUTH_PROVIDER_CLIENT_SECRET=`

### Phase 4 “Ready to Develop” Checklist
- Auth provider configured (at least local).
- Preview/prod callback URLs configured.

---

## Phase 5 — Email Outreach System (SendGrid or AWS SES)

### External Setup Tasks

#### 1) Choose Provider
- Start simple: SendGrid (or similar) is typically fastest to stand up.

#### 2) Sender Identity + Domain Auth
- Verify sender identity (single sender or domain).
- Configure DNS records for deliverability:
  - SPF
  - DKIM
  - (optional) DMARC

**Dependencies**:
- Domain/DNS access.
- Phase 4: auth + manual approval flow (so you don’t email without review).

**Repo/dev additions**:
- `.env.example`:
  - `EMAIL_PROVIDER=sendgrid|ses`
  - `SENDGRID_API_KEY=` (or SES equivalents)
  - `EMAIL_FROM_NAME=`
  - `EMAIL_FROM_ADDRESS=`
  - `COMPANY_POSTAL_ADDRESS=` (used in footer for compliance)

#### 3) Webhooks (opens/clicks/bounces/unsubscribes)
- Configure provider webhooks to point to your app endpoints.
- Secure webhooks (provider signing secret) if available.

**Dependencies**:
- Preview/prod deployments accessible.

**Repo/dev additions**:
- Document webhook endpoint URLs in this file.
- `.env.example`:
  - `EMAIL_WEBHOOK_SIGNING_SECRET=` (if applicable)

### Phase 5 “Ready to Develop” Checklist
- Provider account created.
- Sender verified.
- DNS records published.
- Env vars set for preview/prod.
- Webhooks configured (optional at first, but recommended).

---

## Phase 6 — Multi-Channel Tracking (Phone/Text/Social)

### External Setup Tasks

#### 1) No required external systems (v1)
- Calls, texts, and social messaging are **manual** actions.
- The system only logs activity.

**Dependencies**:
- None.

**Repo/dev additions**:
- None required.

### Phase 6 “Ready to Develop” Checklist
- No external setup required.

---

## Phase 7 — Dashboard, Analytics, and E2E Tests

### External Setup Tasks

#### 1) Test Data / Test Accounts
- Ensure there is a safe way to run tests:
  - Local test DB (Neon dev branch or a separate Neon branch)
  - Preview test DB (avoid using preview DB for destructive tests unless isolated)

**Dependencies**:
- Phase 1: Prisma migrations stable.

**Repo/dev additions**:
- `.env.example`:
  - `DATABASE_URL_TEST=` (optional, recommended)

#### 2) E2E Runner (Playwright) Environment
- Ensure the environment can run a headless browser.
- For CI (later), ensure Playwright browsers are installed.

**Dependencies**:
- Phase 4+ flows present (login, review, lead detail, logging).

**Repo/dev additions**:
- Document `npm run test:e2e` expectations in README (or in PRD steps if preferred).

### Phase 7 “Ready to Develop” Checklist
- A dedicated test DB strategy is chosen and documented.

---

## Phase 8 — Hardening / Compliance Review

### External Setup Tasks

#### 1) Key Restrictions & Security Hygiene
- Confirm Google API key restrictions are correct.
- Confirm webhook signing is enabled and configured (if used).
- Confirm Vercel env vars are set correctly for Preview vs Prod.

#### 2) Compliance Operations
- Confirm email footer includes postal address.
- Confirm unsubscribe endpoint works in prod.
- Confirm internal process for handling removal requests.

**Dependencies**:
- Phase 5 email is sending.

**Repo/dev additions**:
- Document operational checklist (can live in this file or a future OPS doc if you want).

---

## Minimal `.env.example` (Suggested)

Add a `.env.example` file (no secrets) that includes, at minimum:

- `DATABASE_URL=`
- `NEXTAUTH_URL=`
- `NEXTAUTH_SECRET=`
- `GOOGLE_MAPS_API_KEY=`
- `EMAIL_PROVIDER=`
- `EMAIL_FROM_NAME=`
- `EMAIL_FROM_ADDRESS=`
- `COMPANY_POSTAL_ADDRESS=`

Optional:
- `SENDGRID_API_KEY=`
- `EMAIL_WEBHOOK_SIGNING_SECRET=`
- `DATABASE_URL_TEST=`
- `SCRAPER_USER_AGENT=`
- `SCRAPER_TIMEOUT_MS=`
- `SCRAPER_MAX_PAGES=`
- `RESPECT_ROBOTS_TXT=`

### Phase 1 Deployment Guide

#### Local Verification
Before deploying to Vercel, ensure the app passes local verification:

```bash
# Run linting and type checking
npm run lint
npm run typecheck

# Run tests (requires DATABASE_URL configured)
npm test

# Run full verification suite (includes tests)
npm run verify

# Run CI verification (lint + typecheck + build, no database required)
npm run verify:ci

# Test production build
npm run build
```

#### Vercel Deployment Steps

1. **Connect Repository to Vercel**
   - Log in to Vercel dashboard
   - Click "Add New Project"
   - Import your Git repository
   - Configure build settings (auto-detected for Next.js)

2. **Configure Environment Variables**
   
   **Production Environment:**
   - `DATABASE_URL` - Neon production branch connection string
   - `DATABASE_URL_UNPOOLED` - Neon unpooled connection (for migrations)
   - `NEXTAUTH_URL` - Your production domain (e.g., https://yourdomain.com)
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   
   **Preview Environment:**
   - `DATABASE_URL` - Neon preview branch connection string
   - `NEXTAUTH_URL` - Vercel preview URL pattern
   - `NEXTAUTH_SECRET` - Same as production or separate preview secret

3. **Database Setup**
   - Run migrations on Neon production branch:
     ```bash
     DATABASE_URL=<neon-prod-url> npx prisma migrate deploy
     ```
   - Run migrations on Neon preview branch:
     ```bash
     DATABASE_URL=<neon-preview-url> npx prisma migrate deploy
     ```

4. **Deploy to Vercel**
   - Push your code to trigger deployment
   - Wait for deployment to complete
   - Note the deployment URL(s)

5. **Run Database Migrations** (See Database Migration Guide below)

6. **Create Initial User** (See User Provisioning Guide below)

7. **Verify Deployment**
   - Visit your deployed site
   - Test login with created user
   - Verify authentication redirects work
   - Check that protected pages require login

#### Build Command
Vercel will automatically run:
```bash
npm install
npm run build
```

The `postinstall` script ensures Prisma client is generated before build.

---

## Database Migration Guide

### Running Migrations in Different Environments

#### Local Environment
```bash
# Ensure .env.local has DATABASE_URL set
npx prisma migrate deploy
```

#### Preview Environment (Vercel + Neon)
```bash
# Use the DATABASE_URL from your Neon preview branch
DATABASE_URL="postgresql://user:pass@ep-preview-123.us-east-2.aws.neon.tech/neondb" npx prisma migrate deploy
```

#### Production Environment (Vercel + Neon)
```bash
# Use the DATABASE_URL from your Neon production branch
DATABASE_URL="postgresql://user:pass@ep-prod-456.us-east-2.aws.neon.tech/neondb" npx prisma migrate deploy
```

### Finding Your Database URL

**From Neon Dashboard:**
1. Log in to Neon (https://neon.tech)
2. Select your project
3. Select the appropriate branch (preview/production)
4. Copy the connection string from the Connection Details section

**From Vercel Dashboard:**
1. Log in to Vercel
2. Go to your project → Settings → Environment Variables
3. Find DATABASE_URL for the appropriate environment
4. Copy the value (you may need to reveal it)

### Migration Best Practices

1. **Always back up production data before migrations**
2. **Test migrations on preview/dev environments first**
3. **Run migrations before deploying code that depends on schema changes**
4. **Verify migration success:**
   ```bash
   DATABASE_URL="<your-url>" npx prisma migrate status
   ```

---

## User Provisioning Guide

This section provides step-by-step instructions for creating user accounts in local, preview, and production environments.

### Prerequisites

- Node.js and npm installed locally
- Appropriate DATABASE_URL for the target environment
- `tsx` package (included in devDependencies)
- Database migrations have been run successfully

### User Creation Script

The repository includes `scripts/create-user.ts` for creating users. The script:
- Hashes passwords with bcryptjs
- Enforces unique email constraint
- Creates users directly in the database
- Validates input parameters

**Script signature:**
```bash
node -r tsx/cjs scripts/create-user.ts <email> <password> <name>
```

### Local Environment

**Step 1: Ensure local database is ready**
```bash
# Check that .env.local has DATABASE_URL
cat .env.local | grep DATABASE_URL

# Run migrations if not already done
npx prisma migrate deploy
```

**Step 2: Create user**
```bash
# The script will automatically use DATABASE_URL from .env.local
node -r tsx/cjs scripts/create-user.ts admin@example.com SecurePass123 "Admin User"
```

**Step 3: Verify**
```bash
# Start dev server
npm run dev

# Visit http://localhost:3000
# Try logging in with admin@example.com / SecurePass123
```

### Preview Environment (Vercel + Neon)

**Step 1: Get the preview DATABASE_URL**

Option A - From Neon Dashboard:
1. Log in to Neon
2. Select your project
3. Select the preview branch
4. Copy the connection string

Option B - From Vercel Dashboard:
1. Log in to Vercel
2. Project → Settings → Environment Variables
3. Find DATABASE_URL for Preview environment
4. Copy the value

**Step 2: Verify migrations are up to date**
```bash
DATABASE_URL="postgresql://user:pass@ep-preview-123.us-east-2.aws.neon.tech/neondb" npx prisma migrate status
```

**Step 3: Create user against preview database**
```bash
DATABASE_URL="postgresql://user:pass@ep-preview-123.us-east-2.aws.neon.tech/neondb" node -r tsx/cjs scripts/create-user.ts admin@preview.example.com PreviewPass123 "Preview Admin"
```

**Step 4: Verify**
1. Find your preview deployment URL (from Vercel or GitHub PR checks)
2. Visit the preview URL (e.g., `https://your-app-git-branch-username.vercel.app`)
3. Log in with the credentials you just created

### Production Environment (Vercel + Neon)

⚠️ **IMPORTANT: Production Security**
- Use strong, unique passwords
- Store credentials in a password manager
- Limit the number of production users
- Consider using a jump box or VPN for production access

**Step 1: Get the production DATABASE_URL**

From Neon Dashboard:
1. Log in to Neon
2. Select your project
3. Select the **production** branch
4. Copy the connection string

**Step 2: Verify migrations are current**
```bash
DATABASE_URL="postgresql://user:pass@ep-prod-456.us-east-2.aws.neon.tech/neondb" npx prisma migrate status
```

Expected output: "Database schema is up to date!"

**Step 3: Create production user**
```bash
# Use a strong password!
DATABASE_URL="postgresql://user:pass@ep-prod-456.us-east-2.aws.neon.tech/neondb" node -r tsx/cjs scripts/create-user.ts admin@yourdomain.com StrongPassword456! "Production Admin"
```

**Step 4: Verify**
1. Visit your production domain (e.g., `https://yourdomain.com`)
2. Log in with the credentials you just created
3. Verify access to protected areas

### Common Issues and Troubleshooting

#### Issue: "Cannot find module 'tsx/cjs'"
**Solution:** Ensure dependencies are installed
```bash
npm install
```

#### Issue: "PrismaClientInitializationError: Can't reach database server"
**Possible causes:**
- DATABASE_URL is incorrect
- Database branch doesn't exist
- Network connectivity issues
- Neon branch is suspended (free tier)

**Solution:**
```bash
# Test database connection
DATABASE_URL="<your-url>" npx prisma db pull
```

#### Issue: "Unique constraint failed on the fields: (`email`)"
**Cause:** User with that email already exists

**Solution:**
```bash
# List existing users
DATABASE_URL="<your-url>" npx prisma studio
# Or delete the existing user first (be careful in production!)
```

#### Issue: "Migration status shows pending migrations"
**Solution:** Run migrations before creating users
```bash
DATABASE_URL="<your-url>" npx prisma migrate deploy
```

### Security Best Practices

1. **Never commit DATABASE_URL to version control**
   - Use `.env.local` locally (gitignored)
   - Store in Vercel environment variables for preview/prod

2. **Use strong passwords for production**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Use a password generator

3. **Rotate credentials regularly**
   - Change passwords every 90 days
   - Update NEXTAUTH_SECRET periodically

4. **Limit database access**
   - Use Neon's IP allowlists if available
   - Restrict DATABASE_URL to necessary team members

5. **Monitor user access**
   - Check `last_login` field in users table
   - Remove inactive accounts

### Managing Multiple Users

**Create additional users:**
```bash
# Development team member
DATABASE_URL="<url>" node -r tsx/cjs scripts/create-user.ts dev@company.com Pass123 "Dev User"

# Sales team member
DATABASE_URL="<url>" node -r tsx/cjs scripts/create-user.ts sales@company.com Pass456 "Sales User"
```

**List all users (using Prisma Studio):**
```bash
DATABASE_URL="<url>" npx prisma studio
# Opens browser interface to view/edit users
```

**Delete a user:**
```bash
# Using Prisma Studio (recommended) or write a delete script
# For now, use Prisma Studio to safely delete users
```

### Quick Reference

**Create local user:**
```bash
node -r tsx/cjs scripts/create-user.ts user@example.com password "Name"
```

**Create preview user:**
```bash
DATABASE_URL="<preview-url>" node -r tsx/cjs scripts/create-user.ts user@example.com password "Name"
```

**Create production user:**
```bash
DATABASE_URL="<production-url>" node -r tsx/cjs scripts/create-user.ts user@example.com password "Name"
```

**Check migration status:**
```bash
DATABASE_URL="<url>" npx prisma migrate status
```

**Run migrations:**
```bash
DATABASE_URL="<url>" npx prisma migrate deploy
```

---

### Phase 2 Implementation Status

**✅ COMPLETE** - Google Places API integration implemented (P2-001).

#### What Was Implemented
- **Service Layer** (`src/lib/places/`):
  - `client.ts` - Google Places API wrapper using `@googlemaps/google-maps-services-js`
  - `normalizer.ts` - Transforms Google Places data to internal schema
  - `service.ts` - Business logic for search, deduplication, and persistence
  - `types.ts` - TypeScript interfaces for API requests/responses

- **API Endpoint** (`src/app/api/places/search`):
  - POST `/api/places/search` - Server-side endpoint for business discovery
  - Accepts: `location` (city/ZIP or lat,lng), `radius` (meters), optional `businessType`
  - Returns: Array of discovered businesses with persistence status
  - Protected by authentication (requires valid session)
  - Graceful error handling with actionable messages

- **Features**:
  - Geocoding support (converts city/ZIP to coordinates)
  - Direct lat,lng input support
  - Place ID deduplication (updates existing businesses)
  - Search run tracking (status, results count, errors)
  - Field masking for cost control
  - Captures: name, address, phone, website, business types, rating, review count
  - Identifies businesses with no website (`websiteStatus: 'no_website'`)

- **Tests**:
  - ✅ Unit tests for normalizer (11 tests, all passing)
  - ✅ Integration tests for service with mocked API
  - ✅ Type checking passes
  - ✅ Linting passes

#### Usage Example
```typescript
// POST /api/places/search
{
  "location": "Seattle, WA",  // or "47.6062,-122.3321"
  "radius": 5000,             // meters (max 50,000)
  "businessType": "restaurant" // optional
}
```

#### Error Handling
The API returns appropriate HTTP status codes:
- `400` - Invalid request
- `401` - Unauthorized
- `403` - Invalid API key
- `429` - Quota exceeded
- `500` - Internal server error

#### Cost Control
- Server-side only (key not exposed)
- Field masking for minimal data
- Deduplication by place_id
- Search run tracking

---

