import { z } from "zod";

import { ASSIGNABLE_ROLES } from "@/lib/organizations/permissions";
import { emailSchema } from "@/lib/validations/auth";

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, { error: "El nombre debe tener al menos 2 caracteres" })
  .max(60, { error: "El nombre no puede pasar de 60 caracteres" });

export const createOrganizationSchema = z.object({ name: organizationNameSchema });

export const idSchema = z.string().min(1).max(64);

export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES, { error: "Elige un rol válido" });

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: assignableRoleSchema,
});

/** Invitation tokens are 32 random bytes in base64url (43 chars). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type OrganizationFieldErrors = Partial<Record<"name", string[]>>;
export type InviteFieldErrors = Partial<Record<keyof InviteMemberInput, string[]>>;
