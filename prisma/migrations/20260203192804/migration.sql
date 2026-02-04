-- CreateEnum
CREATE TYPE "ValidationJobType" AS ENUM ('website_validation', 'email_scraping', 'social_scraping');

-- CreateEnum
CREATE TYPE "ValidationJobStatus" AS ENUM ('queued', 'running', 'success', 'failure');

-- CreateTable
CREATE TABLE "validation_jobs" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "job_type" "ValidationJobType" NOT NULL,
    "status" "ValidationJobStatus" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "validation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "validation_jobs_status_created_at_idx" ON "validation_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "validation_jobs_business_id_job_type_idx" ON "validation_jobs"("business_id", "job_type");

-- AddForeignKey
ALTER TABLE "validation_jobs" ADD CONSTRAINT "validation_jobs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
