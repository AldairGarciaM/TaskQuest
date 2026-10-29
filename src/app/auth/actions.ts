"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  createResetToken,
  hashResetToken,
  PASSWORD_RESET_TTL_MINUTES,
  passwordResetUrl,
  resetTokenExpiry,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import {
  clearHits,
  clientIp,
  hit,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  REGISTER_IP_LIMIT,
  retryAfterLabel,
} from "@/lib/rate-limit";
import { hashPassword, takenProfileFields, type ProfileFieldErrors } from "@/lib/user";
import { forgotPasswordSchema, registerSchema, resetPasswordSchema, resetTokenSchema } from "@/lib/validations/auth";

export type RegisterResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: ProfileFieldErrors;
      formError?: string;
    };

const TAKEN: RegisterResult = {
  ok: false,
  formError: "Ese correo o nombre de usuario ya está en uso.",
};

export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // Counted before the "already taken" check, which would otherwise let anyone probe for accounts.
  const ip = clientIp(await headers());
  if (ip) {
    const limit = await hit(`register:ip:${ip}`, REGISTER_IP_LIMIT);
    if (!limit.allowed) {
      return {
        ok: false,
        formError: `Se crearon demasiadas cuentas desde esta conexión. Intenta de nuevo en ${retryAfterLabel(limit.resetAt)}.`,
      };
    }
  }

  const { firstName, lastName, username, email, password } = parsed.data;

  const taken = await takenProfileFields(email, username);
  if (taken) return { ok: false, fieldErrors: taken };

  try {
    await prisma.user.create({
      data: { firstName, lastName, username, email, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    // Someone took the email or username between the check and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return TAKEN;
    console.error("registerUser failed", error);
    return {
      ok: false,
      formError: "No pudimos crear tu cuenta. Intenta de nuevo en un momento.",
    };
  }

  return { ok: true };
}

export type ForgotPasswordResult = { ok: true } | { ok: false; fieldErrors?: { email?: string[] }; formError?: string };

/**
 * Emails a one-time reset link if the address has an account. Answers the same either way so
 * the form can't be used to find out who has an account.
 */
export async function requestPasswordReset(input: unknown): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { email } = parsed.data;

  const ip = clientIp(await headers());
  const limits = await Promise.all([
    hit(`reset:email:${email}`, PASSWORD_RESET_EMAIL_LIMIT),
    ip ? hit(`reset:ip:${ip}`, PASSWORD_RESET_IP_LIMIT) : null,
  ]);
  const blocked = limits.find((limit) => limit && !limit.allowed);
  if (blocked) {
    return {
      ok: false,
      formError: `Pediste demasiados enlaces. Intenta de nuevo en ${retryAfterLabel(blocked.resetAt)}.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: true };

  const token = createResetToken();
  try {
    // Only the newest link works.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: resetTokenExpiry() },
      }),
    ]);
  } catch (error) {
    console.error("requestPasswordReset failed", error);
    return { ok: false, formError: "No pudimos enviar el enlace. Intenta de nuevo en un momento." };
  }

  await sendPasswordResetEmail({ to: email, url: passwordResetUrl(token), ttlMinutes: PASSWORD_RESET_TTL_MINUTES });
  return { ok: true };
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; fieldErrors?: { password?: string[] }; formError?: string; expired?: boolean };

/** Sets a new password from a reset link, uses up the link and signs out every existing session. */
export async function resetPassword(token: unknown, input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const expired = { ok: false, expired: true, formError: "El enlace ya no es válido. Pide uno nuevo." } as const;
  const tokenParsed = resetTokenSchema.safeParse(token);
  if (!tokenParsed.success) return expired;

  const now = new Date();
  const passwordHash = await hashPassword(parsed.data.password);
  const userId = await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findFirst({
      where: { tokenHash: hashResetToken(tokenParsed.data), usedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    if (!resetToken) return null;

    // Conditional update: if two requests race with the same link, only one gets through.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return null;

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, id: { not: resetToken.id } } });
    return resetToken.userId;
  });
  if (!userId) return expired;

  // Whoever owns the email just proved it; let them sign in right away.
  await clearHits(`login:account:${userId}`);
  return { ok: true };
}
