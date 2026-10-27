import type { OrgRole } from "@/generated/prisma/enums";
import { canManageInvitations } from "@/lib/organizations/permissions";
import { hashInvitationToken } from "@/lib/organizations/tokens";
import { prisma } from "@/lib/prisma";

const ROLE_ORDER: Record<OrgRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  memberCount: number;
}

export async function getMyOrganizations(userId: string): Promise<OrganizationSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true, _count: { select: { members: true } } } },
    },
  });

  return memberships.map(({ role, organization }) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role,
    memberCount: organization._count.members,
  }));
}

export interface MemberDTO {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  level: number;
  role: OrgRole;
  joinedAt: string;
}

export interface InvitationDTO {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  expired: boolean;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  myRole: OrgRole;
  members: MemberDTO[];
  /** Pending invitations; empty for roles that can't manage them. */
  invitations: InvitationDTO[];
}

/** The organization as seen by one of its members, or null if they aren't one. */
export async function getOrganizationForMember(slug: string, userId: string): Promise<OrganizationDetail | null> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, username: true, level: true } },
        },
      },
    },
  });
  if (!organization) return null;

  const me = organization.members.find((m) => m.user.id === userId);
  if (!me) return null;

  const invitations = canManageInvitations(me.role)
    ? await prisma.invitation.findMany({
        where: { organizationId: organization.id, acceptedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true },
      })
    : [];

  const now = Date.now();
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    myRole: me.role,
    members: organization.members
      .map((m) => ({
        userId: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        username: m.user.username,
        level: m.user.level,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.firstName.localeCompare(b.firstName, "es")),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      expired: i.expiresAt.getTime() <= now,
    })),
  };
}

export type InvitationLookup =
  | { status: "invalid" }
  | { status: "expired" | "accepted"; organizationName: string }
  | { status: "pending"; id: string; email: string; role: OrgRole; organizationId: string; organizationName: string; organizationSlug: string; inviterName: string | null };

/** Resolves an invitation link token. Callers must still check the email matches the account. */
export async function findInvitationByToken(token: string): Promise<InvitationLookup> {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!invitation) return { status: "invalid" };

  const organizationName = invitation.organization.name;
  if (invitation.acceptedAt) return { status: "accepted", organizationName };
  if (invitation.expiresAt.getTime() <= Date.now()) return { status: "expired", organizationName };

  return {
    status: "pending",
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    organizationId: invitation.organization.id,
    organizationName,
    organizationSlug: invitation.organization.slug,
    inviterName: invitation.invitedBy ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}` : null,
  };
}
