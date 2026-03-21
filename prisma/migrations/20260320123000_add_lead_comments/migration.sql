-- Create table for lead comments and threaded replies.
CREATE TABLE "lead_comments" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "content" TEXT NOT NULL,
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_comments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "lead_comments"
ADD CONSTRAINT "lead_comments_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_comments"
ADD CONSTRAINT "lead_comments_author_user_id_fkey"
FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_comments"
ADD CONSTRAINT "lead_comments_parent_comment_id_fkey"
FOREIGN KEY ("parent_comment_id") REFERENCES "lead_comments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "lead_comments_business_id_created_at_idx"
ON "lead_comments"("business_id", "created_at");

CREATE INDEX "lead_comments_parent_comment_id_idx"
ON "lead_comments"("parent_comment_id");

CREATE INDEX "lead_comments_author_user_id_idx"
ON "lead_comments"("author_user_id");
