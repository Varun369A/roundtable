-- Rename Sabha-prefixed tables to Arivarangam
ALTER TABLE IF EXISTS "SabhaKnowledge" RENAME TO "ArivarangamKnowledge";
ALTER TABLE IF EXISTS "SabhaAIState" RENAME TO "ArivarangamAIState";
ALTER TABLE IF EXISTS "SabhaAITrainingRecord" RENAME TO "ArivarangamAITrainingRecord";
ALTER TABLE IF EXISTS "SabhaRepo" RENAME TO "ArivarangamRepo";
ALTER TABLE IF EXISTS "SabhaPassport" RENAME TO "ArivarangamPassport";

-- Rename @@map table names (snake_case versions)
ALTER TABLE IF EXISTS "sabha_knowledge" RENAME TO "arivarangam_knowledge";
ALTER TABLE IF EXISTS "sabha_ai_state" RENAME TO "arivarangam_ai_state";
ALTER TABLE IF EXISTS "sabha_ai_training_records" RENAME TO "arivarangam_ai_training_records";
ALTER TABLE IF EXISTS "sabha_repos" RENAME TO "arivarangam_repos";
ALTER TABLE IF EXISTS "sabha_passports" RENAME TO "arivarangam_passports";

-- Update enum values in SubtaskStatus if they exist
DO $$ BEGIN
  ALTER TYPE "SubtaskStatus" RENAME VALUE 'sabha_ready' TO 'arivarangam_ready';
EXCEPTION WHEN undefined_object OR invalid_parameter_value THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "SubtaskStatus" RENAME VALUE 'sabha_ai_correction' TO 'arivarangam_ai_correction';
EXCEPTION WHEN undefined_object OR invalid_parameter_value THEN NULL;
END $$;
