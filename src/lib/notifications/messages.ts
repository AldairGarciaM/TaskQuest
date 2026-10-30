import type { NotificationType } from "@/generated/prisma/enums";
import { dayLabel } from "@/lib/calendar";

interface NotificationContent {
  type: NotificationType;
  taskTitle: string;
  xp: number;
  level: number | null;
  note: string | null;
  actorName: string | null;
  dueDate?: string | null;
}

/** The headline and body shown in the bell and in the toast. */
export function notificationText(n: NotificationContent): { title: string; description: string } {
  const reviewer = n.actorName ?? "Un admin";

  if (n.type === "ORG_TASK_APPROVED") {
    const levelUp = n.level ? ` ¡Subiste a nivel ${n.level}!` : "";
    return {
      title: `¡Tarea aprobada! +${n.xp} XP`,
      description: `${reviewer} aprobó “${n.taskTitle}” y obtuviste ${n.xp} XP.${levelUp}`,
    };
  }

  if (n.type === "ORG_TASK_RESCHEDULED") {
    return {
      title: "Cambió la fecha de una tarea",
      description: n.dueDate
        ? `${reviewer} movió “${n.taskTitle}” al ${dayLabel(n.dueDate)}.`
        : `${reviewer} cambió la fecha de “${n.taskTitle}”.`,
    };
  }

  return {
    title: "Te pidieron cambios",
    description: n.note
      ? `${reviewer} revisó “${n.taskTitle}”: ${n.note}`
      : `${reviewer} devolvió “${n.taskTitle}” para que la ajustes.`,
  };
}

/** "hace 5 min", "hace 3 h", "hace 2 d" — short enough for the bell list. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}
