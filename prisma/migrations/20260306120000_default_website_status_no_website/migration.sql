-- Set new default website status to no_website for newly inserted leads.
ALTER TABLE "businesses"
ALTER COLUMN "website_status" SET DEFAULT 'no_website';
