import { z } from "zod";

// bcrypt only uses the first 72 bytes of a password.
const PASSWORD_MAX = 72;

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresa un correo válido" }));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, {
    error: "Usa de 3 a 20 caracteres: letras, números, punto o guion bajo",
  });

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(2, { error: `${label} debe tener al menos 2 caracteres` })
    .max(50, { error: `${label} no puede pasar de 50 caracteres` });

export const passwordSchema = z
  .string()
  .min(8, { error: "Usa al menos 8 caracteres" })
  .max(PASSWORD_MAX, { error: `Usa como máximo ${PASSWORD_MAX} caracteres` });

export const loginSchema = z.object({
  /** Email or username. */
  identifier: z.string().trim().toLowerCase().min(1, { error: "Ingresa tu correo o usuario" }).max(254),
  password: z
    .string()
    .min(1, { error: "Ingresa tu contraseña" })
    .max(PASSWORD_MAX, { error: "Contraseña demasiado larga" }),
});

/** Profile fields shared by self sign-up and accepting an invitation. */
export const profileSchema = z.object({
  firstName: personName("Tu nombre"),
  lastName: personName("Tus apellidos"),
  username: usernameSchema,
  password: passwordSchema,
});

export const registerSchema = profileSchema.extend({ email: emailSchema });

export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema });

/** Same shape as invitation tokens: 32 random bytes in base64url. */
export const resetTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: "Ingresa tu contraseña actual" })
      .max(PASSWORD_MAX, { error: "Contraseña demasiado larga" }),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    error: "Elige una contraseña distinta a la actual",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Account fields editable from /configuracion. */
export const updateProfileSchema = z.object({
  firstName: personName("Tu nombre"),
  lastName: personName("Tus apellidos"),
  username: usernameSchema,
  email: emailSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
