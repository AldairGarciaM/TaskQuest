"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { findInvitationByToken } from "@/lib/data/organizations";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { hashPassword, takenProfileFields, type ProfileFieldErrors } from "@/lib/user";
import { profileSchema } from "@/lib/validations/auth";
import { invitationTokenSchema } from "@/lib/validations/organization";

type Failure = { ok: false; error?: string; fieldErrors?: ProfileFieldErrors };

const UNAVAILABLE: Failure = { ok: false, error: "Esta invitación ya no es válida." };
const GENERIC_ERROR: Failure = { ok: false, error: "Algo salió mal. Intenta de nuevo." };

/** Thrown inside a transaction when someone else used the invitation first. */
class InvitationUsedError extends Error {}

async function pendingInvitation(token: unknown) {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return null;
  const invitation = await findInvitationByToken(parsed.data);
  return invitation.status === "pending" ? invitation : null;
}

/** Marks the invitation as used; fails if another request already did. */
async function claim(tx: Prisma.TransactionClient, invitationId: string) {
  const { count } = await tx.invitation.updateMany({
    where: { id: invitationId, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
  if (count === 0) throw new InvitationUsedError();
}

/** Accept with the signed-in account. Its email must be the invited one. */
export async function acceptInvitation(token: unknown): Promise<{ ok: true; slug: string } | Failure> {
  const user = await requireUser();
  const invitation = await pendingInvitation(token);
  if (!invitation) return UNAVAILABLE;

  // Read the email from the database, not the session token.
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (account?.email !== invitation.email) {
    return { ok: false, error: "Esta invitación es para otra cuenta de correo." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await claim(tx, invitation.id);
      // Already a member (e.g. invited twice): keep the current role.
      await tx.membership.upsert({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
        create: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
        update: {},
      });
    });
  } catch (error) {
    if (error instanceof InvitationUsedError) return UNAVAILABLE;
    console.error("acceptInvitation failed", error);
    return GENERIC_ERROR;
  }

  revalidatePath("/organizaciones", "layout");
  return { ok: true, slug: invitation.organizationSlug };
}

/** Create an account for the invited email and join in one step. The client signs in afterwards. */
export async function acceptInvitationWithSignup(
  token: unknown,
  input: unknown,
): Promise<{ ok: true; email: string; slug: string } | Failure> {
  const invitation = await pendingInvitation(token);
  if (!invitation) return UNAVAILABLE;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { firstName, lastName, username, password } = parsed.data;
  const email = invitation.email;

  const taken = await takenProfileFields(email, username);
  if (taken?.email) return { ok: false, error: "Ya existe una cuenta con este correo. Inicia sesión para aceptar." };
  if (taken) return { ok: false, fieldErrors: taken };

  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      await claim(tx, invitation.id);
      await tx.user.create({
        data: {
          firstName,
          lastName,
          username,
          email,
          passwordHash,
          memberships: { create: { organizationId: invitation.organizationId, role: invitation.role } },
        },
      });
    });
  } catch (error) {
    if (error instanceof InvitationUsedError) return UNAVAILABLE;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Ese correo o nombre de usuario ya está en uso." };
    }
    console.error("acceptInvitationWithSignup failed", error);
    return GENERIC_ERROR;
  }

  return { ok: true, email, slug: invitation.organizationSlug };
}
