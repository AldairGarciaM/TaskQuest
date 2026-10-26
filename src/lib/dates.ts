// Streaks and "today" are computed in this time zone so they don't depend on the server's locale.
export const APP_TIME_ZONE = "America/Mexico_City";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" of the given instant in APP_TIME_ZONE. */
export function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** Due dates are calendar dates stored at 00:00 UTC. */
export function dueDateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dueDateToInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousDayKey(key: string): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive days with at least one completed task, ending today
 * (or yesterday, so the streak isn't lost before today's first task).
 */
export function currentStreak(completedAt: Date[], now = new Date()): number {
  const days = new Set(completedAt.map(dayKey));
  const today = dayKey(now);

  let cursor = days.has(today) ? today : previousDayKey(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDayKey(cursor);
  }
  return streak;
}
