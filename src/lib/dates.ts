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

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** How far APP_TIME_ZONE's wall clock is from UTC at that instant, in ms. */
function zoneOffsetMs(date: Date): number {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, Number(p.value)]));
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant "YYYY-MM-DD" starts (00:00) in APP_TIME_ZONE. */
export function startOfDayInZone(key: string): Date {
  const utcMidnight = Date.parse(`${key}T00:00:00.000Z`);
  // Second pass corrects the guess when the offset changes that day.
  const guess = utcMidnight - zoneOffsetMs(new Date(utcMidnight));
  return new Date(utcMidnight - zoneOffsetMs(new Date(guess)));
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
