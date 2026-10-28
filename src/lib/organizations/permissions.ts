import type { OrgRole } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: "Dueño",
  ADMIN: "Admin",
  MEMBER: "Miembro",
};

/** Caps how many organizations one person can own. */
export const MAX_OWNED_ORGANIZATIONS = 10;

/** Roles an invitation or a role change can grant. There is only ever one OWNER. */
export const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER"] as const satisfies readonly OrgRole[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Owners can invite admins and members; admins can invite members. */
export function canInvite(actor: OrgRole, role: OrgRole): boolean {
  if (role === "OWNER") return false;
  if (actor === "OWNER") return true;
  return actor === "ADMIN" && role === "MEMBER";
}

/** Roles this actor may hand out in an invitation (empty if they can't invite). */
export function invitableRoles(actor: OrgRole): AssignableRole[] {
  return ASSIGNABLE_ROLES.filter((role) => canInvite(actor, role));
}

/** Who can see and revoke pending invitations. */
export function canManageInvitations(actor: OrgRole): boolean {
  return actor === "OWNER" || actor === "ADMIN";
}

/** Owners remove admins and members; admins remove members. Nobody removes the owner. */
export function canRemoveMember(actor: OrgRole, target: OrgRole): boolean {
  if (target === "OWNER") return false;
  if (actor === "OWNER") return true;
  return actor === "ADMIN" && target === "MEMBER";
}

/** Only the owner promotes or demotes, and never to or from OWNER. */
export function canChangeRole(actor: OrgRole, target: OrgRole, next: OrgRole): boolean {
  return actor === "OWNER" && target !== "OWNER" && next !== "OWNER" && target !== next;
}

/** The owner can't leave (they delete the organization instead). */
export function canLeave(actor: OrgRole): boolean {
  return actor !== "OWNER";
}

export function canDeleteOrganization(actor: OrgRole): boolean {
  return actor === "OWNER";
}

/** Owners and admins create, assign, edit, delete and reopen board tasks, and follow everyone's. */
export const TASK_MANAGER_ROLES = ["OWNER", "ADMIN"] as const satisfies readonly OrgRole[];

export function canManageTasks(actor: OrgRole): boolean {
  return (TASK_MANAGER_ROLES as readonly OrgRole[]).includes(actor);
}
