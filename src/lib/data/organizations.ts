import type { OrgRole } from "@/generated/prisma/enums";
import { canManageInvitations } from "@/lib/organizations/permissions";
import { hashInvitationToken } from "@/lib/organizations/tokens";
import { formatJoinCode } from "@/lib/organizations/join-code";
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

export interface SidebarOrganization {
  id: string;
  name: string;
  slug: string;
  /** What waits on me there: my pending tasks, plus tasks sent to me for review. */
  attention: number;
}

/** My organizations for the navigation shortcut, in the order I joined them. */
export async function getSidebarOrganizations(userId: string): Promise<SidebarOrganization[]> {
  const [memberships, mine, toReview] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { organization: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.orgTask.groupBy({
      by: ["organizationId"],
      where: { assigneeId: userId, status: "PENDING" },
      _count: { _all: true },
    }),
    prisma.orgTask.groupBy({
      by: ["organizationId"],
      // Only while I can still review there (a demoted reviewer's requests are anyone's).
      where: {
        requestedReviewerId: userId,
        status: "IN_REVIEW",
        organization: { members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } } },
      },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const row of [...mine, ...toReview]) {
    counts.set(row.organizationId, (counts.get(row.organizationId) ?? 0) + row._count._all);
  }
  return memberships.map(({ organization }) => ({ ...organization, attention: counts.get(organization.id) ?? 0 }));
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
  /** "ABCD-2345", or null when joining by code is off or the viewer can't manage invitations. */
  joinCode: string | null;
}

/** The organization as seen by one of its members, or null if they aren't one. */
export async function getOrganizationForMember(slug: string, userId: string): Promise<OrganizationDetail | null> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      joinCode: true,
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
    joinCode: canManageInvitations(me.role) && organization.joinCode ? formatJoinCode(organization.joinCode) : null,
  };
}

export interface MyInvitation {
  id: string;
  role: OrgRole;
  organizationName: string;
  inviterName: string | null;
  expiresAt: string;
}

/** Invitations to my email that I can still accept, newest first. */
export async function getMyPendingInvitations(userId: string): Promise<MyInvitation[]> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!account) return [];
  const rows = await prisma.invitation.findMany({
    where: {
      email: account.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      // Joined some other way (code, older link): nothing left to accept.
      organization: { members: { none: { userId } } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      organization: { select: { name: true } },
      invitedBy: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map((i) => ({
    id: i.id,
    role: i.role,
    organizationName: i.organization.name,
    inviterName: i.invitedBy ? `${i.invitedBy.firstName} ${i.invitedBy.lastName}` : null,
    expiresAt: i.expiresAt.toISOString(),
  }));
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
