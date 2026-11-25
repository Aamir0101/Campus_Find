-- Phase 6: Secure Claim & Verification schema alignment
BEGIN;

-- 1. Align ClaimStatus enum to PENDING, UNDER_REVIEW, APPROVED, REJECTED, RETURNED
CREATE TYPE "ClaimStatus_new" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED'
);

ALTER TABLE "claims" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "claims" ALTER COLUMN "status" TYPE "ClaimStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING_REVIEW' THEN 'PENDING'
    WHEN 'NEEDS_INFO' THEN 'UNDER_REVIEW'
    WHEN 'COLLECTED' THEN 'RETURNED'
    WHEN 'WITHDRAWN' THEN 'REJECTED'
    ELSE "status"::text
  END::"ClaimStatus_new"
);

ALTER TYPE "ClaimStatus" RENAME TO "ClaimStatus_old";
ALTER TYPE "ClaimStatus_new" RENAME TO "ClaimStatus";
DROP TYPE "ClaimStatus_old";

ALTER TABLE "claims" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 2. Extend AuditAction enum with CLAIM_APPROVED and CLAIM_REJECTED
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLAIM_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLAIM_REJECTED';

-- 3. Add rejection_reason and replace unconditional unique index with active-claim partial unique index
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

DROP INDEX IF EXISTS "claims_item_id_claimant_id_key";
CREATE INDEX IF NOT EXISTS "claims_item_id_claimant_id_idx" ON "claims"("item_id", "claimant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "claims_item_id_claimant_id_active_key"
  ON "claims"("item_id", "claimant_id")
  WHERE "status" IN ('PENDING', 'UNDER_REVIEW', 'APPROVED');

-- 4. Add private object storage metadata columns to claim_evidence (never storing binary bytes)
ALTER TABLE "claim_evidence" ADD COLUMN IF NOT EXISTS "storage_key" VARCHAR(512);
ALTER TABLE "claim_evidence" ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(64);
ALTER TABLE "claim_evidence" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "claim_evidence_storage_key_key" ON "claim_evidence"("storage_key");

COMMIT;
