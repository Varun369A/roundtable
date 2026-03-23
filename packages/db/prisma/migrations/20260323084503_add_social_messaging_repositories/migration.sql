-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE', 'ROUNDTABLE_SHARE', 'REPO_SHARE', 'GROUP_COLLAB_INVITE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "GroupCollabStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'ENDED');

-- CreateEnum
CREATE TYPE "RepoCategory" AS ENUM ('CODE', 'CONTENT', 'DESIGN', 'STRATEGY', 'RESEARCH', 'MIXED');

-- CreateEnum
CREATE TYPE "RepoVisibility" AS ENUM ('PRIVATE', 'FRIENDS', 'COLLABORATORS');

-- CreateEnum
CREATE TYPE "RepoPermission" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('ILLEGAL_CONTENT', 'HARASSMENT', 'SPAM', 'FRAUD', 'HATE_SPEECH', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPO_ACCESS_GRANTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPO_ACCESS_REVOKED';
ALTER TYPE "NotificationType" ADD VALUE 'PRIORITY_REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_WARNING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "terms_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_terms_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,

    CONSTRAINT "user_terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_social_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "bio" VARCHAR(300),
    "avatarUrl" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "location" VARCHAR(100),
    "website" VARCHAR(200),
    "friendsCount" INTEGER NOT NULL DEFAULT 0,
    "reposCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_requests" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "name" VARCHAR(100),
    "avatarUrl" TEXT,
    "description" VARCHAR(300),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "fileUrl" TEXT,
    "fileMeta" JSONB,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reads" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_message_access" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_message_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_collaborations" (
    "id" TEXT NOT NULL,
    "initiatorGroupId" TEXT NOT NULL,
    "targetGroupId" TEXT NOT NULL,
    "status" "GroupCollabStatus" NOT NULL DEFAULT 'PENDING',
    "sharedRepoId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_collaborations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabha_repos" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "category" "RepoCategory" NOT NULL,
    "visibility" "RepoVisibility" NOT NULL DEFAULT 'PRIVATE',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sabha_repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_collaborators" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "RepoPermission" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "repo_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_items" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" "RepoCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "metadata" JSONB,
    "sourceTaskId" TEXT,
    "sourceSubtaskId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_commits" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "itemsAdded" INTEGER NOT NULL DEFAULT 0,
    "itemsModified" INTEGER NOT NULL DEFAULT 0,
    "itemsRemoved" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_stars" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_stars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "contentId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetType" VARCHAR(50) NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_version_key" ON "terms_versions"("version");

-- CreateIndex
CREATE INDEX "user_terms_acceptances_userId_idx" ON "user_terms_acceptances"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_terms_acceptances_userId_termsVersionId_key" ON "user_terms_acceptances"("userId", "termsVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_social_profiles_userId_key" ON "user_social_profiles"("userId");

-- CreateIndex
CREATE INDEX "friend_requests_receiverId_status_idx" ON "friend_requests"("receiverId", "status");

-- CreateIndex
CREATE INDEX "friend_requests_senderId_status_idx" ON "friend_requests"("senderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friend_requests_senderId_receiverId_key" ON "friend_requests"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "friendships_userAId_idx" ON "friendships"("userAId");

-- CreateIndex
CREATE INDEX "friendships_userBId_idx" ON "friendships"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_userAId_userBId_key" ON "friendships"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "user_blocks_blockerId_idx" ON "user_blocks"("blockerId");

-- CreateIndex
CREATE INDEX "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "conversation_members_userId_idx" ON "conversation_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_members_conversationId_userId_key" ON "conversation_members"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_messageId_userId_key" ON "message_reads"("messageId", "userId");

-- CreateIndex
CREATE INDEX "admin_message_access_conversationId_idx" ON "admin_message_access"("conversationId");

-- CreateIndex
CREATE INDEX "admin_message_access_adminId_idx" ON "admin_message_access"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "group_collaborations_initiatorGroupId_targetGroupId_key" ON "group_collaborations"("initiatorGroupId", "targetGroupId");

-- CreateIndex
CREATE INDEX "sabha_repos_ownerId_idx" ON "sabha_repos"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "sabha_repos_ownerId_slug_key" ON "sabha_repos"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "repo_collaborators_userId_idx" ON "repo_collaborators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "repo_collaborators_repoId_userId_key" ON "repo_collaborators"("repoId", "userId");

-- CreateIndex
CREATE INDEX "repo_items_repoId_idx" ON "repo_items"("repoId");

-- CreateIndex
CREATE INDEX "repo_items_authorId_idx" ON "repo_items"("authorId");

-- CreateIndex
CREATE INDEX "repo_commits_repoId_idx" ON "repo_commits"("repoId");

-- CreateIndex
CREATE UNIQUE INDEX "repo_stars_repoId_userId_key" ON "repo_stars"("repoId", "userId");

-- CreateIndex
CREATE INDEX "user_reports_status_idx" ON "user_reports"("status");

-- CreateIndex
CREATE INDEX "user_reports_reportedId_idx" ON "user_reports"("reportedId");

-- CreateIndex
CREATE INDEX "admin_actions_adminId_idx" ON "admin_actions"("adminId");

-- CreateIndex
CREATE INDEX "admin_actions_targetId_idx" ON "admin_actions"("targetId");

-- AddForeignKey
ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_collaborators" ADD CONSTRAINT "repo_collaborators_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "sabha_repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_items" ADD CONSTRAINT "repo_items_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "sabha_repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_commits" ADD CONSTRAINT "repo_commits_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "sabha_repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_stars" ADD CONSTRAINT "repo_stars_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "sabha_repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
