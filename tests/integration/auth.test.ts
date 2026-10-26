import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { registerUser } from "@/app/auth/actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CredentialsProvider = {
  options: { authorize: (credentials: Record<string, string>) => Promise<Record<string, string> | null> };
};
const authorize = (credentials: Record<string, string>) =>
  (authOptions.providers[0] as unknown as CredentialsProvider).options.authorize(credentials);

const ada = { firstName: "Ada", lastName: "Lovelace", username: "ada", email: "ada@example.com", password: "Secreta123" };

describe("registerUser", () => {
  it("creates the user with a normalized profile and a bcrypt hash", async () => {
    expect(
      await registerUser({ ...ada, firstName: " Ada ", username: " Ada ", email: " Ada@Example.com " }),
    ).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(user).toMatchObject({ firstName: "Ada", lastName: "Lovelace", username: "ada", xp: 0, level: 1 });
    expect(user.passwordHash).not.toBe("Secreta123");
    expect(await compare("Secreta123", user.passwordHash)).toBe(true);
  });

  it("rejects a duplicated email or username on the right field", async () => {
    await registerUser(ada);

    const sameEmail = await registerUser({ ...ada, username: "otra", email: "ADA@example.com" });
    expect(sameEmail.ok === false && Object.keys(sameEmail.fieldErrors ?? {})).toEqual(["email"]);

    const sameUsername = await registerUser({ ...ada, username: "ADA", email: "otra@example.com" });
    expect(sameUsername.ok === false && Object.keys(sameUsername.fieldErrors ?? {})).toEqual(["username"]);

    expect(await prisma.user.count()).toBe(1);
  });

  it("validates every field", async () => {
    const result = await registerUser({ firstName: "A", lastName: "", username: "a b", email: "nope", password: "123" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["email", "firstName", "lastName", "password", "username"]);
    }
  });
});

describe("credentials login", () => {
  it("accepts the email or the username, regardless of casing", async () => {
    await registerUser(ada);
    const expected = { email: "ada@example.com", username: "ada", firstName: "Ada", name: "Ada Lovelace" };

    expect(await authorize({ identifier: "ADA@Example.com", password: "Secreta123" })).toMatchObject(expected);
    expect(await authorize({ identifier: " Ada ", password: "Secreta123" })).toMatchObject(expected);
  });

  it("rejects a wrong password or an unknown account", async () => {
    await registerUser(ada);
    expect(await authorize({ identifier: "ada", password: "incorrecta" })).toBeNull();
    expect(await authorize({ identifier: "nadie@example.com", password: "Secreta123" })).toBeNull();
    expect(await authorize({ identifier: "nadie", password: "Secreta123" })).toBeNull();
  });
});
