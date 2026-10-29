import { prisma } from "@/lib/prisma";

export interface RateLimitRule {
  /** Hits allowed per window. */
  limit: number;
  windowMs: number;
}

const MINUTE = 60_000;

/** Failed logins per account (email or username), whether or not the account exists. */
export const LOGIN_ACCOUNT_LIMIT: RateLimitRule = { limit: 5, windowMs: 15 * MINUTE };
/** Login attempts per IP, failed or not: stops one client from cycling through accounts. */
export const LOGIN_IP_LIMIT: RateLimitRule = { limit: 30, windowMs: 15 * MINUTE };
/** New accounts per IP. */
export const REGISTER_IP_LIMIT: RateLimitRule = { limit: 5, windowMs: 60 * MINUTE };
/** Invitations each person can send, across all their organizations. */
export const INVITE_USER_LIMIT: RateLimitRule = { limit: 20, windowMs: 60 * MINUTE };

export { LOGIN_RATE_LIMITED } from "@/lib/rate-limit-messages";

export interface RateLimitResult {
  allowed: boolean;
  /** Hits counted in the current window, this one included. */
  count: number;
  resetAt: Date;
}

/**
 * Counts one hit against `key` and says whether it is within the rule.
 * A single upsert, so parallel requests can't slip past the limit.
 */
export async function hit(key: string, rule: RateLimitRule, now = new Date()): Promise<RateLimitResult> {
  const resetAt = new Date(now.getTime() + rule.windowMs);
  const [row] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt}::timestamptz)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now}::timestamptz THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now}::timestamptz THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;

  // Expired windows are dead weight; sweep them now and then instead of on every hit.
  if (Math.random() < 0.02) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: now } } }).catch(() => {});
  }

  return { allowed: row.count <= rule.limit, count: row.count, resetAt: row.resetAt };
}

/** Whether `key` already used up its window, without counting a new hit. */
export async function isLimited(key: string, rule: RateLimitRule, now = new Date()): Promise<boolean> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  return !!row && row.resetAt > now && row.count >= rule.limit;
}

/** Forgets the hits of `key` (e.g. after a successful login). */
export async function clearHits(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** "en 12 min" style wait until the window ends, at least one minute. */
export function retryAfterLabel(resetAt: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / MINUTE));
  return `${minutes} min`;
}

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

/**
 * Best-effort client IP from proxy headers, or null when there is none.
 * These headers can be forged unless a trusted proxy overwrites them, so IP limits only
 * complement the per-account ones.
 */
export function clientIp(headers: HeaderSource): string | null {
  const read = (name: string) => {
    if (!headers) return undefined;
    const value = headers instanceof Headers ? headers.get(name) : headers[name];
    return (Array.isArray(value) ? value[0] : value) ?? undefined;
  };
  const ip = read("x-real-ip")?.trim() || read("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || null;
}
