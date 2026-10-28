import { describe, expect, it } from "vitest";

import { dayLabel, gridRange, monthGrid, monthLabel, monthParam, parseMonthParam, shiftMonth } from "@/lib/calendar";

describe("parseMonthParam", () => {
  const now = new Date("2026-10-28T18:00:00Z");

  it("reads a valid YYYY-MM", () => {
    expect(parseMonthParam("2027-02", now)).toEqual({ year: 2027, month: 2 });
  });

  it.each([undefined, "", "2026-13", "2026-1", "abc", "1999-05", ["2026-01"]])(
    "falls back to the current month for %j",
    (param) => {
      expect(parseMonthParam(param as string | undefined, now)).toEqual({ year: 2026, month: 10 });
    },
  );

  it("uses the app time zone for the current month", () => {
    // 1 Nov 03:00 UTC is still 31 Oct in Mexico City.
    expect(parseMonthParam(undefined, new Date("2026-11-01T03:00:00Z"))).toEqual({ year: 2026, month: 10 });
  });
});

describe("shiftMonth / monthParam", () => {
  it("crosses year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthParam({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("monthGrid", () => {
  it("covers October 2026 in whole weeks starting on Monday", () => {
    const grid = monthGrid({ year: 2026, month: 10 });
    expect(grid).toHaveLength(35);
    expect(grid[0]).toEqual({ key: "2026-09-28", day: 28, inMonth: false });
    expect(grid[3]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(grid.at(-1)).toEqual({ key: "2026-11-01", day: 1, inMonth: false });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("uses 4 rows when the month fits exactly and 6 when it needs them", () => {
    expect(monthGrid({ year: 2027, month: 2 })).toHaveLength(28); // starts on Monday, 28 days
    expect(monthGrid({ year: 2026, month: 8 })).toHaveLength(42); // starts on Saturday, 31 days
  });

  it("handles leap years", () => {
    expect(monthGrid({ year: 2028, month: 2 }).filter((d) => d.inMonth).at(-1)?.key).toBe("2028-02-29");
  });

  it("exposes the visible range", () => {
    expect(gridRange({ year: 2026, month: 10 })).toEqual({ from: "2026-09-28", to: "2026-11-01" });
  });
});

describe("labels", () => {
  it("formats in Spanish without shifting the day", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("octubre de 2026");
    expect(dayLabel("2026-10-28")).toBe("miércoles, 28 de octubre");
  });
});
