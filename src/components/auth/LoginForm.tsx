"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { loginSchema, type LoginInput } from "@/lib/validations/auth";

import AuthField from "./AuthField";
import FormAlert from "./FormAlert";
import PasswordField from "./PasswordField";
import SubmitButton from "./SubmitButton";

type FieldErrors = Partial<Record<keyof LoginInput, string[]>>;

interface LoginFormProps {
  callbackUrl: string;
  registered?: boolean;
}

export default function LoginForm({ callbackUrl, registered = false }: LoginFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await signIn("credentials", { ...parsed.data, redirect: false });

      if (!result?.ok) {
        setFormError("Correo o contraseña incorrectos.");
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-50">Continúa tu aventura</h1>
        <p className="text-sm text-slate-400">Inicia sesión para retomar tus misiones.</p>
      </header>

      {registered && !formError && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          Cuenta creada. Inicia sesión para empezar.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <FormAlert message={formError} />}

        <AuthField
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          required
          error={fieldErrors.email?.[0]}
        />

        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          required
          error={fieldErrors.password?.[0]}
        />

        <SubmitButton pending={pending} pendingLabel="Entrando…">
          Iniciar sesión
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-slate-400">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href="/auth/register"
          className="font-medium text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline"
        >
          Crea tu personaje
        </Link>
      </p>
    </div>
  );
}
