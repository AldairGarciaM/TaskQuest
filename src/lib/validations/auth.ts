import { z } from "zod";

// bcrypt only uses the first 72 bytes of a password.
const PASSWORD_MAX = 72;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresa un correo válido" }));

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, { error: "Ingresa tu contraseña" })
    .max(PASSWORD_MAX, { error: "Contraseña demasiado larga" }),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Tu nombre debe tener al menos 2 caracteres" })
    .max(50, { error: "Tu nombre no puede pasar de 50 caracteres" }),
  email,
  password: z
    .string()
    .min(8, { error: "Usa al menos 8 caracteres" })
    .max(PASSWORD_MAX, { error: `Usa como máximo ${PASSWORD_MAX} caracteres` }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
