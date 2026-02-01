-- AlterTable: Add caching fields to businesses table
ALTER TABLE "businesses" ADD COLUMN "cached_at" TIMESTAMPTZ(6);

-- AlterTable: Add caching fields to search_runs table
ALTER TABLE "search_runs" ADD COLUMN "cache_key" TEXT;
ALTER TABLE "search_runs" ADD COLUMN "used_cached_results" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "search_runs" ADD COLUMN "cached_from_search_run_id" UUID;

-- Create index for cache lookups
CREATE INDEX "search_runs_cache_key_idx" ON "search_runs"("cache_key");
CREATE INDEX "businesses_cached_at_idx" ON "businesses"("cached_at");
