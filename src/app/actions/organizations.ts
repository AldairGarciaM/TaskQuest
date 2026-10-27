"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { sendInvitationEmail } from "@/lib/mail";
import {
  canChangeRole,
  canDeleteOrganization,
  canInvite,
  canLeave,
  canRemoveMember,
  MAX_OWNED_ORGANIZATIONS,
} from "@/lib/organizations/permissions";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationUrl,
  organizationSlug,
} from "@/lib/organizations/tokens";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  assignableRoleSchema,
  createOrganizationSchema,
  idSchema,
  inviteMemberSchema,
  type InviteFieldErrors,
  type OrganizationFieldErrors,
} from "@/lib/validations/organization";

type Failure<E = never> = { ok: false; error?: string; fieldErrors?: E };
type Result<T = object, E = never> = ({ ok: true } & T) | Failure<E>;

const NOT_FOUND = { ok: false, error: "No encontramos esa organización." } as const;
const FORBIDDEN = { ok: false, error: "No tienes permiso para hacer eso." } as const;
const GENERIC_ERROR = { ok: false, error: "Algo salió mal. Intenta de nuevo." } as const;

function revalidateOrganizations() {
  revalidatePath("/organizaciones", "layout");
  // The dashboard lists tasks of my organizations.
  revalidatePath("/");
}

async function roleIn(organizationId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/** Ends a membership and puts that person's pending board tasks back in the open pool. */
async function removeMembership(organizationId: string, userId: string) {
  await prisma.$transaction([
    prisma.orgTask.updateMany({
      // Work waiting for review goes back to the pool too: nobody is left to pay.
      where: { organizationId, assigneeId: userId, status: { in: ["PENDING", "IN_REVIEW"] } },
      data: { assigneeId: null, selfAssigned: false, status: "PENDING", submittedAt: null, reviewNote: null },
    }),
    prisma.membership.deleteMany({ where: { organizationId, userId } }),
  ]);
}

export async function createOrganization(
  input: unknown,
): Promise<Result<{ slug: string }, OrganizationFieldErrors>> {
  const user = await requireUser();
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const owned = await prisma.membership.count({ where: { userId: user.id, role: "OWNER" } });
  if (owned >= MAX_OWNED_ORGANIZATIONS) {
    return { ok: false, error: `Puedes crear hasta ${MAX_OWNED_ORGANIZATIONS} organizaciones.` };
  }

  // The random suffix makes a slug collision unlikely; retry a couple of times just in case.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const organization = await prisma.organization.create({
        data: {
          name: parsed.data.name,
          slug: organizationSlug(parsed.data.name),
          members: { create: { userId: user.id, role: "OWNER" } },
        },
        select: { slug: true },
      });
      revalidateOrganizations();
      return { ok: true, slug: organization.slug };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      console.error("createOrganization failed", error);
      return GENERIC_ERROR;
    }
  }
  return GENERIC_ERROR;
}

export async function inviteMember(
  organizationId: unknown,
  input: unknown,
): Promise<Result<{ url: string; emailed: boolean }, InviteFieldErrors>> {
  const user = await requireUser();
  const orgId = idSchema.safeParse(organizationId);
  if (!orgId.success) return NOT_FOUND;
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const actor = await roleIn(orgId.data, user.id);
  if (!actor) return NOT_FOUND;
  const { email, role } = parsed.data;
  if (!canInvite(actor, role)) return FORBIDDEN;

  const alreadyMember = await prisma.membership.findFirst({
    where: { organizationId: orgId.data, user: { email } },
    select: { id: true },
  });
  if (alreadyMember) return { ok: false, fieldErrors: { email: ["Esa persona ya es miembro"] } };

  const token = createInvitationToken();
  let organizationName: string;
  try {
    // Inviting the same email again replaces the pending invitation, so only the newest link works.
    const [, invitation] = await prisma.$transaction([
      prisma.invitation.deleteMany({ where: { organizationId: orgId.data, email, acceptedAt: null } }),
      prisma.invitation.create({
        data: {
          organizationId: orgId.data,
          email,
          role,
          tokenHash: hashInvitationToken(token),
          expiresAt: invitationExpiry(),
          invitedById: user.id,
        },
        select: { organization: { select: { name: true } } },
      }),
    ]);
    organizationName = invitation.organization.name;
  } catch (error) {
    console.error("inviteMember failed", error);
    return GENERIC_ERROR;
  }

  const url = invitationUrl(token);
  const emailed = await sendInvitationEmail({ to: email, organizationName, inviterName: user.name || user.username, url });

  revalidateOrganizations();
  return { ok: true, url, emailed };
}

export async function revokeInvitation(invitationId: unknown): Promise<Result> {
  const user = await requireUser();
  const id = idSchema.safeParse(invitationId);
  if (!id.success) return NOT_FOUND;

  const invitation = await prisma.invitation.findUnique({
    where: { id: id.data },
    select: { organizationId: true, role: true, acceptedAt: true },
  });
  if (!invitation || invitation.acceptedAt) return { ok: false, error: "Esa invitación ya no está pendiente." };

  const actor = await roleIn(invitation.organizationId, user.id);
  if (!actor) return NOT_FOUND;
  // You can revoke what you could have sent.
  if (!canInvite(actor, invitation.role)) return FORBIDDEN;

  await prisma.invitation.deleteMany({ where: { id: id.data, acceptedAt: null } });
  revalidateOrganizations();
  return { ok: true };
}

export async function changeMemberRole(organizationId: unknown, userId: unknown, role: unknown): Promise<Result> {
  const user = await requireUser();
  const orgId = idSchema.safeParse(organizationId);
  const targetId = idSchema.safeParse(userId);
  const nextRole = assignableRoleSchema.safeParse(role);
  if (!orgId.success || !targetId.success) return NOT_FOUND;
  if (!nextRole.success) return { ok: false, error: "Elige un rol válido." };

  const [actor, target] = await Promise.all([roleIn(orgId.data, user.id), roleIn(orgId.data, targetId.data)]);
  if (!actor || !target) return NOT_FOUND;
  if (!canChangeRole(actor, target, nextRole.data)) return FORBIDDEN;

  await prisma.membership.update({
    where: { organizationId_userId: { organizationId: orgId.data, userId: targetId.data } },
    data: { role: nextRole.data },
  });
  revalidateOrganizations();
  return { ok: true };
}

export async function removeMember(organizationId: unknown, userId: unknown): Promise<Result> {
  const user = await requireUser();
  const orgId = idSchema.safeParse(organizationId);
  const targetId = idSchema.safeParse(userId);
  if (!orgId.success || !targetId.success) return NOT_FOUND;
  if (targetId.data === user.id) return { ok: false, error: "Para salir usa “Salir de la organización”." };

  const [actor, target] = await Promise.all([roleIn(orgId.data, user.id), roleIn(orgId.data, targetId.data)]);
  if (!actor || !target) return NOT_FOUND;
  if (!canRemoveMember(actor, target)) return FORBIDDEN;

  await removeMembership(orgId.data, targetId.data);
  revalidateOrganizations();
  return { ok: true };
}

export async function leaveOrganization(organizationId: unknown): Promise<Result> {
  const user = await requireUser();
  const orgId = idSchema.safeParse(organizationId);
  if (!orgId.success) return NOT_FOUND;

  const actor = await roleIn(orgId.data, user.id);
  if (!actor) return NOT_FOUND;
  if (!canLeave(actor)) return { ok: false, error: "El dueño no puede salir; elimina la organización." };

  await removeMembership(orgId.data, user.id);
  revalidateOrganizations();
  return { ok: true };
}

export async function deleteOrganization(organizationId: unknown): Promise<Result> {
  const user = await requireUser();
  const orgId = idSchema.safeParse(organizationId);
  if (!orgId.success) return NOT_FOUND;

  const actor = await roleIn(orgId.data, user.id);
  if (!actor) return NOT_FOUND;
  if (!canDeleteOrganization(actor)) return FORBIDDEN;

  await prisma.organization.delete({ where: { id: orgId.data } });
  revalidateOrganizations();
  return { ok: true };
}
