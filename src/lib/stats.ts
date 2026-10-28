import type { Difficulty } from "@/generated/prisma/enums";
import { addDays } from "@/lib/calendar";

export const STAT_RANGES = [7, 30, 90] as const;
export type StatRange = (typeof STAT_RANGES)[number];

export const XP_SOURCES = ["personal", "bonus", "team"] as const;
export type XpSource = (typeof XP_SOURCES)[number];

/** Something that earned XP, already placed on its day ("YYYY-MM-DD" in APP_TIME_ZONE). */
export interface XpEvent {
  day: string;
  xp: number;
  source: XpSource;
  /** Completed tasks only (daily mission bonuses aren't tasks). */
  difficulty?: Difficulty;
  /** null when the task had no due date. */
  onTime?: boolean | null;
}

export interface XpBucket {
  /** First day of the bucket. */
  from: string;
  /** Last day of the bucket (same as `from` for daily buckets). */
  to: string;
  xp: Record<XpSource, number>;
  total: number;
  tasks: number;
}

export interface StatsSummary {
  range: StatRange;
  from: string;
  to: string;
  xp: number;
  /** XP of the same number of days right before `from`. */
  previousXp: number;
  completed: number;
  /** Completed tasks that had a due date, and how many of them were done by then. */
  dated: number;
  onTime: number;
  buckets: XpBucket[];
  byDifficulty: Record<Difficulty, number>;
  /** Completed tasks per weekday, Monday first. */
  byWeekday: number[];
}

export function parseRangeParam(param: string | string[] | undefined): StatRange {
  const value = Number(typeof param === "string" ? param : NaN);
  return (STAT_RANGES as readonly number[]).includes(value) ? (value as StatRange) : 30;
}

/** Daily bars up to a month; weekly ones (ending today) for longer ranges. */
export function bucketDays(range: StatRange): number {
  return range > 30 ? 7 : 1;
}

function weekdayIndex(day: string): number {
  return (new Date(`${day}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

const emptyXp = (): Record<XpSource, number> => ({ personal: 0, bonus: 0, team: 0 });

/** Aggregates the events of the last `range` days ending on `today` (inclusive). */
export function summarize(events: XpEvent[], range: StatRange, today: string): StatsSummary {
  const from = addDays(today, -(range - 1));
  const previousFrom = addDays(from, -range);
  const size = bucketDays(range);

  const buckets: XpBucket[] = [];
  for (let start = from; start <= today; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    buckets.push({ from: start, to: end > today ? today : end, xp: emptyXp(), total: 0, tasks: 0 });
  }

  const summary: StatsSummary = {
    range,
    from,
    to: today,
    xp: 0,
    previousXp: 0,
    completed: 0,
    dated: 0,
    onTime: 0,
    buckets,
    byDifficulty: { EASY: 0, MEDIUM: 0, HARD: 0, EPIC: 0 },
    byWeekday: [0, 0, 0, 0, 0, 0, 0],
  };

  for (const event of events) {
    if (event.day >= previousFrom && event.day < from) summary.previousXp += event.xp;
    if (event.day < from || event.day > today) continue;

    summary.xp += event.xp;
    const bucket = buckets.find((b) => event.day >= b.from && event.day <= b.to)!;
    bucket.xp[event.source] += event.xp;
    bucket.total += event.xp;

    if (!event.difficulty) continue;
    bucket.tasks++;
    summary.completed++;
    summary.byDifficulty[event.difficulty]++;
    summary.byWeekday[weekdayIndex(event.day)]++;
    if (event.onTime !== null && event.onTime !== undefined) {
      summary.dated++;
      if (event.onTime) summary.onTime++;
    }
  }

  return summary;
}

/** Longest run of consecutive days with at least one completed task, ever. */
export function longestStreak(days: string[]): number {
  const unique = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of unique) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Percent change vs the previous period; null when there's nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
