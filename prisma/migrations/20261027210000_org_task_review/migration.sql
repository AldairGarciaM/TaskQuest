-- CreateEnum
CREATE TYPE "OrgTaskStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'COMPLETED');

-- AlterTable: convert the status in place (the generated drop/re-add would reset every task to PENDING).
ALTER TABLE "OrgTask" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OrgTask" ALTER COLUMN "status" TYPE "OrgTaskStatus" USING ("status"::text::"OrgTaskStatus");
ALTER TABLE "OrgTask" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "OrgTask" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "OrgTask" ADD CONSTRAINT "OrgTask_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
