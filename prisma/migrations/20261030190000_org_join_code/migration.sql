-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "joinCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_joinCode_key" ON "Organization"("joinCode");
