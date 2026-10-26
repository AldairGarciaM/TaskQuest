"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, takenProfileFields, type ProfileFieldErrors } from "@/lib/user";
import { registerSchema } from "@/lib/validations/auth";

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
