import { describe, expect, it } from "vitest";

import { currentStreak, dayKey, dueDateFromInput, dueDateToInput } from "@/lib/dates";

// 12:00 in Mexico City.
const NOW = new Date("2026-10-26T18:00:00Z");
const at = (iso: string) => new Date(iso);

describe("dayKey", () => {
  it("uses the app time zone, not UTC", () => {
    // 03:00 UTC on the 26th is still the 25th in Mexico City.
    expect(dayKey(at("2026-10-26T03:00:00Z"))).toBe("2026-10-25");
    expect(dayKey(at("2026-10-26T18:00:00Z"))).toBe("2026-10-26");
  });
});

describe("due dates", () => {
  it("round-trips a calendar date", () => {
    expect(dueDateToInput(dueDateFromInput("2026-11-02"))).toBe("2026-11-02");
  });

  it("stores the date at midnight UTC", () => {
    expect(dueDateFromInput("2026-11-02").toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
});

describe("currentStreak", () => {
  it("is 0 without completed tasks", () => {
    expect(currentStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days including today", () => {
    const dates = [at("2026-10-26T15:00:00Z"), at("2026-10-25T15:00:00Z"), at("2026-10-24T15:00:00Z")];
    expect(currentStreak(dates, NOW)).toBe(3);
  });

  it("keeps a streak that ended yesterday", () => {
    expect(currentStreak([at("2026-10-25T15:00:00Z"), at("2026-10-24T15:00:00Z")], NOW)).toBe(2);
  });

  it("resets when a day is missed", () => {
    expect(currentStreak([at("2026-10-23T15:00:00Z")], NOW)).toBe(0);
    expect(currentStreak([at("2026-10-26T15:00:00Z"), at("2026-10-24T15:00:00Z")], NOW)).toBe(1);
  });

  it("counts several tasks on the same day once", () => {
    expect(currentStreak([at("2026-10-26T15:00:00Z"), at("2026-10-26T16:00:00Z")], NOW)).toBe(1);
  });
});
