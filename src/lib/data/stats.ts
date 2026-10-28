import { addDays } from "@/lib/calendar";
import { currentStreak, dayKey, dueDateToInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { longestStreak, summarize, type StatRange, type StatsSummary, type XpEvent } from "@/lib/stats";

export interface StatsPage extends StatsSummary {
  currentStreak: number;
  bestStreak: number;
  totalXp: number;
  level: number;
}

/** "Done by its due date": completed on or before that calendar day, in APP_TIME_ZONE. */
function onTime(completedAt: Date, dueDate: Date | null): boolean | null {
  return dueDate ? dayKey(completedAt) <= dueDateToInput(dueDate) : null;
}

export async function getStats(userId: string, range: StatRange, today: string): Promise<StatsPage> {
  // Twice the range, for the comparison with the previous period; one extra day absorbs the
  // time zone (rows are filtered by their local day afterwards).
  const since = new Date(`${addDays(today, -(range * 2))}T00:00:00.000Z`);
  const firstDay = addDays(today, -(range * 2 - 1));

  const [user, tasks, orgTasks, missions, allCompleted] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, level: true } }),
    prisma.task.findMany({
      where: { userId, status: "COMPLETED", completedAt: { gte: since } },
      select: { xpReward: true, difficulty: true, completedAt: true, dueDate: true },
    }),
    prisma.orgTask.findMany({
      where: { completedById: userId, status: "COMPLETED", completedAt: { gte: since } },
      select: { awardedXp: true, difficulty: true, completedAt: true, dueDate: true },
    }),
    prisma.dailyMission.findMany({
      where: { userId, rewardedAt: { not: null }, day: { gte: firstDay } },
      select: { day: true, xpReward: true },
    }),
    prisma.task.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      select: { completedAt: true },
    }),
  ]);

  const events: XpEvent[] = [
    ...tasks.map((t) => ({
      day: dayKey(t.completedAt!),
      xp: t.xpReward,
      source: "personal" as const,
      difficulty: t.difficulty,
      onTime: onTime(t.completedAt!, t.dueDate),
    })),
    ...orgTasks.map((t) => ({
      day: dayKey(t.completedAt!),
      xp: t.awardedXp,
      source: "team" as const,
      difficulty: t.difficulty,
      onTime: onTime(t.completedAt!, t.dueDate),
    })),
    ...missions.map((m) => ({ day: m.day, xp: m.xpReward, source: "bonus" as const })),
  ];

  const completedAt = allCompleted.map((t) => t.completedAt!);
  return {
    ...summarize(events, range, today),
    // Streaks follow the dashboard's rule: personal missions only.
    currentStreak: currentStreak(completedAt),
    bestStreak: longestStreak(completedAt.map(dayKey)),
    totalXp: user.xp,
    level: user.level,
  };
}
