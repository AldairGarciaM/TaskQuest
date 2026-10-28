import { describe, expect, it } from "vitest";

import { compact, niceMax } from "@/components/stats/chart-utils";
import { bucketDays, longestStreak, parseRangeParam, percentChange, summarize, type XpEvent } from "@/lib/stats";

const TODAY = "2026-10-28";

describe("parseRangeParam", () => {
  it.each([
    ["7", 7],
    ["90", 90],
    ["15", 30],
    [undefined, 30],
    [["7"], 30],
  ])("%j → %d", (param, expected) => {
    expect(parseRangeParam(param as string | undefined)).toBe(expected);
  });
});

describe("summarize", () => {
  const events: XpEvent[] = [
    { day: "2026-10-28", xp: 50, source: "personal", difficulty: "HARD", onTime: true },
    { day: "2026-10-28", xp: 30, source: "bonus" },
    { day: "2026-10-26", xp: 25, source: "team", difficulty: "MEDIUM", onTime: false },
    { day: "2026-10-22", xp: 10, source: "personal", difficulty: "EASY", onTime: null },
    // Previous 7-day period.
    { day: "2026-10-21", xp: 40, source: "personal", difficulty: "EASY", onTime: null },
    { day: "2026-10-15", xp: 5, source: "personal", difficulty: "EASY", onTime: null },
    // Too old even for the comparison.
    { day: "2026-10-14", xp: 999, source: "personal", difficulty: "EPIC", onTime: true },
  ];

  it("adds up the last 7 days by day and source", () => {
    const s = summarize(events, 7, TODAY);
    expect(s).toMatchObject({ from: "2026-10-22", to: TODAY, xp: 115, previousXp: 45, completed: 3, dated: 2, onTime: 1 });
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets.at(-1)).toEqual({
      from: TODAY,
      to: TODAY,
      xp: { personal: 50, bonus: 30, team: 0 },
      total: 80,
      tasks: 1,
    });
    expect(s.byDifficulty).toEqual({ EASY: 1, MEDIUM: 1, HARD: 1, EPIC: 0 });
    // 22 Oct 2026 is a Thursday, 26 a Monday, 28 a Wednesday.
    expect(s.byWeekday).toEqual([1, 0, 1, 1, 0, 0, 0]);
  });

  it("uses weekly buckets ending today for 90 days", () => {
    const s = summarize(events, 90, TODAY);
    expect(bucketDays(90)).toBe(7);
    expect(s.buckets).toHaveLength(13);
    expect(s.buckets[0].from).toBe("2026-07-31");
    expect(s.buckets.at(-1)).toMatchObject({ from: "2026-10-23", to: TODAY });
    expect(s.buckets.reduce((n, b) => n + b.total, 0)).toBe(s.xp);
  });
});

describe("longestStreak", () => {
  it("finds the longest run of consecutive days", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2026-10-01", "2026-10-01"])).toBe(1);
    expect(longestStreak(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-05", "2026-11-06"])).toBe(3);
  });
});

describe("percentChange / chart utils", () => {
  it("compares with the previous period", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(50, 0)).toBeNull();
  });

  it("rounds axis maxima to clean numbers", () => {
    expect([0, 7, 10, 11, 180, 260, 900].map(niceMax)).toEqual([10, 10, 10, 20, 200, 500, 1000]);
    expect(compact(1284)).toMatch(/^1[.,]3\s?k/i);
  });
});
