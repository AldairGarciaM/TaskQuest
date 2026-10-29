import { prisma } from "@/lib/prisma";

/** Where requireUser sends a session the user has revoked; it clears the cookie and goes to login. */
export const EXPIRED_SESSION_PATH = "/api/session/expired";

/**
 * Whether a session still belongs to a live account and was issued after the last password
 * change. Changing the password bumps `sessionVersion`, which signs out every other device.
 */
export async function isSessionCurrent(userId: string, sessionVersion: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return user?.sessionVersion === sessionVersion;
}
