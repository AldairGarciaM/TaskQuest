import { z } from "zod";

import { ASSIGNABLE_ROLES } from "@/lib/organizations/permissions";
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from "@/lib/organizations/join-code";
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

/** What people type: any case, with spaces or a hyphen. Stored codes have neither. */
export const joinCodeSchema = z
  .string()
  .max(32)
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .min(1, { error: "Escribe el código" })
      .regex(new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`), {
        error: "El código tiene 8 letras y números, como ABCD-2345",
      }),
  );

export const joinOrganizationSchema = z.object({ code: joinCodeSchema });

export type JoinOrganizationInput = z.input<typeof joinOrganizationSchema>;
export type JoinFieldErrors = Partial<Record<keyof JoinOrganizationInput, string[]>>;

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type OrganizationFieldErrors = Partial<Record<"name", string[]>>;
export type InviteFieldErrors = Partial<Record<keyof InviteMemberInput, string[]>>;
