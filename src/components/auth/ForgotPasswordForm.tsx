"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { requestPasswordReset } from "@/app/auth/actions";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";

import FormField from "@/components/form/FormField";
import FormAlert from "./FormAlert";
import SubmitButton from "./SubmitButton";

type FieldErrors = Partial<Record<keyof ForgotPasswordInput, string[]>>;

const linkClass = "font-medium text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline";

export default function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await requestPasswordReset(parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? null);
        return;
      }
      setSentTo(parsed.data.email);
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-8">
        <header className="space-y-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
            <MailCheck size={24} aria-hidden />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">Revisa tu correo</h1>
          <p role="status" className="text-sm text-pretty text-slate-400">
            Si <span className="font-medium text-slate-200">{sentTo}</span> tiene una cuenta, te enviamos un enlace
            para elegir una contraseña nueva. Vence en una hora y solo funciona una vez.
          </p>
        </header>

        <p className="text-sm text-slate-400">
          ¿No llegó? Revisa la carpeta de spam o{" "}
          <button type="button" onClick={() => setSentTo(null)} className={linkClass}>
            pide otro enlace
          </button>
          .
        </p>

        <p className="text-center text-sm text-slate-400">
          <Link href="/auth/login" className={linkClass}>
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-50">Recupera tu cuenta</h1>
        <p className="text-sm text-slate-400">Escribe el correo de tu cuenta y te enviaremos un enlace.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <FormAlert message={formError} />}

        <FormField
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu@correo.com"
          required
          error={fieldErrors.email?.[0]}
        />

        <SubmitButton pending={pending} pendingLabel="Enviando…">
          Enviar enlace
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-slate-400">
        ¿Ya la recordaste?{" "}
        <Link href="/auth/login" className={linkClass}>
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
