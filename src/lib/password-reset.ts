import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_TTL_MINUTES = 60;

/** Random token for a reset link. Only its hash is stored. */
export function createResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenExpiry(from = new Date()): Date {
  return new Date(from.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000);
}

export function passwordResetUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/auth/restablecer/${token}`;
}

/** The unused, unexpired reset token behind a link, or null. */
export async function findValidResetToken(token: string, now = new Date()) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { gt: now } },
    select: { id: true, userId: true },
  });
}
