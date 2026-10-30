-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ORG_TASK_RESCHEDULED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dueDate" TIMESTAMP(3);
