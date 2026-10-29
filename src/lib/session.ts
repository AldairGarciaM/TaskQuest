import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authOptions } from "@/lib/auth";
import { EXPIRED_SESSION_PATH, isSessionCurrent } from "@/lib/session-version";

/**
 * Returns the signed-in user or redirects to the login page.
 * Use in every protected Server Component and Server Action: the proxy
 * only does an optimistic check. Cached per request, so a layout and its
 * page can both call it.
 */
export const requireUser = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  // The JWT alone can't be revoked: check it against the account (deleted, or password changed since).
  if (!(await isSessionCurrent(session.user.id, session.user.sessionVersion))) redirect(EXPIRED_SESSION_PATH);
  return session.user;
});
