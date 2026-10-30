"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { updateProfile, type UpdateProfileResult } from "@/app/actions/account";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/auth";

import FormAlert from "@/components/auth/FormAlert";
import SubmitButton from "@/components/auth/SubmitButton";
import FormField from "@/components/form/FormField";
import ConfirmDialog from "@/components/organization/ConfirmDialog";

type FieldErrors = Extract<UpdateProfileResult, { ok: false }>["fieldErrors"] & object;

export default function EditProfileForm({ profile }: { profile: UpdateProfileInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Validated values waiting for the user to confirm.
  const [draft, setDraft] = useState<UpdateProfileInput | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const unchanged = (Object.keys(parsed.data) as (keyof UpdateProfileInput)[]).every(
      (key) => parsed.data[key] === profile[key],
    );
    if (unchanged) {
      toast.info("No hay cambios que guardar");
      return;
    }

    setDraft(parsed.data);
  }

  function handleConfirm() {
    if (!draft) return;

    startTransition(async () => {
      const result = await updateProfile(draft);
      setDraft(null);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? null);
        return;
      }

      toast.success("Datos actualizados");
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <FormAlert message={formError} />}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Nombre"
            name="firstName"
            autoComplete="given-name"
            defaultValue={profile.firstName}
            required
            error={fieldErrors.firstName?.[0]}
          />
          <FormField
            label="Apellidos"
            name="lastName"
            autoComplete="family-name"
            defaultValue={profile.lastName}
            required
            error={fieldErrors.lastName?.[0]}
          />
        </div>

        <FormField
          label="Nombre de usuario"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={profile.username}
          required
          error={fieldErrors.username?.[0]}
        />

        <FormField
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={profile.email}
          required
          error={fieldErrors.email?.[0]}
        />

        <div className="sm:w-56">
          <SubmitButton pending={pending} pendingLabel="Guardando…">
            Guardar cambios
          </SubmitButton>
        </div>
      </form>

      <ConfirmDialog
        open={draft !== null}
        tone="primary"
        title="¿Guardar los cambios?"
        description="Se actualizarán los datos de tu cuenta. Si cambiaste tu correo o tu usuario, úsalos la próxima vez que inicies sesión."
        confirmLabel="Sí, guardar"
        pending={pending}
        onCancel={() => setDraft(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
