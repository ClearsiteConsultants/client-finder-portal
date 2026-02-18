-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "client_status" TEXT,
ADD COLUMN     "converted_at" TIMESTAMPTZ(6),
ADD COLUMN     "converted_by_user_id" UUID,
ADD COLUMN     "initial_payment_status" TEXT,
ADD COLUMN     "is_client" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "next_payment_due_date" TIMESTAMPTZ(6),
ADD COLUMN     "subscription_status" TEXT;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_converted_by_user_id_fkey" FOREIGN KEY ("converted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
