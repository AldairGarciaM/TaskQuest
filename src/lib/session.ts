import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authOptions } from "@/lib/auth";
import { currentAccount, EXPIRED_SESSION_PATH } from "@/lib/session-version";
import { fullName } from "@/lib/user";

/**
 * Returns the signed-in user or redirects to the login page.
 * Use in every protected Server Component and Server Action: the proxy
 * only does an optimistic check. Cached per request, so a layout and its
 * page can both call it. Name, username and email are read fresh from
 * the account, so edits show up without signing in again.
 */
export const requireUser = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  // The JWT alone can't be revoked: check it against the account (deleted, or password changed since).
  const account = await currentAccount(session.user.id, session.user.sessionVersion);
  if (!account) redirect(EXPIRED_SESSION_PATH);
  // Profile fields come from the database: the JWT keeps the values from sign-in.
  return { ...session.user, ...account, name: fullName(account) };
});
