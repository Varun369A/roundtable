-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('LINKEDIN', 'TWITTER', 'INSTAGRAM', 'YOUTUBE', 'WHATSAPP_BUSINESS', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('PROBLEM_POST', 'DEMO_VIDEO', 'USER_RESULT', 'EDUCATIONAL', 'REGIONAL_TAMIL', 'REGIONAL_HINDI', 'BEHIND_SCENES', 'WEEKLY_RECAP', 'PRODUCT_UPDATE', 'THREAD', 'REEL_SCRIPT', 'CAROUSEL', 'ARTICLE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('GENERATING', 'PENDING_APPROVAL', 'APPROVED', 'EDITED_AND_APPROVED', 'SKIPPED', 'POSTED', 'FAILED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('COMMENT', 'MENTION', 'DM', 'SHARE', 'REPLY');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('PENDING', 'APPROVED', 'POSTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('FIRST_ROUNDTABLE', 'TEN_ROUNDTABLES', 'FIFTY_ROUNDTABLES', 'HUNDRED_ROUNDTABLES', 'FIVE_HUNDRED_ROUNDTABLES', 'MULTILINGUAL_CREATOR', 'FULL_STACK_BUILDER', 'TEAM_PLAYER', 'EARLY_ADOPTER', 'FOUNDING_MEMBER', 'TOP_CONTRIBUTOR', 'CODE_BUILDER', 'CONTENT_CREATOR', 'DESIGN_THINKER', 'RESEARCH_ANALYST');

-- CreateTable
CREATE TABLE "social_credentials" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_calendar" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "hashtags" TEXT[],
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "engagementData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_items" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "draftReply" TEXT,
    "replyStatus" "ReplyStatus" NOT NULL DEFAULT 'PENDING',
    "repliedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_analytics" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "topPost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_templates" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_social_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_social_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_content_calendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "hashtags" TEXT[],
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "sourceTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_content_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabha_passports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "title" VARCHAR(150),
    "bio" VARCHAR(300),
    "avatarUrl" TEXT,
    "location" VARCHAR(100),
    "website" VARCHAR(200),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "memberNumber" SERIAL NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "showWatermark" BOOLEAN NOT NULL DEFAULT true,
    "education" JSONB,
    "experience" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sabha_passports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_skills" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "skill" VARCHAR(100) NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "autoDetected" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_achievements" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "achievement" "AchievementType" NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "passport_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_showcases" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_showcases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_views" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "viewerIp" VARCHAR(45) NOT NULL,
    "referrer" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_credentials_platform_key" ON "social_credentials"("platform");

-- CreateIndex
CREATE INDEX "content_calendar_date_platform_idx" ON "content_calendar"("date", "platform");

-- CreateIndex
CREATE INDEX "content_calendar_status_idx" ON "content_calendar"("status");

-- CreateIndex
CREATE INDEX "content_calendar_scheduledAt_idx" ON "content_calendar"("scheduledAt");

-- CreateIndex
CREATE INDEX "engagement_items_replyStatus_idx" ON "engagement_items"("replyStatus");

-- CreateIndex
CREATE INDEX "engagement_items_platform_idx" ON "engagement_items"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_analytics_platform_date_key" ON "marketing_analytics"("platform", "date");

-- CreateIndex
CREATE INDEX "user_social_credentials_userId_idx" ON "user_social_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_social_credentials_userId_platform_key" ON "user_social_credentials"("userId", "platform");

-- CreateIndex
CREATE INDEX "user_content_calendar_userId_status_idx" ON "user_content_calendar"("userId", "status");

-- CreateIndex
CREATE INDEX "user_content_calendar_scheduledAt_idx" ON "user_content_calendar"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "sabha_passports_userId_key" ON "sabha_passports"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sabha_passports_username_key" ON "sabha_passports"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sabha_passports_memberNumber_key" ON "sabha_passports"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "passport_skills_passportId_skill_key" ON "passport_skills"("passportId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "passport_achievements_passportId_achievement_key" ON "passport_achievements"("passportId", "achievement");

-- CreateIndex
CREATE UNIQUE INDEX "passport_showcases_passportId_taskId_key" ON "passport_showcases"("passportId", "taskId");

-- CreateIndex
CREATE INDEX "passport_views_passportId_createdAt_idx" ON "passport_views"("passportId", "createdAt");

-- AddForeignKey
ALTER TABLE "passport_skills" ADD CONSTRAINT "passport_skills_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "sabha_passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_achievements" ADD CONSTRAINT "passport_achievements_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "sabha_passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_showcases" ADD CONSTRAINT "passport_showcases_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "sabha_passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_views" ADD CONSTRAINT "passport_views_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "sabha_passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
