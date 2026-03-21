-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('FREE', 'BUILDER', 'STUDIO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'WAITING_CLARIFICATION', 'ROUTING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubtaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SubtaskRole" AS ENUM ('INITIAL', 'REVIEW', 'SYNTHESIS');

-- CreateEnum
CREATE TYPE "AIModel" AS ENUM ('claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'midjourney-v6', 'dalle-3', 'stability-xl', 'elevenlabs', 'runway-gen3', 'sarvam-1', 'gamma', 'groq', 'cohere', 'whisper', 'sabha-ai');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('research', 'copywriting', 'strategy', 'images', 'video', 'audio', 'presentation', 'code', 'translation', 'data_analysis', 'general');

-- CreateEnum
CREATE TYPE "OutputType" AS ENUM ('text', 'image', 'audio', 'video', 'file', 'json');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled', 'trialing');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('development', 'design', 'learning', 'marketing', 'business', 'content', 'research', 'personal');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('task_completed', 'task_failed', 'workspace_invite', 'weekly_digest', 'system_alert', 'model_fallback', 'healing_applied', 'sabha_ready', 'sabha_ai_correction');

-- CreateEnum
CREATE TYPE "HealingAction" AS ENUM ('stale_task_requeued', 'dead_letter_retried', 'fallback_model_used', 'circuit_reset_waited', 'permanently_failed');

-- CreateEnum
CREATE TYPE "SandboxStatus" AS ENUM ('PENDING', 'TESTING', 'CONFIRMED', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SandboxFixType" AS ENUM ('template_instruction', 'rate_limit', 'fallback_model', 'prompt_adjustment', 'feature_flag');

-- CreateEnum
CREATE TYPE "CodeProjectStatus" AS ENUM ('ASSEMBLING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('bug', 'feature_request', 'general', 'praise');

-- CreateEnum
CREATE TYPE "SabhaAIStatus" AS ENUM ('LEARNING', 'READY', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('GITHUB_PUSH', 'GITHUB_PR', 'GITHUB_ISSUE', 'GMAIL_SEND', 'GMAIL_DRAFT', 'NOTION_PAGE', 'NOTION_DB_ROW', 'WEBHOOK', 'SLACK_MESSAGE');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GITHUB', 'GMAIL', 'NOTION', 'SLACK', 'JIRA', 'LINEAR', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'TASK_USAGE', 'REFERRAL_BONUS', 'REFERRAL_REWARD', 'SIGNUP_BONUS', 'PROMOTION', 'EXPIRY', 'REFUND', 'MARKETPLACE_EARN');

-- CreateEnum
CREATE TYPE "ExpertStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'SUBMITTED', 'ACCEPTED', 'DISPUTED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PackCategory" AS ENUM ('LEGAL', 'MEDICAL', 'FINANCE', 'ENGINEERING', 'MARKETING', 'EDUCATION', 'REAL_ESTATE', 'HR');

-- CreateEnum
CREATE TYPE "PackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('EXPORT', 'DELETION');

-- CreateEnum
CREATE TYPE "UpiPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CREDITED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "tier" "UserTier" NOT NULL DEFAULT 'FREE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freeTasksRemaining" INTEGER NOT NULL DEFAULT 3,
    "foundingMember" BOOLEAN NOT NULL DEFAULT false,
    "trainingConsent" BOOLEAN NOT NULL DEFAULT false,
    "trainingConsentAt" TIMESTAMP(3),
    "betaCode" TEXT,
    "isBeta" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "currentWorkspaceId" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "type" "WorkspaceType" NOT NULL DEFAULT 'PERSONAL',
    "ownerId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{"allowMemberInvite":false,"defaultTaskVisibility":"private","requireApprovalForPublish":false}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roundtable_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "subcategory" TEXT,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "agents" JSONB NOT NULL,
    "examplePrompts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roundtable_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "templateId" TEXT,
    "verticalPackId" TEXT,
    "title" TEXT NOT NULL,
    "originalGoal" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "contextObject" JSONB NOT NULL DEFAULT '{}',
    "totalCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "abandonedAtRound" INTEGER,
    "abandonedAt" TIMESTAMP(3),
    "timeToCompleteMs" INTEGER,
    "templateUsed" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "assignedModel" "AIModel" NOT NULL,
    "status" "SubtaskStatus" NOT NULL DEFAULT 'PENDING',
    "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" "SubtaskRole" NOT NULL DEFAULT 'INITIAL',
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "reviewsSubtaskId" TEXT,
    "inputPrompt" TEXT NOT NULL,
    "executionOrder" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6),
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtask_outputs" (
    "id" TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "type" "OutputType" NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "fileSizeBytes" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtask_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_connectors" (
    "id" TEXT NOT NULL,
    "model" "AIModel" NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capabilities" TEXT[],
    "categories" TEXT[],
    "inputCostPer1M" DECIMAL(10,4) NOT NULL,
    "outputCostPer1M" DECIMAL(10,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "razorpaySubscriptionId" TEXT,
    "razorpayCustomerId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "tasksUsed" INTEGER NOT NULL DEFAULT 0,
    "roundtableTasksUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "eventType" TEXT NOT NULL,
    "aiModel" "AIModel",
    "costUsd" DECIMAL(10,6) NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firewall_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taskId" TEXT,
    "threats" JSONB NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "context" TEXT NOT NULL DEFAULT 'ai_prompt',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firewall_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_analytics" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "taskCount" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "avgCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "avgDurationMs" INTEGER NOT NULL DEFAULT 0,
    "returnUserRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "performanceScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "healing_logs" (
    "id" TEXT NOT NULL,
    "action" "HealingAction" NOT NULL,
    "taskId" TEXT,
    "subtaskId" TEXT,
    "fromModel" TEXT,
    "toModel" TEXT,
    "errorType" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "healing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_sessions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "proposedFix" JSONB NOT NULL,
    "status" "SandboxStatus" NOT NULL DEFAULT 'PENDING',
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sandbox_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_runs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "output" JSONB NOT NULL DEFAULT '{}',
    "errorMsg" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sandbox_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_projects" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "status" "CodeProjectStatus" NOT NULL DEFAULT 'ASSEMBLING',
    "zipUrl" TEXT,
    "repoUrl" TEXT,
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "avatarUrl" TEXT,
    "scopes" TEXT NOT NULL DEFAULT 'repo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_invites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "beta_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "FeedbackType" NOT NULL DEFAULT 'general',
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "page" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalTasksCreated" INTEGER NOT NULL DEFAULT 0,
    "totalTasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalSubtasksRun" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "favoriteModel" "AIModel",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabha_knowledge" (
    "id" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "templateCategory" TEXT,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "model" "AIModel" NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taskId" TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sabha_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabha_ai_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" "SabhaAIStatus" NOT NULL DEFAULT 'LEARNING',
    "knowledgeCount" INTEGER NOT NULL DEFAULT 0,
    "readyThreshold" INTEGER NOT NULL DEFAULT 50,
    "enabledAt" TIMESTAMP(3),
    "lastLearnedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sabha_ai_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_env_vars" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_env_vars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ai_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT,
    "encryptedKey" TEXT NOT NULL,
    "salt" TEXT,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_routing_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskCategory" "TaskCategory" NOT NULL,
    "preferredModel" "AIModel" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_routing_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_clarifications" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_clarifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user_set',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memory_facts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "sourceTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_memory_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_steering_messages" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "appliedToSubtaskId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_steering_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "templateId" TEXT,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "maxRuns" INTEGER,
    "notifyOnFail" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_task_runs" (
    "id" TEXT NOT NULL,
    "scheduledTaskId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'scheduled',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "scheduled_task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roundtable_sessions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "allowSteering" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roundtable_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roundtable_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roundtable_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roundtable_reactions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subtaskId" TEXT,
    "userId" TEXT,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roundtable_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "goalTemplate" TEXT NOT NULL,
    "assignedModel" TEXT,
    "dependsOnStepId" TEXT,
    "outputMapping" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "triggerPayload" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_runs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" TEXT NOT NULL,
    "output" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "workflow_step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtask_verifications" (
    "id" TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factualScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "citationsFound" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,

    CONSTRAINT "subtask_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_actions" (
    "id" TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "integrationId" TEXT,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "encryptedToken" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenAuthTag" TEXT NOT NULL,
    "refreshToken" TEXT,
    "refreshIv" TEXT,
    "refreshAuthTag" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_transcriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "provider" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "durationSecs" DOUBLE PRECISION NOT NULL,
    "originalText" TEXT NOT NULL,
    "processedText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "audioFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "taskId" TEXT,
    "referralId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "bonusCredits" INTEGER NOT NULL DEFAULT 100,
    "rewardCredits" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "bonusPaid" BOOLEAN NOT NULL DEFAULT false,
    "rewardPaid" BOOLEAN NOT NULL DEFAULT false,
    "firstTaskAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_packs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceInr" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "specializations" TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "credentialsUrl" TEXT,
    "ratePerReview" INTEGER NOT NULL,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ExpertStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_reviews" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'OPEN',
    "specialization" TEXT NOT NULL,
    "description" TEXT,
    "creditsEscrowed" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "feedback" TEXT,
    "rating" INTEGER,
    "ratingComment" TEXT,

    CONSTRAINT "expert_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vertical_packs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "PackCategory" NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "status" "PackStatus" NOT NULL DEFAULT 'ACTIVE',
    "agents" JSONB NOT NULL,
    "contextBlob" JSONB NOT NULL DEFAULT '{}',
    "disclaimer" TEXT,
    "isIncludedInTier" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creditsPerTask" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vertical_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pack_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pack_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_provider_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "limitInr" DOUBLE PRECISION NOT NULL,
    "warningAt" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "user_provider_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_versions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "githubCommit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabha_ai_training_records" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "intentParse" JSONB NOT NULL,
    "round1Outputs" JSONB NOT NULL,
    "round2Reviews" JSONB NOT NULL,
    "deduplicatedReview" TEXT NOT NULL,
    "finalSynthesis" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION,
    "userDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "userRequestedFix" BOOLEAN NOT NULL DEFAULT false,
    "userRating" INTEGER,
    "usedForTraining" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sabha_ai_training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upi_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditPackId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amountInrPaise" INTEGER NOT NULL,
    "creditsGranted" INTEGER NOT NULL,
    "status" "UpiPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "webhookReceivedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upi_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tier_idx" ON "users"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerUserId_key" ON "oauth_accounts"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");

-- CreateIndex
CREATE INDEX "workspaces_slug_idx" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invites_token_key" ON "workspace_invites"("token");

-- CreateIndex
CREATE INDEX "workspace_invites_workspaceId_idx" ON "workspace_invites"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_invites_token_idx" ON "workspace_invites"("token");

-- CreateIndex
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites"("email");

-- CreateIndex
CREATE INDEX "roundtable_templates_category_idx" ON "roundtable_templates"("category");

-- CreateIndex
CREATE INDEX "roundtable_templates_isBuiltIn_isPublic_idx" ON "roundtable_templates"("isBuiltIn", "isPublic");

-- CreateIndex
CREATE INDEX "roundtable_templates_createdById_idx" ON "roundtable_templates"("createdById");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_userId_createdAt_idx" ON "tasks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_status_idx" ON "tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "tasks_templateId_idx" ON "tasks"("templateId");

-- CreateIndex
CREATE INDEX "subtasks_taskId_idx" ON "subtasks"("taskId");

-- CreateIndex
CREATE INDEX "subtasks_status_idx" ON "subtasks"("status");

-- CreateIndex
CREATE INDEX "subtasks_taskId_status_idx" ON "subtasks"("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subtask_outputs_subtaskId_key" ON "subtask_outputs"("subtaskId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_connectors_model_key" ON "ai_connectors"("model");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpaySubscriptionId_key" ON "subscriptions"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "billing_events_userId_idx" ON "billing_events"("userId");

-- CreateIndex
CREATE INDEX "billing_events_taskId_idx" ON "billing_events"("taskId");

-- CreateIndex
CREATE INDEX "billing_events_createdAt_idx" ON "billing_events"("createdAt");

-- CreateIndex
CREATE INDEX "billing_events_userId_createdAt_idx" ON "billing_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "billing_events_userId_aiModel_idx" ON "billing_events"("userId", "aiModel");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_type_idx" ON "notifications"("userId", "type");

-- CreateIndex
CREATE INDEX "firewall_logs_userId_idx" ON "firewall_logs"("userId");

-- CreateIndex
CREATE INDEX "firewall_logs_blocked_idx" ON "firewall_logs"("blocked");

-- CreateIndex
CREATE INDEX "firewall_logs_createdAt_idx" ON "firewall_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "template_analytics_templateId_key" ON "template_analytics"("templateId");

-- CreateIndex
CREATE INDEX "template_analytics_templateId_idx" ON "template_analytics"("templateId");

-- CreateIndex
CREATE INDEX "template_analytics_performanceScore_idx" ON "template_analytics"("performanceScore");

-- CreateIndex
CREATE INDEX "healing_logs_taskId_idx" ON "healing_logs"("taskId");

-- CreateIndex
CREATE INDEX "healing_logs_action_idx" ON "healing_logs"("action");

-- CreateIndex
CREATE INDEX "healing_logs_createdAt_idx" ON "healing_logs"("createdAt");

-- CreateIndex
CREATE INDEX "sandbox_sessions_status_idx" ON "sandbox_sessions"("status");

-- CreateIndex
CREATE INDEX "sandbox_sessions_createdById_idx" ON "sandbox_sessions"("createdById");

-- CreateIndex
CREATE INDEX "sandbox_runs_sessionId_idx" ON "sandbox_runs"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "code_projects_taskId_key" ON "code_projects"("taskId");

-- CreateIndex
CREATE INDEX "code_projects_userId_idx" ON "code_projects"("userId");

-- CreateIndex
CREATE INDEX "code_projects_status_idx" ON "code_projects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "github_connections_userId_key" ON "github_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "beta_invites_code_key" ON "beta_invites"("code");

-- CreateIndex
CREATE INDEX "beta_invites_code_idx" ON "beta_invites"("code");

-- CreateIndex
CREATE INDEX "beta_invites_usedById_idx" ON "beta_invites"("usedById");

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");

-- CreateIndex
CREATE INDEX "feedback_type_idx" ON "feedback"("type");

-- CreateIndex
CREATE INDEX "feedback_createdAt_idx" ON "feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "usage_stats_userId_key" ON "usage_stats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sabha_knowledge_subtaskId_key" ON "sabha_knowledge"("subtaskId");

-- CreateIndex
CREATE INDEX "sabha_knowledge_category_idx" ON "sabha_knowledge"("category");

-- CreateIndex
CREATE INDEX "sabha_knowledge_qualityScore_idx" ON "sabha_knowledge"("qualityScore");

-- CreateIndex
CREATE UNIQUE INDEX "project_env_vars_projectId_name_key" ON "project_env_vars"("projectId", "name");

-- CreateIndex
CREATE INDEX "user_ai_connections_userId_idx" ON "user_ai_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_connections_userId_provider_key" ON "user_ai_connections"("userId", "provider");

-- CreateIndex
CREATE INDEX "user_routing_preferences_userId_idx" ON "user_routing_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_routing_preferences_userId_taskCategory_key" ON "user_routing_preferences"("userId", "taskCategory");

-- CreateIndex
CREATE INDEX "task_clarifications_taskId_idx" ON "task_clarifications"("taskId");

-- CreateIndex
CREATE INDEX "user_memories_userId_isActive_idx" ON "user_memories"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "user_memories_userId_key_key" ON "user_memories"("userId", "key");

-- CreateIndex
CREATE INDEX "user_memory_facts_userId_idx" ON "user_memory_facts"("userId");

-- CreateIndex
CREATE INDEX "task_steering_messages_taskId_appliedAt_idx" ON "task_steering_messages"("taskId", "appliedAt");

-- CreateIndex
CREATE INDEX "scheduled_tasks_userId_idx" ON "scheduled_tasks"("userId");

-- CreateIndex
CREATE INDEX "scheduled_tasks_isActive_nextRunAt_idx" ON "scheduled_tasks"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_task_runs_scheduledTaskId_idx" ON "scheduled_task_runs"("scheduledTaskId");

-- CreateIndex
CREATE INDEX "scheduled_task_runs_taskId_idx" ON "scheduled_task_runs"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "roundtable_sessions_taskId_key" ON "roundtable_sessions"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "roundtable_sessions_accessCode_key" ON "roundtable_sessions"("accessCode");

-- CreateIndex
CREATE INDEX "roundtable_sessions_accessCode_idx" ON "roundtable_sessions"("accessCode");

-- CreateIndex
CREATE INDEX "roundtable_sessions_ownerId_idx" ON "roundtable_sessions"("ownerId");

-- CreateIndex
CREATE INDEX "roundtable_participants_sessionId_idx" ON "roundtable_participants"("sessionId");

-- CreateIndex
CREATE INDEX "roundtable_participants_userId_idx" ON "roundtable_participants"("userId");

-- CreateIndex
CREATE INDEX "roundtable_reactions_sessionId_subtaskId_idx" ON "roundtable_reactions"("sessionId", "subtaskId");

-- CreateIndex
CREATE INDEX "workflows_userId_idx" ON "workflows"("userId");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflow_steps_workflowId_stepOrder_idx" ON "workflow_steps"("workflowId", "stepOrder");

-- CreateIndex
CREATE INDEX "workflow_runs_workflowId_idx" ON "workflow_runs"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_step_runs_runId_idx" ON "workflow_step_runs"("runId");

-- CreateIndex
CREATE INDEX "workflow_step_runs_taskId_idx" ON "workflow_step_runs"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "subtask_verifications_subtaskId_key" ON "subtask_verifications"("subtaskId");

-- CreateIndex
CREATE INDEX "execution_actions_subtaskId_idx" ON "execution_actions"("subtaskId");

-- CreateIndex
CREATE INDEX "execution_actions_taskId_idx" ON "execution_actions"("taskId");

-- CreateIndex
CREATE INDEX "execution_actions_userId_status_idx" ON "execution_actions"("userId", "status");

-- CreateIndex
CREATE INDEX "user_integrations_userId_provider_idx" ON "user_integrations"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "user_integrations_userId_provider_displayName_key" ON "user_integrations"("userId", "provider", "displayName");

-- CreateIndex
CREATE INDEX "voice_transcriptions_userId_idx" ON "voice_transcriptions"("userId");

-- CreateIndex
CREATE INDEX "voice_transcriptions_taskId_idx" ON "voice_transcriptions"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_userId_key" ON "credit_wallets"("userId");

-- CreateIndex
CREATE INDEX "credit_transactions_walletId_idx" ON "credit_transactions"("walletId");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_userId_key" ON "referral_codes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_refereeId_key" ON "referrals"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "expert_profiles_userId_key" ON "expert_profiles"("userId");

-- CreateIndex
CREATE INDEX "expert_profiles_status_isAvailable_idx" ON "expert_profiles"("status", "isAvailable");

-- CreateIndex
CREATE INDEX "expert_profiles_specializations_idx" ON "expert_profiles"("specializations");

-- CreateIndex
CREATE INDEX "expert_reviews_status_idx" ON "expert_reviews"("status");

-- CreateIndex
CREATE INDEX "expert_reviews_expertId_status_idx" ON "expert_reviews"("expertId", "status");

-- CreateIndex
CREATE INDEX "expert_reviews_userId_idx" ON "expert_reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vertical_packs_slug_key" ON "vertical_packs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_pack_subscriptions_userId_packId_key" ON "user_pack_subscriptions"("userId", "packId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verifications_userId_idx" ON "email_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "webhook_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "data_requests_userId_idx" ON "data_requests"("userId");

-- CreateIndex
CREATE INDEX "user_provider_limits_userId_idx" ON "user_provider_limits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_provider_limits_userId_provider_key" ON "user_provider_limits"("userId", "provider");

-- CreateIndex
CREATE INDEX "build_versions_taskId_idx" ON "build_versions"("taskId");

-- CreateIndex
CREATE INDEX "build_versions_userId_idx" ON "build_versions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sabha_ai_training_records_taskId_key" ON "sabha_ai_training_records"("taskId");

-- CreateIndex
CREATE INDEX "sabha_ai_training_records_qualityScore_idx" ON "sabha_ai_training_records"("qualityScore");

-- CreateIndex
CREATE INDEX "sabha_ai_training_records_usedForTraining_idx" ON "sabha_ai_training_records"("usedForTraining");

-- CreateIndex
CREATE UNIQUE INDEX "upi_payments_razorpayOrderId_key" ON "upi_payments"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "upi_payments_userId_idx" ON "upi_payments"("userId");

-- CreateIndex
CREATE INDEX "upi_payments_razorpayOrderId_idx" ON "upi_payments"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "upi_payments_status_idx" ON "upi_payments"("status");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roundtable_templates" ADD CONSTRAINT "roundtable_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "roundtable_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_verticalPackId_fkey" FOREIGN KEY ("verticalPackId") REFERENCES "vertical_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask_outputs" ADD CONSTRAINT "subtask_outputs_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_analytics" ADD CONSTRAINT "template_analytics_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "roundtable_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_runs" ADD CONSTRAINT "sandbox_runs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sandbox_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_projects" ADD CONSTRAINT "code_projects_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_projects" ADD CONSTRAINT "code_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_stats" ADD CONSTRAINT "usage_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_env_vars" ADD CONSTRAINT "project_env_vars_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "code_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ai_connections" ADD CONSTRAINT "user_ai_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_routing_preferences" ADD CONSTRAINT "user_routing_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_clarifications" ADD CONSTRAINT "task_clarifications_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memory_facts" ADD CONSTRAINT "user_memory_facts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steering_messages" ADD CONSTRAINT "task_steering_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_scheduledTaskId_fkey" FOREIGN KEY ("scheduledTaskId") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roundtable_sessions" ADD CONSTRAINT "roundtable_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roundtable_participants" ADD CONSTRAINT "roundtable_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "roundtable_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roundtable_reactions" ADD CONSTRAINT "roundtable_reactions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "roundtable_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask_verifications" ADD CONSTRAINT "subtask_verifications_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_actions" ADD CONSTRAINT "execution_actions_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_actions" ADD CONSTRAINT "execution_actions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_actions" ADD CONSTRAINT "execution_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_actions" ADD CONSTRAINT "execution_actions_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "user_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "expert_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pack_subscriptions" ADD CONSTRAINT "user_pack_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_pack_subscriptions" ADD CONSTRAINT "user_pack_subscriptions_packId_fkey" FOREIGN KEY ("packId") REFERENCES "vertical_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
