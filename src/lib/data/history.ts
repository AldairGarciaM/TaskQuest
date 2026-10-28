import type { DailyMissionType, Difficulty } from "@/generated/prisma/enums";
import { dayKey, dueDateToInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const HISTORY_FILTERS = ["all", "missions", "team", "achievements"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export const HISTORY_PAGE_SIZE = 30;

interface Base {
  id: string;
  /** ISO instant it happened. */
  at: string;
}

export type HistoryItem =
  | (Base & {
      kind: "personal";
      title: string;
      difficulty: Difficulty;
      xp: number;
      /** null when it had no due date. */
      onTime: boolean | null;
    })
  | (Base & {
      kind: "team";
      title: string;
      difficulty: Difficulty;
      xp: number;
      organization: { name: string; slug: string };
      /** Who approved it; null when I completed my own task as owner/admin (or the reviewer left). */
      approvedBy: string | null;
    })
  | (Base & { kind: "bonus"; mission: DailyMissionType; xp: number })
  | (Base & { kind: "achievement"; key: string });

export interface HistoryPage {
  items: HistoryItem[];
  /** Pass as `before` to get the next (older) page; null when there's nothing older. */
  nextCursor: string | null;
}

export function parseHistoryFilter(param: string | string[] | undefined): HistoryFilter {
  return (HISTORY_FILTERS as readonly string[]).includes(param as string) ? (param as HistoryFilter) : "all";
}

/** An ISO instant from `?antes=`, or null when it's missing or invalid. */
export function parseCursor(param: string | string[] | undefined): Date | null {
  if (typeof param !== "string") return null;
  const date = new Date(param);
  return Number.isNaN(date.getTime()) ? null : date;
}

function onTime(completedAt: Date, dueDate: Date | null): boolean | null {
  return dueDate ? dayKey(completedAt) <= dueDateToInput(dueDate) : null;
}

/**
 * What the user has achieved, newest first: completed missions, team tasks they completed,
 * daily mission bonuses and unlocked achievements. Only what still stands (an un-completed task
 * or a bonus taken back leaves the history, just like its XP).
 */
export async function getHistory(
  userId: string,
  { filter = "all", before = null, limit = HISTORY_PAGE_SIZE }: { filter?: HistoryFilter; before?: Date | null; limit?: number } = {},
): Promise<HistoryPage> {
  const take = limit + 1;
  const lt = before ?? undefined;
  const wants = (...filters: HistoryFilter[]) => filter === "all" || filters.includes(filter);

  const [tasks, orgTasks, missions, achievements] = await Promise.all([
    wants("missions")
      ? prisma.task.findMany({
          where: { userId, status: "COMPLETED", completedAt: { not: null, lt } },
          orderBy: { completedAt: "desc" },
          take,
          select: { id: true, title: true, difficulty: true, xpReward: true, completedAt: true, dueDate: true },
        })
      : [],
    wants("team")
      ? prisma.orgTask.findMany({
          where: { completedById: userId, status: "COMPLETED", completedAt: { not: null, lt } },
          orderBy: { completedAt: "desc" },
          take,
          select: {
            id: true,
            title: true,
            difficulty: true,
            awardedXp: true,
            completedAt: true,
            reviewedById: true,
            reviewedBy: { select: { firstName: true, lastName: true } },
            organization: { select: { name: true, slug: true } },
          },
        })
      : [],
    wants("missions")
      ? prisma.dailyMission.findMany({
          where: { userId, rewardedAt: { not: null, lt } },
          orderBy: { rewardedAt: "desc" },
          take,
          select: { id: true, type: true, xpReward: true, rewardedAt: true },
        })
      : [],
    wants("achievements")
      ? prisma.userAchievement.findMany({
          where: { userId, unlockedAt: { lt } },
          orderBy: { unlockedAt: "desc" },
          take,
          select: { id: true, key: true, unlockedAt: true },
        })
      : [],
  ]);

  const merged: HistoryItem[] = [
    ...tasks.map((t) => ({
      kind: "personal" as const,
      id: t.id,
      at: t.completedAt!.toISOString(),
      title: t.title,
      difficulty: t.difficulty,
      xp: t.xpReward,
      onTime: onTime(t.completedAt!, t.dueDate),
    })),
    ...orgTasks.map((t) => ({
      kind: "team" as const,
      id: t.id,
      at: t.completedAt!.toISOString(),
      title: t.title,
      difficulty: t.difficulty,
      xp: t.awardedXp,
      organization: t.organization,
      approvedBy:
        t.reviewedBy && t.reviewedById !== userId ? `${t.reviewedBy.firstName} ${t.reviewedBy.lastName}` : null,
    })),
    ...missions.map((m) => ({
      kind: "bonus" as const,
      id: m.id,
      at: m.rewardedAt!.toISOString(),
      mission: m.type,
      xp: m.xpReward,
    })),
    ...achievements.map((a) => ({ kind: "achievement" as const, id: a.id, at: a.unlockedAt.toISOString(), key: a.key })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // A mission and the daily bonus it triggers share the same instant; never split such a tie
  // across pages, since the next page starts strictly before the cursor.
  let end = Math.min(limit, merged.length);
  while (end < merged.length && merged[end].at === merged[end - 1].at) end++;
  const items = merged.slice(0, end);
  return { items, nextCursor: merged.length > end ? items[items.length - 1].at : null };
}
