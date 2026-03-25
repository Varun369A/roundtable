-- Arivarangam AI Learning Pipeline Migration
-- Adds: specialist context to knowledge records, domain confidence table,
--       fine-tune export log, and LearningStage enum.

-- 1. Enhance arivarangam_knowledge with full training data fields
ALTER TABLE "arivarangam_knowledge"
  ADD COLUMN IF NOT EXISTS "specialistContext" JSONB,
  ADD COLUMN IF NOT EXISTS "specialistsUsed"   TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "complexityLevel"   TEXT,
  ADD COLUMN IF NOT EXISTS "isFineTuneReady"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exportedAt"        TIMESTAMP(3);

-- Backfill: default qualityScore was 0, bump to 0.5 for existing records
UPDATE "arivarangam_knowledge" SET "qualityScore" = 0.5 WHERE "qualityScore" = 0;

-- Index for fine-tune export queries
CREATE INDEX IF NOT EXISTS "arivarangam_knowledge_isFineTuneReady_idx"
  ON "arivarangam_knowledge"("isFineTuneReady");

-- 2. LearningStage enum
DO $$ BEGIN
  CREATE TYPE "LearningStage" AS ENUM ('STUDENT', 'ADVISORY', 'INDEPENDENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. DomainConfidence — per-category learning state
CREATE TABLE IF NOT EXISTS "domain_confidence" (
  "id"                 TEXT             NOT NULL,
  "category"           "TaskCategory"   NOT NULL,
  "totalSamples"       INTEGER          NOT NULL DEFAULT 0,
  "highQualitySamples" INTEGER          NOT NULL DEFAULT 0,
  "avgQualityScore"    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "confidenceScore"    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "stage"              "LearningStage"  NOT NULL DEFAULT 'STUDENT',
  "lastUpdatedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "domain_confidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "domain_confidence_category_key"
  ON "domain_confidence"("category");

-- 4. FineTuneExport — audit log
CREATE TABLE IF NOT EXISTS "fine_tune_exports" (
  "id"          TEXT             NOT NULL,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sampleCount" INTEGER          NOT NULL,
  "categories"  TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minQuality"  DOUBLE PRECISION NOT NULL,
  "status"      TEXT             NOT NULL DEFAULT 'pending',
  "triggeredBy" TEXT,
  "notes"       TEXT,
  CONSTRAINT "fine_tune_exports_pkey" PRIMARY KEY ("id")
);
