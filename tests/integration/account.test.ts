import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { changePassword } from "@/app/actions/account";
import { prisma } from "@/lib/prisma";
import { PASSWORD_CHANGE_USER_LIMIT } from "@/lib/rate-limit";
import { isSessionCurrent } from "@/lib/session-version";

import { createSignedInUser } from "./helpers";

// createUser() sets this password.
const CURRENT = "Secreta123";

const account = (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });

describe("changePassword", () => {
  it("changes the password and revokes existing sessions", async () => {
    const user = await createSignedInUser();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: "x".repeat(64), expiresAt: new Date(Date.now() + 60_000) },
    });

    expect(await changePassword({ currentPassword: CURRENT, newPassword: "NuevaClave456" })).toEqual({ ok: true });

    const updated = await account(user.id);
    expect(await compare("NuevaClave456", updated.passwordHash)).toBe(true);
    expect(updated.sessionVersion).toBe(1);
    expect(await isSessionCurrent(user.id, 0)).toBe(false);
    // A pending reset link could undo the change.
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("rejects a wrong current password on its field", async () => {
    const user = await createSignedInUser();
    const result = await changePassword({ currentPassword: "incorrecta", newPassword: "NuevaClave456" });

    expect(result).toEqual({ ok: false, fieldErrors: { currentPassword: ["La contraseña actual no es correcta"] } });
    expect((await account(user.id)).sessionVersion).toBe(0);
  });

  it("validates both fields and refuses reusing the current password", async () => {
    await createSignedInUser();
    const empty = await changePassword({ currentPassword: "", newPassword: "corta" });
    expect(empty.ok === false && Object.keys(empty.fieldErrors ?? {}).sort()).toEqual(["currentPassword", "newPassword"]);

    const same = await changePassword({ currentPassword: CURRENT, newPassword: CURRENT });
    expect(same.ok === false && same.fieldErrors?.newPassword).toEqual(["Elige una contraseña distinta a la actual"]);
  });

  it("locks after repeated wrong current passwords, even with the right one", async () => {
    const user = await createSignedInUser();
    for (let i = 0; i < PASSWORD_CHANGE_USER_LIMIT.limit; i++) {
      expect((await changePassword({ currentPassword: "incorrecta", newPassword: "NuevaClave456" })).ok).toBe(false);
    }

    const blocked = await changePassword({ currentPassword: CURRENT, newPassword: "NuevaClave456" });
    expect(blocked).toMatchObject({ ok: false, error: expect.stringMatching(/Demasiados intentos/) });
    expect((await account(user.id)).sessionVersion).toBe(0);
  });

  it("forgets earlier mistakes after a successful change", async () => {
    const user = await createSignedInUser();
    for (let i = 0; i < PASSWORD_CHANGE_USER_LIMIT.limit - 1; i++) {
      await changePassword({ currentPassword: "incorrecta", newPassword: "NuevaClave456" });
    }
    expect((await changePassword({ currentPassword: CURRENT, newPassword: "NuevaClave456" })).ok).toBe(true);
    expect(await prisma.rateLimit.count({ where: { key: { contains: user.id } } })).toBe(0);
  });

  it("requires a session", async () => {
    await expect(changePassword({ currentPassword: CURRENT, newPassword: "NuevaClave456" })).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
  });
});
