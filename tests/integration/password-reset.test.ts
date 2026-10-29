import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { registerUser, requestPasswordReset, resetPassword } from "@/app/auth/actions";
import { authOptions } from "@/lib/auth";
import { findValidResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { hit, LOGIN_ACCOUNT_LIMIT, PASSWORD_RESET_EMAIL_LIMIT } from "@/lib/rate-limit";
import { isSessionCurrent } from "@/lib/session-version";

import { setClientIp } from "./helpers";

type CredentialsProvider = {
  options: { authorize: (credentials: Record<string, string>, req: object) => Promise<Record<string, unknown> | null> };
};
const authorize = (identifier: string, password: string) =>
  (authOptions.providers[0] as unknown as CredentialsProvider).options.authorize({ identifier, password }, {});

const ada = { firstName: "Ada", lastName: "Lovelace", username: "ada", email: "ada@example.com", password: "Secreta123" };

let info: MockInstance<typeof console.info>;
beforeEach(() => {
  // Without SMTP the reset link is logged; tests read it from there.
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});

/** Token from the last reset link "emailed" (logged). */
function lastToken(): string {
  const line = String(info.mock.calls.at(-1)?.[0] ?? "");
  const match = line.match(/\/auth\/restablecer\/([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error(`No reset link in: ${line}`);
  return match[1];
}

async function requestToken(email = ada.email) {
  expect(await requestPasswordReset({ email })).toEqual({ ok: true });
  return lastToken();
}

const adaUser = () => prisma.user.findUniqueOrThrow({ where: { email: ada.email } });

describe("requestPasswordReset", () => {
  it("emails a link whose token is stored only as a hash", async () => {
    await registerUser(ada);
    const token = await requestToken(" ADA@example.com ");

    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
    expect(await findValidResetToken(token)).toMatchObject({ userId: (await adaUser()).id });
  });

  it("answers the same for an address without an account, and sends nothing", async () => {
    expect(await requestPasswordReset({ email: "nadie@example.com" })).toEqual({ ok: true });
    expect(info).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("keeps only the newest link", async () => {
    await registerUser(ada);
    const first = await requestToken();
    const second = await requestToken();

    expect(await prisma.passwordResetToken.count()).toBe(1);
    expect(await findValidResetToken(first)).toBeNull();
    expect(await findValidResetToken(second)).not.toBeNull();
  });

  it("caps requests per address, whether or not it has an account", async () => {
    for (let i = 0; i < PASSWORD_RESET_EMAIL_LIMIT.limit; i++) {
      expect((await requestPasswordReset({ email: "nadie@example.com" })).ok).toBe(true);
    }
    const blocked = await requestPasswordReset({ email: "nadie@example.com" });
    expect(blocked.ok === false && blocked.formError).toMatch(/demasiados enlaces.*\d+ min/);
  });

  it("caps requests per IP across addresses", async () => {
    setClientIp("203.0.113.7");
    for (let i = 0; i < 10; i++) expect((await requestPasswordReset({ email: `p${i}@example.com` })).ok).toBe(true);
    expect((await requestPasswordReset({ email: "otra@example.com" })).ok).toBe(false);
  });

  it("validates the email", async () => {
    const result = await requestPasswordReset({ email: "nope" });
    expect(result.ok === false && Object.keys(result.fieldErrors ?? {})).toEqual(["email"]);
  });
});

describe("resetPassword", () => {
  it("changes the password, uses up the link and revokes existing sessions", async () => {
    await registerUser(ada);
    const before = await adaUser();
    const token = await requestToken();

    expect(await resetPassword(token, { password: "NuevaClave456" })).toEqual({ ok: true });

    expect(await authorize("ada", "NuevaClave456")).toMatchObject({ username: "ada", sessionVersion: 1 });
    expect(await authorize("ada", "Secreta123")).toBeNull();

    expect(await isSessionCurrent(before.id, before.sessionVersion)).toBe(false);
    expect(await isSessionCurrent(before.id, before.sessionVersion + 1)).toBe(true);

    expect(await resetPassword(token, { password: "OtraClave789" })).toMatchObject({ ok: false, expired: true });
    expect(await authorize("ada", "NuevaClave456")).not.toBeNull();
  });

  it("rejects expired, unknown or malformed links", async () => {
    await registerUser(ada);
    const token = await requestToken();
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await resetPassword(token, { password: "NuevaClave456" })).toMatchObject({ ok: false, expired: true });
    expect(await resetPassword("x".repeat(43), { password: "NuevaClave456" })).toMatchObject({ expired: true });
    expect(await resetPassword("corto", { password: "NuevaClave456" })).toMatchObject({ expired: true });
    expect(await authorize("ada", "Secreta123")).not.toBeNull();
  });

  it("validates the new password without using up the link", async () => {
    await registerUser(ada);
    const token = await requestToken();

    const result = await resetPassword(token, { password: "corta" });
    expect(result.ok === false && Object.keys(result.fieldErrors ?? {})).toEqual(["password"]);
    expect(await findValidResetToken(token)).not.toBeNull();
  });

  it("works only once when used in parallel", async () => {
    await registerUser(ada);
    const token = await requestToken();

    const results = await Promise.all([
      resetPassword(token, { password: "PrimeraClave1" }),
      resetPassword(token, { password: "SegundaClave2" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await adaUser()).sessionVersion).toBe(1);
  });

  it("lifts a login lock on the account", async () => {
    await registerUser(ada);
    const { id } = await adaUser();
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT.limit; i++) await hit(`login:account:${id}`, LOGIN_ACCOUNT_LIMIT);
    await expect(authorize("ada", "Secreta123")).rejects.toThrow();

    await resetPassword(await requestToken(), { password: "NuevaClave456" });
    expect(await authorize("ada", "NuevaClave456")).not.toBeNull();
  });
});

describe("isSessionCurrent", () => {
  it("is false for an account that no longer exists", async () => {
    await registerUser(ada);
    const { id } = await adaUser();
    expect(await isSessionCurrent(id, 0)).toBe(true);
    await prisma.user.delete({ where: { id } });
    expect(await isSessionCurrent(id, 0)).toBe(false);
  });
});
