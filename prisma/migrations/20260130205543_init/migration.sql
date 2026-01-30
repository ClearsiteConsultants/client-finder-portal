-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('no_website', 'social_only', 'broken', 'technical_issues', 'outdated', 'acceptable', 'unknown');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('pending', 'approved', 'rejected', 'contacted', 'responded', 'inactive');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('email', 'phone', 'text', 'facebook', 'instagram', 'linkedin');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('sent', 'delivered', 'bounced', 'failed');

-- CreateEnum
CREATE TYPE "EmailSource" AS ENUM ('scraped', 'pattern_match', 'manual', 'google_maps');

-- CreateEnum
CREATE TYPE "SearchStatus" AS ENUM ('started', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "BusinessSource" AS ENUM ('google_maps', 'manual');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "place_id" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "phone" TEXT,
    "website" TEXT,
    "business_types" TEXT[],
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER,
    "small_business_score" INTEGER,
    "website_status" "WebsiteStatus" NOT NULL DEFAULT 'unknown',
    "lead_status" "LeadStatus" NOT NULL DEFAULT 'pending',
    "source" "BusinessSource" NOT NULL DEFAULT 'google_maps',
    "source_search_run_id" UUID,
    "manual_dedupe_key" TEXT,
    "discovered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_user_id" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejected_by_user_id" UUID,
    "rejected_reason" TEXT,
    "last_contact_at" TIMESTAMPTZ(6),
    "next_followup_at" TIMESTAMPTZ(6),
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "do_not_contact_reason" TEXT,
    "do_not_contact_set_at" TIMESTAMPTZ(6),
    "do_not_contact_set_by_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_info" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "email" TEXT,
    "email_source" "EmailSource",
    "email_confidence" INTEGER,
    "phone" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "linkedin_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excluded_businesses" (
    "id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "business_name_normalized" TEXT NOT NULL,
    "reason" TEXT,
    "added_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excluded_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_tracking" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "channel" "OutreachChannel" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "touch_number" INTEGER,
    "campaign_id" UUID,
    "delivery_status" "DeliveryStatus",
    "provider_message_id" TEXT,
    "opened" BOOLEAN,
    "clicked" BOOLEAN,
    "replied" BOOLEAN,
    "outcome" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject_touch_1" TEXT NOT NULL,
    "subject_touch_2" TEXT NOT NULL,
    "template_touch_1" TEXT NOT NULL,
    "template_touch_2" TEXT NOT NULL,
    "wait_days_between_touches" INTEGER NOT NULL DEFAULT 7,
    "from_name" TEXT,
    "from_email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opt_outs" (
    "id" UUID NOT NULL,
    "business_id" UUID,
    "email" TEXT,
    "channel" "OutreachChannel" NOT NULL,
    "opt_out_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "reason" TEXT,

    CONSTRAINT "opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "query_text" TEXT,
    "location_text" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "radius_meters" INTEGER NOT NULL,
    "types" TEXT[],
    "status" "SearchStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "results_found" INTEGER NOT NULL DEFAULT 0,
    "results_saved_new" INTEGER NOT NULL DEFAULT 0,
    "results_deduped_existing" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_place_id_key" ON "businesses"("place_id");

-- CreateIndex
CREATE INDEX "businesses_name_idx" ON "businesses"("name");

-- CreateIndex
CREATE INDEX "businesses_lead_status_website_status_idx" ON "businesses"("lead_status", "website_status");

-- CreateIndex
CREATE INDEX "businesses_next_followup_at_idx" ON "businesses"("next_followup_at");

-- CreateIndex
CREATE INDEX "businesses_manual_dedupe_key_idx" ON "businesses"("manual_dedupe_key");

-- CreateIndex
CREATE INDEX "contact_info_email_idx" ON "contact_info"("email");

-- CreateIndex
CREATE INDEX "excluded_businesses_business_name_normalized_idx" ON "excluded_businesses"("business_name_normalized");

-- CreateIndex
CREATE INDEX "outreach_tracking_business_id_occurred_at_idx" ON "outreach_tracking"("business_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "outreach_tracking_channel_idx" ON "outreach_tracking"("channel");

-- CreateIndex
CREATE INDEX "outreach_tracking_occurred_at_idx" ON "outreach_tracking"("occurred_at");

-- CreateIndex
CREATE INDEX "opt_outs_email_idx" ON "opt_outs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "opt_outs_channel_email_key" ON "opt_outs"("channel", "email");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_source_search_run_id_fkey" FOREIGN KEY ("source_search_run_id") REFERENCES "search_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_rejected_by_user_id_fkey" FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_do_not_contact_set_by_user_id_fkey" FOREIGN KEY ("do_not_contact_set_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_info" ADD CONSTRAINT "contact_info_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excluded_businesses" ADD CONSTRAINT "excluded_businesses_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_tracking" ADD CONSTRAINT "outreach_tracking_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_tracking" ADD CONSTRAINT "outreach_tracking_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_tracking" ADD CONSTRAINT "outreach_tracking_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opt_outs" ADD CONSTRAINT "opt_outs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
