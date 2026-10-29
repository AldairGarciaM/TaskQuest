"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { resetPassword } from "@/app/auth/actions";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";

import FormAlert from "./FormAlert";
import PasswordField from "./PasswordField";
import SubmitButton from "./SubmitButton";

type FieldErrors = Partial<Record<keyof ResetPasswordInput, string[]>>;

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await resetPassword(token, parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? null);
        setExpired(Boolean(result.expired));
        return;
      }
      router.replace("/auth/login?restablecida=1");
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-50">Elige una contraseña nueva</h1>
        <p className="text-sm text-slate-400">Al guardarla se cerrará tu sesión en todos los dispositivos.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <FormAlert message={formError} />}

        <PasswordField
          label="Contraseña nueva"
          name="password"
          autoComplete="new-password"
          required
          error={fieldErrors.password?.[0]}
        />

        {expired ? (
          <Link
            href="/auth/recuperar"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Pedir un enlace nuevo
          </Link>
        ) : (
          <SubmitButton pending={pending} pendingLabel="Guardando…">
            Guardar contraseña
          </SubmitButton>
        )}
      </form>
    </div>
  );
}
