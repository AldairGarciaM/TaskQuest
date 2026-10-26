"use server";

import { hash } from "bcryptjs";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

const BCRYPT_COST = 12;

export type RegisterResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: Partial<Record<keyof RegisterInput, string[]>>;
      formError?: string;
    };

export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hash(password, BCRYPT_COST);

  try {
    await prisma.user.create({ data: { name, email, passwordHash } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        fieldErrors: { email: ["Ya existe una cuenta con este correo"] },
      };
    }
    console.error("registerUser failed", error);
    return {
      ok: false,
      formError: "No pudimos crear tu cuenta. Intenta de nuevo en un momento.",
    };
  }

  return { ok: true };
}
