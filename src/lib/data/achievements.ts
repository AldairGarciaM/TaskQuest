import { currentStreak, dayKey } from "@/lib/dates";
import { ACHIEVEMENTS, type AchievementDefinition } from "@/lib/gamification/achievements";
import { prisma } from "@/lib/prisma";

export interface AchievementView extends Pick<AchievementDefinition, "key" | "title" | "description" | "icon"> {
  unlockedAt: string | null;
  current: number;
  target: number;
}

export async function getAchievements(userId: string): Promise<AchievementView[]> {
  const [user, unlocked, completedCount, epicCompletedCount, completedDates, todayMissions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } }),
    prisma.userAchievement.findMany({ where: { userId }, select: { key: true, unlockedAt: true } }),
    prisma.task.count({ where: { userId, status: "COMPLETED" } }),
    prisma.task.count({ where: { userId, status: "COMPLETED", difficulty: "EPIC" } }),
    prisma.task.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.dailyMission.findMany({ where: { userId, day: dayKey(new Date()) }, select: { rewardedAt: true } }),
  ]);

  const unlockedAt = new Map(unlocked.map((a) => [a.key, a.unlockedAt.toISOString()]));
  const stats = {
    completedCount,
    epicCompletedCount,
    streak: currentStreak(completedDates.map((t) => t.completedAt!)),
    level: user.level,
    completedAllDailyMissions: todayMissions.length > 0 && todayMissions.every((m) => m.rewardedAt !== null),
  };

  return ACHIEVEMENTS.map(({ key, title, description, icon, progress }) => {
    const { current, target } = progress(stats);
    const date = unlockedAt.get(key) ?? null;
    // Unlocked achievements stay complete even if a task was later marked as pending.
    return { key, title, description, icon, unlockedAt: date, current: date ? target : current, target };
  });
}
