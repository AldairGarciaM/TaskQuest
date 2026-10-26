import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import type { RegisterInput } from "@/lib/validations/auth";

export const BCRYPT_COST = 12;

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export type ProfileFieldErrors = Partial<Record<keyof RegisterInput, string[]>>;

/** Field errors for an email or username that is already taken, or null if both are free. */
export async function takenProfileFields(email: string, username: string): Promise<ProfileFieldErrors | null> {
  const existing = await prisma.user.findMany({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing.length === 0) return null;

  const errors: ProfileFieldErrors = {};
  if (existing.some((u) => u.email === email)) errors.email = ["Ya existe una cuenta con este correo"];
  if (existing.some((u) => u.username === username)) errors.username = ["Ese nombre de usuario ya está en uso"];
  return errors;
}

export function hashPassword(password: string) {
  return hash(password, BCRYPT_COST);
}
