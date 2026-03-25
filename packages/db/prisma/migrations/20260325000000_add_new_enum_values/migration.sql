-- Add new TaskCategory values (keeping old ones for backward compat)
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'content';
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'voice';

-- Add new AIModel values
ALTER TYPE "AIModel" ADD VALUE IF NOT EXISTS 'gemini-2.5-pro';
ALTER TYPE "AIModel" ADD VALUE IF NOT EXISTS 'gpt-image-1';
