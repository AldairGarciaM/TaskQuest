import { dayKey } from "@/lib/dates";

/** A calendar month, 1-based like the "YYYY-MM" in the URL. */
export interface YearMonth {
  year: number;
  month: number;
}

export interface CalendarDay {
  /** "YYYY-MM-DD", same shape as TaskDTO.dueDate. */
  key: string;
  day: number;
  inMonth: boolean;
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** The month in `?mes=YYYY-MM`, or the current one when it's missing or malformed. */
export function parseMonthParam(param: string | string[] | undefined, now = new Date()): YearMonth {
  const match = typeof param === "string" ? MONTH_PARAM.exec(param) : null;
  if (match) {
    const year = Number(match[1]);
    if (year >= 2000 && year <= 2100) return { year, month: Number(match[2]) };
  }
  const [year, month] = dayKey(now).split("-").map(Number);
  return { year, month };
}

export function monthParam({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function utcKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole weeks (Monday first) that cover the month: 4 to 6 rows of 7 days. */
export function monthGrid({ year, month }: YearMonth): CalendarDay[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7;
  const total = Math.ceil((leading + daysInMonth) / 7) * 7;

  return Array.from({ length: total }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1, 1 - leading + i));
    return { key: utcKey(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month - 1 };
  });
}

/** First and last day keys shown by monthGrid, inclusive. */
export function gridRange(ym: YearMonth): { from: string; to: string } {
  const grid = monthGrid(ym);
  return { from: grid[0].key, to: grid[grid.length - 1].key };
}

const monthFormatter = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
const longDayFormatter = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "octubre de 2026" */
export function monthLabel({ year, month }: YearMonth): string {
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "miércoles, 28 de octubre" */
export function dayLabel(key: string): string {
  return longDayFormatter.format(new Date(`${key}T00:00:00.000Z`));
}
