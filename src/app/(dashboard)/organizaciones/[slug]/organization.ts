import { redirect } from "next/navigation";
import { cache } from "react";

import { getOrganizationForMember } from "@/lib/data/organizations";
import { requireUser } from "@/lib/session";

/**
 * The organization for the signed-in member, shared by the layout, pages and metadata of one request.
 * Not a member (or it doesn't exist, or you just left it): back to the list without revealing which.
 */
export const loadOrganization = cache(async (slug: string) => {
  const user = await requireUser();
  const organization = await getOrganizationForMember(slug, user.id);
  if (!organization) redirect("/organizaciones");
  return { user, organization };
});
