import type { Difficulty, TaskStatus } from "@/generated/prisma/enums";
import { currentStreak, dueDateToInput } from "@/lib/dates";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements";
import { getDailyMissions } from "@/lib/gamification/server";
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

/** The user's personal missions, soonest due first; undated ones last, newest first. */
export async function getPersonalTasks(userId: string): Promise<TaskDTO[]> {
  const tasks = await prisma.task.findMany({
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
  });

  return tasks.map((task) => ({
    ...task,
    dueDate: task.dueDate ? dueDateToInput(task.dueDate) : null,
    completedAt: task.completedAt?.toISOString() ?? null,
  }));
}

export async function getDashboardData(userId: string) {
  const [user, tasks, completedDates, dailyMissions, achievementsCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true },
    }),
    getPersonalTasks(userId),
    prisma.task.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      select: { completedAt: true },
    }),
    getDailyMissions(prisma, userId),
    prisma.userAchievement.count({ where: { userId } }),
  ]);

  return {
    xp: user.xp,
    tasks,
    completedCount: completedDates.length,
    pendingCount: tasks.length - completedDates.length,
    streak: currentStreak(completedDates.map((t) => t.completedAt!)),
    dailyMissions,
    achievements: { unlocked: achievementsCount, total: ACHIEVEMENTS.length },
  };
}
