import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { registerUser } from "@/app/auth/actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CredentialsProvider = {
  options: { authorize: (credentials: Record<string, string>) => Promise<{ id: string } | null> };
};
const authorize = (credentials: Record<string, string>) =>
  (authOptions.providers[0] as unknown as CredentialsProvider).options.authorize(credentials);

describe("registerUser", () => {
  it("creates the user with a normalized email and a bcrypt hash", async () => {
    expect(await registerUser({ name: " Ada ", email: " Ada@Example.com ", password: "Secreta123" })).toEqual({
      ok: true,
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(user).toMatchObject({ name: "Ada", xp: 0, level: 1 });
    expect(user.passwordHash).not.toBe("Secreta123");
    expect(await compare("Secreta123", user.passwordHash)).toBe(true);
  });

  it("rejects a duplicated email on the email field", async () => {
    await registerUser({ name: "Ada", email: "ada@example.com", password: "Secreta123" });
    const result = await registerUser({ name: "Otra", email: "ADA@example.com", password: "Secreta123" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.email).toBeDefined();
    expect(await prisma.user.count()).toBe(1);
  });

  it("validates every field", async () => {
    const result = await registerUser({ name: "A", email: "nope", password: "123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("credentials login", () => {
  it("accepts the right password regardless of email casing", async () => {
    await registerUser({ name: "Ada", email: "ada@example.com", password: "Secreta123" });
    expect(await authorize({ email: "ADA@Example.com", password: "Secreta123" })).toMatchObject({
      email: "ada@example.com",
    });
  });

  it("rejects a wrong password or an unknown email", async () => {
    await registerUser({ name: "Ada", email: "ada@example.com", password: "Secreta123" });
    expect(await authorize({ email: "ada@example.com", password: "incorrecta" })).toBeNull();
    expect(await authorize({ email: "nadie@example.com", password: "Secreta123" })).toBeNull();
  });
});
