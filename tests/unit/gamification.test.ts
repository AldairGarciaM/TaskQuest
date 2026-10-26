import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, newlyUnlocked, type AchievementStats } from "@/lib/gamification/achievements";
import {
  DAILY_CATALOG,
  DAILY_MISSIONS_PER_DAY,
  dailyProgress,
  pickDailyTypes,
  type CompletionToday,
} from "@/lib/gamification/daily";

const done = (difficulty: CompletionToday["difficulty"], dueDate: string | null = null): CompletionToday => ({
  difficulty,
  dueDate,
  completedDay: "2026-10-26",
});

describe("pickDailyTypes", () => {
  it("picks distinct missions from the catalog", () => {
    const types = pickDailyTypes("user-1", "2026-10-26");
    expect(types).toHaveLength(DAILY_MISSIONS_PER_DAY);
    expect(new Set(types).size).toBe(types.length);
    for (const type of types) expect(DAILY_CATALOG).toHaveProperty(type);
  });

  it("is stable for the same user and day", () => {
    expect(pickDailyTypes("user-1", "2026-10-26")).toEqual(pickDailyTypes("user-1", "2026-10-26"));
  });

  it("varies across days", () => {
    const combos = new Set(
      Array.from({ length: 30 }, (_, i) => pickDailyTypes("user-1", `2026-11-${String(i + 1).padStart(2, "0")}`).join()),
    );
    expect(combos.size).toBeGreaterThan(1);
  });
});

describe("dailyProgress", () => {
  const completions = [done("EASY"), done("HARD", "2026-10-26"), done("EPIC", "2026-10-20"), done("EASY", "2026-10-30")];

  it("counts completed tasks", () => {
    expect(dailyProgress("COMPLETE_TASKS", completions)).toBe(4);
  });

  it("counts hard and epic tasks", () => {
    expect(dailyProgress("COMPLETE_HARD", completions)).toBe(2);
  });

  it("counts tasks finished on or before their due date", () => {
    // The EPIC task was due on the 20th, so it's late.
    expect(dailyProgress("COMPLETE_ON_TIME", completions)).toBe(2);
  });

  it("counts distinct difficulties", () => {
    expect(dailyProgress("COMPLETE_VARIETY", completions)).toBe(3);
  });

  it("is 0 with nothing completed", () => {
    for (const type of Object.keys(DAILY_CATALOG) as (keyof typeof DAILY_CATALOG)[]) {
      expect(dailyProgress(type, [])).toBe(0);
    }
  });
});

describe("newlyUnlocked", () => {
  const base: AchievementStats = {
    completedCount: 0,
    epicCompletedCount: 0,
    streak: 0,
    level: 1,
    completedAllDailyMissions: false,
  };

  it("unlocks nothing for a new user", () => {
    expect(newlyUnlocked(base, new Set())).toEqual([]);
  });

  it("unlocks every achievement whose target is met", () => {
    const keys = newlyUnlocked({ ...base, completedCount: 10, epicCompletedCount: 1, streak: 3, level: 5 }, new Set());
    expect(keys).toEqual(["first-quest", "quests-10", "first-epic", "streak-3", "level-5"]);
  });

  it("skips achievements the user already has", () => {
    expect(newlyUnlocked({ ...base, completedCount: 1 }, new Set(["first-quest"]))).toEqual([]);
  });

  it("unlocks the daily sweep", () => {
    expect(newlyUnlocked({ ...base, completedAllDailyMissions: true }, new Set())).toEqual(["daily-sweep"]);
  });

  it("has unique keys", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.key)).size).toBe(ACHIEVEMENTS.length);
  });
});
