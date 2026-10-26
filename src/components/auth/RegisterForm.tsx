"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { registerUser } from "@/app/auth/actions";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

import AuthField from "./AuthField";
import FormAlert from "./FormAlert";
import PasswordField from "./PasswordField";
import SubmitButton from "./SubmitButton";

type FieldErrors = Partial<Record<keyof RegisterInput, string[]>>;

export default function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await registerUser(parsed.data);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? null);
        return;
      }

      const login = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      // The account exists even if the automatic login fails; send them to log in manually.
      router.replace(login?.ok ? "/" : "/auth/login?registered=1");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-50">Crea tu personaje</h1>
        <p className="text-sm text-slate-400">Empiezas en nivel 1. Cada tarea completada suma XP.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <FormAlert message={formError} />}

        <AuthField
          label="Nombre"
          name="name"
          autoComplete="name"
          placeholder="¿Cómo te llamamos?"
          required
          error={fieldErrors.name?.[0]}
        />

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
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
          error={fieldErrors.password?.[0]}
        />

        <SubmitButton pending={pending} pendingLabel="Creando cuenta…">
          Comenzar aventura
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
