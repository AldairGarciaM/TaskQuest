"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { changePassword, type ChangePasswordResult } from "@/app/actions/account";
import { changePasswordSchema } from "@/lib/validations/auth";

import FormAlert from "@/components/auth/FormAlert";
import PasswordField from "@/components/auth/PasswordField";
import SubmitButton from "@/components/auth/SubmitButton";

type FieldErrors = Extract<ChangePasswordResult, { ok: false }>["fieldErrors"] & object;

export default function ChangePasswordForm({ username }: { username: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(new FormData(form)));

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await changePassword(parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? null);
        return;
      }

      // The change revoked every session, this one included: sign back in with the new password.
      const login = await signIn("credentials", {
        identifier: username,
        password: parsed.data.newPassword,
        redirect: false,
      });
      if (!login?.ok || login.error) {
        router.replace("/auth/login?restablecida=1");
        return;
      }

      form.reset();
      toast.success("Contraseña actualizada", { description: "Cerramos tu sesión en los demás dispositivos." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <FormAlert message={formError} />}

      <PasswordField
        label="Contraseña actual"
        name="currentPassword"
        autoComplete="current-password"
        required
        error={fieldErrors.currentPassword?.[0]}
      />

      <PasswordField
        label="Contraseña nueva"
        name="newPassword"
        autoComplete="new-password"
        required
        error={fieldErrors.newPassword?.[0]}
      />

      <p className="text-sm text-slate-500">
        Al cambiarla se cerrará tu sesión en los demás dispositivos. Usa al menos 8 caracteres.
      </p>

      <div className="sm:w-56">
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Cambiar contraseña
        </SubmitButton>
      </div>
    </form>
  );
}
