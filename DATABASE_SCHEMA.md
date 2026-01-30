# Database Schema (Initial Concept)

This document defines the initial **conceptual schema** for the Client Finder Portal. It is intended to map cleanly to a Prisma schema targeting PostgreSQL.

Goals:
- Track discovered businesses/leads, dedupe by Google `place_id`.
- Support manual review/approval before any outreach.
- Track outreach across channels (email/phone/text/social) without spamming.
- Store compliance signals (unsubscribe / opt-out / do-not-contact) and audit who did what.
- Support multiple internal users with a flat permission model (v1).

## Conventions

- Primary keys: UUID (`id`).
- Timestamps: `created_at`, `updated_at` on primary tables.
- All lookups that need to be fast should have explicit indexes.
- Normalize enough for correctness/auditability, but avoid premature complexity.

## Enums

### `WebsiteStatus`
- `no_website`
- `social_only`
- `broken`
- `technical_issues`
- `outdated`
- `acceptable`
- `unknown` (optional; used before validation has run)

### `LeadStatus`
- `pending`
- `approved`
- `rejected`
- `contacted`
- `responded`
- `inactive`

### `OutreachChannel`
- `email`
- `phone`
- `text`
- `facebook`
- `instagram`
- `linkedin`

### `DeliveryStatus` (email-focused)
- `sent`
- `delivered`
- `bounced`
- `failed`

### `EmailSource`
- `scraped`
- `pattern_match`
- `manual`
- `google_maps` (kept for completeness; Maps typically won’t provide emails)

### `SearchStatus`
- `started`
- `completed`
- `failed`

### `BusinessSource`
- `google_maps`
- `manual`

## Tables

### 1) `users`
Internal team members.

Fields:
- `id` (UUID, PK)
- `email` (string, unique, indexed)
- `name` (string, nullable)
- `password_hash` (string) *(if using credentials auth; if OAuth-only, store provider identifiers instead)*
- `created_at` (timestamp)
- `last_login` (timestamp, nullable)

Notes:
- If NextAuth is used, the schema may expand to include sessions/accounts tables; this document focuses on the app-level needs.

### 2) `businesses`
The core lead entity (one row per business).

Fields:
- `id` (UUID, PK)
- `place_id` (string, nullable, unique when present, indexed) — Google Maps unique identifier (optional for manual leads)
- `name` (string, indexed)
- `address` (string)
- `lat` (decimal/float, nullable)
- `lng` (decimal/float, nullable)
- `phone` (string, nullable)
- `website` (string, nullable)
- `business_types` (string[], nullable) — Google types/categories
- `rating` (float, nullable)
- `review_count` (int, nullable) — Maps `user_ratings_total`
- `small_business_score` (int, nullable)
- `website_status` (`WebsiteStatus`, default `unknown`)
- `lead_status` (`LeadStatus`, default `pending`)

Source / provenance:
- `source` (`BusinessSource`, default `google_maps`) — indicates whether this lead was created from Google discovery or manually entered
- `source_search_run_id` (UUID FK → search_runs, nullable) — populated when created by discovery
- `manual_dedupe_key` (string, nullable, indexed) — optional derived key (e.g., normalized name + normalized address) for preventing duplicate manual entries

Lead workflow fields:
- `discovered_at` (timestamp)
- `approved_at` (timestamp, nullable)
- `approved_by_user_id` (UUID FK → users, nullable)
- `rejected_at` (timestamp, nullable)
- `rejected_by_user_id` (UUID FK → users, nullable)
- `rejected_reason` (text, nullable)

Outreach coordination:
- `last_contact_at` (timestamp, nullable)
- `next_followup_at` (timestamp, nullable)
- `do_not_contact` (boolean, default false)
- `do_not_contact_reason` (text, nullable)
- `do_not_contact_set_at` (timestamp, nullable)
- `do_not_contact_set_by_user_id` (UUID FK → users, nullable)

Notes:
- `notes` (text, nullable) — free-form internal notes about the business

Audit:
- `created_at`, `updated_at`

Indexes / constraints:
- Unique: `place_id` (allow multiple NULLs; enforce uniqueness only when present)
- Index: `(lead_status, website_status)` for review queue
- Index: `next_followup_at` for follow-up lists
- Consider trigram index on `name` for fuzzy matching (optional)

Manual entry + linking notes:
- Manual leads should be creatable without `place_id`.
- When a user later finds a matching Google Place, the app should allow linking by setting `place_id` (must be unique) and, optionally, copying missing fields (phone/website/types) from the Place Details result.
- To reduce duplicate manual entries, consider computing `manual_dedupe_key` (lowercased, whitespace-collapsed `name` + `address`) and using it to warn users on creation if a similar lead already exists.

### 3) `contact_info`
Contact channel details for the business. (One-to-one or one-to-many; v1 can be one-to-one.)

Fields:
- `id` (UUID, PK)
- `business_id` (UUID FK → businesses, unique if one-to-one)
- `email` (string, nullable)
- `email_source` (`EmailSource`, nullable)
- `email_confidence` (int 0–100, nullable) — optional scoring for scraped/pattern emails
- `phone` (string, nullable) — may duplicate businesses.phone; keep if you prefer a single canonical place

Social profiles:
- `facebook_url` (string, nullable)
- `instagram_url` (string, nullable)
- `linkedin_url` (string, nullable)

Audit:
- `created_at`, `updated_at`

Indexes:
- Index: `email` (for lookup / dedupe / opt-outs)

### 4) `excluded_businesses`
User-managed exclude list (simple, low-budget approach to filtering chains/enterprises).

Fields:
- `id` (UUID, PK)
- `business_name` (string, indexed) — stored normalized (trimmed; optionally lowercased)
- `reason` (string, nullable)
- `added_by_user_id` (UUID FK → users)
- `created_at` (timestamp)

Constraints / matching:
- Match case-insensitively.
- Consider storing a `business_name_normalized` (lowercase/whitespace collapsed) to ensure consistent matching.

### 5) `outreach_tracking`
Event log of every outreach attempt (automated or manual) across all channels.

Fields:
- `id` (UUID, PK)
- `business_id` (UUID FK → businesses, indexed)
- `created_by_user_id` (UUID FK → users, nullable for system jobs)

Channel & timing:
- `channel` (`OutreachChannel`, indexed)
- `occurred_at` (timestamp, indexed)

Email fields (nullable unless `channel=email`):
- `touch_number` (int, nullable) — 1 or 2
- `campaign_id` (UUID FK → email_campaigns, nullable)
- `delivery_status` (`DeliveryStatus`, nullable)
- `provider_message_id` (string, nullable)
- `opened` (boolean, nullable)
- `clicked` (boolean, nullable)
- `replied` (boolean, nullable) — often manually marked

Manual outcome fields (nullable unless relevant):
- `outcome` (string, nullable) — e.g., `no_answer`, `voicemail`, `spoke`, `not_interested`, `callback`
- `notes` (text, nullable)

Guardrails:
- When a new outreach event is created, the app may update `businesses.last_contact_at` and possibly transition `lead_status` to `contacted`.

Audit:
- `created_at`

Indexes:
- Index: `(business_id, occurred_at desc)` for timeline

### 6) `email_campaigns`
Stores the 2-touch templates and settings.

Fields:
- `id` (UUID, PK)
- `name` (string)
- `subject_touch_1` (string)
- `subject_touch_2` (string)
- `template_touch_1` (text) — HTML or MJML (choose one)
- `template_touch_2` (text)
- `wait_days_between_touches` (int, default 7)
- `from_name` (string, nullable)
- `from_email` (string, nullable) — if per-campaign

Audit:
- `created_at`, `updated_at`

### 7) `opt_outs`
Compliance storage for unsubscribe/opt-out signals.

Fields:
- `id` (UUID, PK)
- `business_id` (UUID FK → businesses, nullable) — sometimes you may only know email
- `email` (string, nullable, indexed)
- `channel` (`OutreachChannel`) — in v1, primarily `email`
- `opt_out_at` (timestamp)
- `ip_address` (string, nullable)
- `user_agent` (string, nullable)
- `reason` (string, nullable)

Constraints:
- Ensure the app treats an opt-out as authoritative and permanent.
- Consider a unique constraint like `(channel, email)` when email is present.

### 8) `search_runs`
Traceability for discovery operations (helps debugging, cost tracking, and audit).

Fields:
- `id` (UUID, PK)
- `created_by_user_id` (UUID FK → users)

Inputs:
- `query_text` (string, nullable) — e.g., “dentists near Austin, TX”
- `location_text` (string, nullable)
- `lat` (decimal/float, nullable)
- `lng` (decimal/float, nullable)
- `radius_meters` (int)
- `types` (string[], nullable)

Execution:
- `status` (`SearchStatus`)
- `started_at` (timestamp)
- `completed_at` (timestamp, nullable)
- `error_message` (text, nullable)

Results summary:
- `results_found` (int, default 0)
- `results_saved_new` (int, default 0)
- `results_deduped_existing` (int, default 0)

Audit:
- `created_at`

## Relationships (Summary)
- `users` 1→N `search_runs`
- `users` 1→N `excluded_businesses`
- `users` 1→N `outreach_tracking` (manual actions)
- `businesses` 1→(1 or N) `contact_info`
- `businesses` 1→N `outreach_tracking`
- `email_campaigns` 1→N `outreach_tracking` (email events)
- `businesses` 0..N `opt_outs`

## Notes / Suggested Prisma Mapping

- Prefer Postgres enums for `WebsiteStatus`, `LeadStatus`, `OutreachChannel`.
- Store `business_types` as `String[]` in Prisma (Postgres array).
- Consider normalizing `phone` into E.164 format where possible.
- Keep `website_status=unknown` until validation runs.

## External-System Dependencies (Schema-Relevant)

- Google Places: requires `place_id` uniqueness and storage of sourced fields.
- Email provider: may require storing provider message IDs and webhook event metadata.
- SMS: do not automate without explicit consent; schema can still track manual text attempts.
