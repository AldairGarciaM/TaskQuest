import type { ReactNode } from "react";

import FormField from "@/components/form/FormField";
import type { ProfileFieldErrors } from "@/lib/user";

import PasswordField from "./PasswordField";

/** Name, last name, username and password inputs shared by sign-up and invitation forms. */
export default function ProfileFields({
  errors,
  beforePassword,
}: {
  errors: ProfileFieldErrors;
  /** Extra fields rendered between the username and the password (e.g. email). */
  beforePassword?: ReactNode;
}) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Nombre"
          name="firstName"
          autoComplete="given-name"
          required
          error={errors.firstName?.[0]}
        />
        <FormField
          label="Apellidos"
          name="lastName"
          autoComplete="family-name"
          required
          error={errors.lastName?.[0]}
        />
      </div>

      <FormField
        label="Nombre de usuario"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ej. ada.lovelace"
        required
        error={errors.username?.[0]}
      />

      {beforePassword}

      <PasswordField
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        required
        minLength={8}
        error={errors.password?.[0]}
      />
    </>
  );
}
