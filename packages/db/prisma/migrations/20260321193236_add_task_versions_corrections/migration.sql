-- CreateTable
CREATE TABLE "task_versions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "githubCommit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_corrections" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedCategories" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultVersionId" TEXT,
    "githubCommitUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "task_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_versions_taskId_idx" ON "task_versions"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_versions_taskId_versionNumber_key" ON "task_versions"("taskId", "versionNumber");

-- CreateIndex
CREATE INDEX "task_corrections_taskId_idx" ON "task_corrections"("taskId");

-- CreateIndex
CREATE INDEX "task_corrections_userId_idx" ON "task_corrections"("userId");

-- AddForeignKey
ALTER TABLE "task_versions" ADD CONSTRAINT "task_versions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_corrections" ADD CONSTRAINT "task_corrections_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_corrections" ADD CONSTRAINT "task_corrections_resultVersionId_fkey" FOREIGN KEY ("resultVersionId") REFERENCES "task_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
