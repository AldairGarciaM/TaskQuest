import { prisma } from "@/lib/prisma";

/** Where requireUser sends a session the user has revoked; it clears the cookie and goes to login. */
export const EXPIRED_SESSION_PATH = "/api/session/expired";

/**
 * The account's current profile if the session still belongs to a live account and was issued
 * after the last password change, or null. Changing the password bumps `sessionVersion`, which
 * signs out every other device. The profile is read here because the JWT copy goes stale when
 * the user edits it.
 */
export async function currentAccount(userId: string, sessionVersion: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true, firstName: true, lastName: true, username: true, email: true },
  });
  if (user?.sessionVersion !== sessionVersion) return null;
  return { firstName: user.firstName, lastName: user.lastName, username: user.username, email: user.email };
}

export async function isSessionCurrent(userId: string, sessionVersion: number): Promise<boolean> {
  return (await currentAccount(userId, sessionVersion)) !== null;
}
