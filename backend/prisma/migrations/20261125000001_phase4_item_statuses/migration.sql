-- AlterEnum: Align ItemStatus values with Phase 4 Lost & Found lifecycle
BEGIN;
CREATE TYPE "ItemStatus_new" AS ENUM (
  'ACTIVE',
  'POTENTIAL_MATCH',
  'CLAIM_PENDING',
  'UNDER_VERIFICATION',
  'RETURNED',
  'CLOSED'
);
ALTER TABLE "items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "items" ALTER COLUMN "status" TYPE "ItemStatus_new" USING (
  CASE "status"::text
    WHEN 'OPEN' THEN 'ACTIVE'
    WHEN 'MATCHED' THEN 'POTENTIAL_MATCH'
    WHEN 'VERIFIED' THEN 'UNDER_VERIFICATION'
    WHEN 'ARCHIVED' THEN 'CLOSED'
    ELSE "status"::text
  END::"ItemStatus_new"
);
ALTER TYPE "ItemStatus" RENAME TO "ItemStatus_old";
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";
DROP TYPE "ItemStatus_old";
ALTER TABLE "items" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
