import type { DailyMissionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { currentStreak, dayKey, dueDateToInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

import { newlyUnlocked } from "./achievements";
import { DAILY_CATALOG, dailyProgress, pickDailyTypes, type CompletionToday } from "./daily";

type Db = Prisma.TransactionClient | typeof prisma;

/** Creates the day's missions for the user unless that day already has some. */
export async function ensureDailyMissions(db: Db, userId: string, day: string) {
  const existing = await db.dailyMission.findMany({ where: { userId, day }, orderBy: { createdAt: "asc" } });
  if (existing.length > 0) return existing;

  await db.dailyMission.createMany({
    data: pickDailyTypes(userId, day).map((type) => ({
      userId,
      day,
      type,
      target: DAILY_CATALOG[type].target,
      xpReward: DAILY_CATALOG[type].xpReward,
    })),
    skipDuplicates: true,
  });
  return db.dailyMission.findMany({ where: { userId, day }, orderBy: { createdAt: "asc" } });
}

async function completionsOn(db: Db, userId: string, day: string, now: Date): Promise<CompletionToday[]> {
  // Any completion on `day` happened within the last 48 hours; filter exactly by day key.
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const tasks = await db.task.findMany({
    where: { userId, status: "COMPLETED", completedAt: { gte: since } },
    select: { difficulty: true, dueDate: true, completedAt: true },
  });
  return tasks
    .map((task) => ({
      difficulty: task.difficulty,
      dueDate: task.dueDate ? dueDateToInput(task.dueDate) : null,
      completedDay: dayKey(task.completedAt!),
    }))
    .filter((completion) => completion.completedDay === day);
}

export interface DailyMissionView {
  type: DailyMissionType;
  title: string;
  description: string;
  target: number;
  progress: number;
  xpReward: number;
  rewarded: boolean;
}

export async function getDailyMissions(db: Db, userId: string, now = new Date()): Promise<DailyMissionView[]> {
  const day = dayKey(now);
  const [missions, completions] = await Promise.all([
    ensureDailyMissions(db, userId, day),
    completionsOn(db, userId, day, now),
  ]);
  return missions.map((mission) => {
    const definition = DAILY_CATALOG[mission.type];
    return {
      type: mission.type,
      title: definition.title,
      description: definition.description(mission.target),
      target: mission.target,
      progress: Math.min(dailyProgress(mission.type, completions), mission.target),
      xpReward: mission.xpReward,
      rewarded: mission.rewardedAt !== null,
    };
  });
}

export interface DailySyncResult {
  /** Net XP change: rewards granted minus rewards taken back. */
  xpDelta: number;
  rewarded: { title: string; xpReward: number }[];
}

/**
 * Grants today's missions that reached their target and takes back the ones that
 * dropped below it (e.g. a task was marked as pending again), so XP can't be farmed.
 * Conditional updates make each reward apply at most once.
 */
export async function syncDailyMissions(db: Db, userId: string, now = new Date()): Promise<DailySyncResult> {
  const day = dayKey(now);
  const [missions, completions] = await Promise.all([
    ensureDailyMissions(db, userId, day),
    completionsOn(db, userId, day, now),
  ]);

  const result: DailySyncResult = { xpDelta: 0, rewarded: [] };
  for (const mission of missions) {
    const reached = dailyProgress(mission.type, completions) >= mission.target;

    if (reached && !mission.rewardedAt) {
      const { count } = await db.dailyMission.updateMany({
        where: { id: mission.id, rewardedAt: null },
        data: { rewardedAt: now },
      });
      if (count === 1) {
        result.xpDelta += mission.xpReward;
        result.rewarded.push({ title: DAILY_CATALOG[mission.type].title, xpReward: mission.xpReward });
      }
    } else if (!reached && mission.rewardedAt) {
      const { count } = await db.dailyMission.updateMany({
        where: { id: mission.id, rewardedAt: { not: null } },
        data: { rewardedAt: null },
      });
      if (count === 1) result.xpDelta -= mission.xpReward;
    }
  }
  return result;
}

/** Unlocks every achievement whose requirement is now met. Achievements are never taken back. */
export async function unlockAchievements(db: Db, userId: string, level: number, now = new Date()) {
  const day = dayKey(now);
  const [unlocked, completedCount, epicCompletedCount, completedDates, todayMissions] = await Promise.all([
    db.userAchievement.findMany({ where: { userId }, select: { key: true } }),
    db.task.count({ where: { userId, status: "COMPLETED" } }),
    db.task.count({ where: { userId, status: "COMPLETED", difficulty: "EPIC" } }),
    db.task.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null } },
      select: { completedAt: true },
    }),
    db.dailyMission.findMany({ where: { userId, day }, select: { rewardedAt: true } }),
  ]);

  const keys = newlyUnlocked(
    {
      completedCount,
      epicCompletedCount,
      streak: currentStreak(completedDates.map((t) => t.completedAt!), now),
      level,
      completedAllDailyMissions:
        todayMissions.length > 0 && todayMissions.every((mission) => mission.rewardedAt !== null),
    },
    new Set(unlocked.map((a) => a.key)),
  );

  if (keys.length > 0) {
    await db.userAchievement.createMany({
      data: keys.map((key) => ({ userId, key, unlockedAt: now })),
      skipDuplicates: true,
    });
  }
  return keys;
}
