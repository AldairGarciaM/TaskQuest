"use server";

import { getNotificationFeed, type NotificationFeed } from "@/lib/notifications/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** The navbar bell polls this when its live stream (/api/notifications/stream) isn't available. */
export async function fetchNotifications(): Promise<NotificationFeed> {
  const user = await requireUser();
  return getNotificationFeed(user.id);
}

/** Marks every unread notification of the signed-in user as read (opening the bell). */
export async function markNotificationsRead(): Promise<{ ok: true }> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
