-- Backfill legacy unknown website statuses to concrete values.

-- 1) Unknown + website present => technical_issues (conservative default until validation refines it).
UPDATE "businesses"
SET "website_status" = 'technical_issues'
WHERE "website_status" = 'unknown'
  AND "website" IS NOT NULL
  AND btrim("website") <> '';

-- 2) Unknown + no website but has social => social_only.
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

-- 3) Unknown + no website/no social => no_website.
UPDATE "businesses"
SET "website_status" = 'no_website'
WHERE "website_status" = 'unknown';
