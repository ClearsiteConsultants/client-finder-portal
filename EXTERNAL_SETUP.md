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
