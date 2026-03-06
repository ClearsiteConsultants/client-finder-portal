-- Remove 'unknown' from WebsiteStatus enum.
-- Includes a defensive backfill in case any rows still hold legacy values.

-- Defensive cleanup before enum cast.
UPDATE "businesses"
SET "website_status" = 'technical_issues'
WHERE "website_status" = 'unknown'
  AND "website" IS NOT NULL
  AND btrim("website") <> '';

UPDATE "businesses" b
SET "website_status" = 'social_only'
WHERE b."website_status" = 'unknown'
  AND (b."website" IS NULL OR btrim(b."website") = '')
  AND EXISTS (
    SELECT 1
    FROM "contact_info" c
    WHERE c."business_id" = b."id"
      AND (
        (c."facebook_url" IS NOT NULL AND btrim(c."facebook_url") <> '') OR
        (c."instagram_url" IS NOT NULL AND btrim(c."instagram_url") <> '') OR
        (c."linkedin_url" IS NOT NULL AND btrim(c."linkedin_url") <> '')
      )
  );

UPDATE "businesses"
SET "website_status" = 'no_website'
WHERE "website_status" = 'unknown';

ALTER TYPE "WebsiteStatus" RENAME TO "WebsiteStatus_old";

CREATE TYPE "WebsiteStatus" AS ENUM (
  'no_website',
  'social_only',
  'broken',
  'technical_issues',
  'outdated',
  'acceptable'
);

ALTER TABLE "businesses"
ALTER COLUMN "website_status" DROP DEFAULT;

ALTER TABLE "businesses"
ALTER COLUMN "website_status" TYPE "WebsiteStatus"
USING ("website_status"::text::"WebsiteStatus");

ALTER TABLE "businesses"
ALTER COLUMN "website_status" SET DEFAULT 'no_website';

DROP TYPE "WebsiteStatus_old";
