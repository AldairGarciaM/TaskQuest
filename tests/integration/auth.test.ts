import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { registerUser } from "@/app/auth/actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOGIN_ACCOUNT_LIMIT, LOGIN_IP_LIMIT, LOGIN_RATE_LIMITED, REGISTER_IP_LIMIT } from "@/lib/rate-limit";

import { setClientIp } from "./helpers";

type CredentialsProvider = {
  options: {
    authorize: (
      credentials: Record<string, string>,
      req: { headers?: Record<string, string> },
    ) => Promise<Record<string, string> | null>;
  };
};
const authorize = (credentials: Record<string, string>, headers: Record<string, string> = {}) =>
  (authOptions.providers[0] as unknown as CredentialsProvider).options.authorize(credentials, { headers });

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

describe("login rate limiting", () => {
  const fail = (identifier: string, headers?: Record<string, string>) =>
    authorize({ identifier, password: "incorrecta" }, headers);

  it("locks an account after repeated failures, even with the right password", async () => {
    await registerUser(ada);
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.limit; i++) expect(await fail("ada")).toBeNull();

    await expect(authorize({ identifier: "ada", password: "Secreta123" })).rejects.toThrow(LOGIN_RATE_LIMITED);
    // The email and the username share the same lock.
    await expect(authorize({ identifier: "ada@example.com", password: "Secreta123" })).rejects.toThrow(
      LOGIN_RATE_LIMITED,
    );
  });

  it("locks unknown accounts the same way, so the lock reveals nothing", async () => {
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.limit; i++) expect(await fail("nadie")).toBeNull();
    await expect(fail("nadie")).rejects.toThrow(LOGIN_RATE_LIMITED);
  });

  it("forgets earlier failures after a successful login", async () => {
    await registerUser(ada);
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.limit - 1; i++) await fail("ada");
    expect(await authorize({ identifier: "ada", password: "Secreta123" })).not.toBeNull();

    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.limit - 1; i++) await fail("ada");
    expect(await authorize({ identifier: "ada", password: "Secreta123" })).not.toBeNull();
  });

  it("caps attempts per IP across different accounts", async () => {
    const ip = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < LOGIN_IP_LIMIT.limit; i++) expect(await fail(`cuenta${i}`, ip)).toBeNull();

    await expect(fail("otra", ip)).rejects.toThrow(LOGIN_RATE_LIMITED);
    expect(await fail("otra", { "x-forwarded-for": "198.51.100.1" })).toBeNull();
  }, 120_000); // Each attempt runs a real bcrypt comparison (cost 12).
});

describe("registration rate limiting", () => {
  const person = (i: number) => ({ ...ada, username: `persona${i}`, email: `persona${i}@example.com` });

  it("caps new accounts per IP", async () => {
    setClientIp("203.0.113.7");
    for (let i = 0; i < REGISTER_IP_LIMIT.limit; i++) expect(await registerUser(person(i))).toEqual({ ok: true });

    const blocked = await registerUser(person(99));
    expect(blocked.ok === false && blocked.formError).toMatch(/demasiadas cuentas.*\d+ min/);
    expect(await prisma.user.count()).toBe(REGISTER_IP_LIMIT.limit);

    setClientIp("198.51.100.1");
    expect(await registerUser(person(99))).toEqual({ ok: true });
  });

  it("doesn't count invalid forms", async () => {
    setClientIp("203.0.113.7");
    await registerUser({ ...ada, email: "nope" });
    expect(await prisma.rateLimit.count()).toBe(0);
  });
});
