-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('OPEN', 'MATCHED', 'CLAIM_PENDING', 'VERIFIED', 'RETURNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'COLLECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('TEXT_DESCRIPTION', 'SERIAL_NUMBER', 'RECEIPT_REFERENCE', 'EXTERNAL_DOCUMENT_URL', 'PHOTO_REFERENCE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'REPORT_CREATED', 'REPORT_UPDATED', 'REPORT_STATUS_CHANGED', 'MATCH_CREATED', 'MATCH_REVIEWED', 'CLAIM_SUBMITTED', 'CLAIM_REVIEWED', 'CUSTODY_RELEASED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "campus_id" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "department" VARCHAR(160) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "building_name" VARCHAR(160) NOT NULL,
    "zone_name" VARCHAR(160) NOT NULL,
    "custody_desk" VARCHAR(160),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "reference_code" VARCHAR(32) NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "distinguishing_features" TEXT NOT NULL,
    "verification_prompt" VARCHAR(255),
    "specific_spot" VARCHAR(200) NOT NULL,
    "custody_location" VARCHAR(200),
    "occurred_date" DATE NOT NULL,
    "time_window" VARCHAR(40) NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_images" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "public_url" VARCHAR(1024) NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "alt_text" VARCHAR(255),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "lost_item_id" UUID NOT NULL,
    "found_item_id" UUID NOT NULL,
    "similarity_score" INTEGER NOT NULL,
    "matched_signals" JSONB NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "claim_code" VARCHAR(32) NOT NULL,
    "item_id" UUID NOT NULL,
    "claimant_id" UUID NOT NULL,
    "ownership_statement" TEXT NOT NULL,
    "preferred_pickup_window" VARCHAR(100) NOT NULL,
    "pickup_desk" VARCHAR(160),
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_id" UUID,
    "reviewer_note" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "collected_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_evidence" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "evidence_type" "EvidenceType" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "details" TEXT NOT NULL,
    "external_url" VARCHAR(1024),
    "verified_by_reviewer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "summary" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "item_id" UUID,
    "match_id" UUID,
    "claim_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_campus_id_key" ON "users"("campus_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_department_idx" ON "users"("department");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE INDEX "locations_building_name_idx" ON "locations"("building_name");

-- CreateIndex
CREATE INDEX "locations_is_active_idx" ON "locations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "locations_building_name_zone_name_key" ON "locations"("building_name", "zone_name");

-- CreateIndex
CREATE UNIQUE INDEX "items_reference_code_key" ON "items"("reference_code");

-- CreateIndex
CREATE INDEX "items_report_type_status_idx" ON "items"("report_type", "status");

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "items"("category_id");

-- CreateIndex
CREATE INDEX "items_location_id_idx" ON "items"("location_id");

-- CreateIndex
CREATE INDEX "items_reported_by_id_idx" ON "items"("reported_by_id");

-- CreateIndex
CREATE INDEX "items_occurred_date_idx" ON "items"("occurred_date");

-- CreateIndex
CREATE INDEX "items_created_at_idx" ON "items"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "item_images_storage_key_key" ON "item_images"("storage_key");

-- CreateIndex
CREATE INDEX "item_images_item_id_display_order_idx" ON "item_images"("item_id", "display_order");

-- CreateIndex
CREATE INDEX "matches_lost_item_id_status_idx" ON "matches"("lost_item_id", "status");

-- CreateIndex
CREATE INDEX "matches_found_item_id_status_idx" ON "matches"("found_item_id", "status");

-- CreateIndex
CREATE INDEX "matches_similarity_score_idx" ON "matches"("similarity_score");

-- CreateIndex
CREATE UNIQUE INDEX "matches_lost_item_id_found_item_id_key" ON "matches"("lost_item_id", "found_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claim_code_key" ON "claims"("claim_code");

-- CreateIndex
CREATE INDEX "claims_status_created_at_idx" ON "claims"("status", "created_at");

-- CreateIndex
CREATE INDEX "claims_claimant_id_idx" ON "claims"("claimant_id");

-- CreateIndex
CREATE INDEX "claims_reviewed_by_id_idx" ON "claims"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_item_id_claimant_id_key" ON "claims"("item_id", "claimant_id");

-- CreateIndex
CREATE INDEX "claim_evidence_claim_id_idx" ON "claim_evidence"("claim_id");

-- CreateIndex
CREATE INDEX "claim_evidence_evidence_type_idx" ON "claim_evidence"("evidence_type");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_images" ADD CONSTRAINT "item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_lost_item_id_fkey" FOREIGN KEY ("lost_item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_found_item_id_fkey" FOREIGN KEY ("found_item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

