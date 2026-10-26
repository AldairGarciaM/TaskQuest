import type { Difficulty, TaskStatus } from "@/generated/prisma/enums";
import { currentStreak, dueDateToInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Serializable task shape passed from Server Components to the client. */
export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  xpReward: number;
  status: TaskStatus;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  completedAt: string | null;
}

export async function getDashboardData(userId: string) {
  const [user, tasks, completedDates] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true },
    }),
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        xpReward: true,
        status: true,
        dueDate: true,
        completedAt: true,
      },
    }),
    prisma.task.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      select: { completedAt: true },
    }),
  ]);

  const taskDtos: TaskDTO[] = tasks.map((task) => ({
    ...task,
    dueDate: task.dueDate ? dueDateToInput(task.dueDate) : null,
    completedAt: task.completedAt?.toISOString() ?? null,
  }));

  return {
    xp: user.xp,
    tasks: taskDtos,
    completedCount: completedDates.length,
    pendingCount: tasks.length - completedDates.length,
    streak: currentStreak(completedDates.map((t) => t.completedAt!)),
  };
}
