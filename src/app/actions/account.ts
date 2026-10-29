"use server";

import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { clearHits, hit, isLimited, PASSWORD_CHANGE_USER_LIMIT } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { hashPassword } from "@/lib/user";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<keyof ChangePasswordInput, string[]>>; error?: string };

const TOO_MANY = {
  ok: false,
  error: "Demasiados intentos con una contraseña incorrecta. Espera unos minutos.",
} as const;

/**
 * Changes the signed-in user's password after checking the current one. Bumps sessionVersion,
 * which signs out every session (this one too: the client signs back in with the new password).
 */
export async function changePassword(input: unknown): Promise<ChangePasswordResult> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const limitKey = `password-change:user:${user.id}`;
  if (await isLimited(limitKey, PASSWORD_CHANGE_USER_LIMIT)) return TOO_MANY;

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!account) return { ok: false, error: "No encontramos tu cuenta." };

  if (!(await compare(parsed.data.currentPassword, account.passwordHash))) {
    const limit = await hit(limitKey, PASSWORD_CHANGE_USER_LIMIT);
    if (!limit.allowed) return TOO_MANY;
    return { ok: false, fieldErrors: { currentPassword: ["La contraseña actual no es correcta"] } };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, sessionVersion: { increment: 1 } } }),
    // A pending reset link would let someone undo the change.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);
  await clearHits(limitKey);
  return { ok: true };
}
