-- Auto fine-tune pipeline: model lifecycle tracking

-- 1. Add auto fine-tune fields to arivarangam_ai_state
ALTER TABLE "arivarangam_ai_state"
  ADD COLUMN IF NOT EXISTS "currentModelId"        TEXT         NOT NULL DEFAULT 'claude-sonnet-4-6',
  ADD COLUMN IF NOT EXISTS "pendingFineTuneJobId"   TEXT,
  ADD COLUMN IF NOT EXISTS "pendingFineTuneFileId"  TEXT,
  ADD COLUMN IF NOT EXISTS "fineTuneStatus"         TEXT         NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS "fineTuneStartedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFineTuneAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFineTuneModel"      TEXT,
  ADD COLUMN IF NOT EXISTS "fineTuneVersion"        INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nextMilestone"          INTEGER      NOT NULL DEFAULT 1000;

-- 2. Fine-tune job audit log
CREATE TABLE IF NOT EXISTS "fine_tune_jobs" (
  "id"              TEXT             NOT NULL,
  "anthropicJobId"  TEXT,
  "anthropicFileId" TEXT,
  "status"          TEXT             NOT NULL DEFAULT 'pending',
  "baseModel"       TEXT             NOT NULL,
  "newModelId"      TEXT,
  "sampleCount"     INTEGER          NOT NULL,
  "minQuality"      DOUBLE PRECISION NOT NULL,
  "triggerReason"   TEXT             NOT NULL DEFAULT 'milestone',
  "errorMessage"    TEXT,
  "startedAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"     TIMESTAMP(3),
  "deployedAt"      TIMESTAMP(3),
  CONSTRAINT "fine_tune_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fine_tune_jobs_anthropicJobId_key"
  ON "fine_tune_jobs"("anthropicJobId") WHERE "anthropicJobId" IS NOT NULL;
