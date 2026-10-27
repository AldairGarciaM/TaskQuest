-- CreateTable
CREATE TABLE "OrgTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "xpReward" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "selfAssigned" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "awardedXp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,

    CONSTRAINT "OrgTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgTask_organizationId_status_idx" ON "OrgTask"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrgTask_assigneeId_idx" ON "OrgTask"("assigneeId");

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
