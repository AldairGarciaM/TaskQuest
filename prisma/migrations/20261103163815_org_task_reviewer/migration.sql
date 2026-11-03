-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ORG_TASK_SUBMITTED';

-- AlterTable
ALTER TABLE "OrgTask" ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "requestedReviewerId" TEXT;

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_requestedReviewerId_fkey" FOREIGN KEY ("requestedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: tasks a manager assigned were assigned by whoever created them (the form is the only way to assign).
UPDATE "OrgTask" SET "assignedById" = "createdById" WHERE "assigneeId" IS NOT NULL AND "selfAssigned" = false;
