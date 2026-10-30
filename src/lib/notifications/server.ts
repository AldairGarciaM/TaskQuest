import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { dueDateToInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** How many notifications each user keeps; older ones are dropped when a new one arrives. */
export const NOTIFICATIONS_KEPT = 50;
/** How many the bell lists. */
export const NOTIFICATIONS_SHOWN = 20;

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  taskTitle: string;
  xp: number;
  level: number | null;
  note: string | null;
  actorName: string | null;
  /** "YYYY-MM-DD": the new due date of a rescheduled task. */
  dueDate: string | null;
  read: boolean;
  createdAt: string;
  organization: { name: string; slug: string };
}

export interface NotificationFeed {
  items: NotificationDTO[];
  unreadCount: number;
}

interface ReviewNotice {
  type: NotificationType;
  userId: string;
  organizationId: string;
  taskTitle: string;
  actorName: string | null;
  xp?: number;
  level?: number | null;
  note?: string | null;
  dueDate?: Date | null;
}

/** Tells the assignee a manager reviewed or rescheduled their task. Runs inside that change's transaction. */
export async function notifyReview(tx: Prisma.TransactionClient, notice: ReviewNotice) {
  await tx.notification.create({
    data: {
      type: notice.type,
      userId: notice.userId,
      organizationId: notice.organizationId,
      taskTitle: notice.taskTitle,
      actorName: notice.actorName,
      xp: notice.xp ?? 0,
      level: notice.level ?? null,
      note: notice.note ?? null,
      dueDate: notice.dueDate ?? null,
    },
  });

  const stale = await tx.notification.findMany({
    where: { userId: notice.userId },
    orderBy: { createdAt: "desc" },
    skip: NOTIFICATIONS_KEPT,
    select: { id: true },
  });
  if (stale.length > 0) await tx.notification.deleteMany({ where: { id: { in: stale.map((n) => n.id) } } });
}

export async function getNotificationFeed(userId: string): Promise<NotificationFeed> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATIONS_SHOWN,
      select: {
        id: true,
        type: true,
        taskTitle: true,
        xp: true,
        level: true,
        note: true,
        actorName: true,
        dueDate: true,
        readAt: true,
        createdAt: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    unreadCount,
    items: rows.map(({ readAt, createdAt, dueDate, ...n }) => ({
      ...n,
      dueDate: dueDate && dueDateToInput(dueDate),
      read: readAt !== null,
      createdAt: createdAt.toISOString(),
    })),
  };
}
