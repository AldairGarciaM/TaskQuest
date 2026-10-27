"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { acceptInvitationWithSignup } from "@/app/actions/invitations";
import type { ProfileFieldErrors } from "@/lib/user";
import { profileSchema } from "@/lib/validations/auth";

import FormAlert from "@/components/auth/FormAlert";
import ProfileFields from "@/components/auth/ProfileFields";
import SubmitButton from "@/components/auth/SubmitButton";
import FormField from "@/components/form/FormField";

interface InvitationSignupFormProps {
  token: string;
  email: string;
}

export default function InvitationSignupForm({ token, email }: InvitationSignupFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await acceptInvitationWithSignup(token, parsed.data);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? null);
        return;
      }

      const login = await signIn("credentials", {
        identifier: result.email,
        password: parsed.data.password,
        redirect: false,
      });

      const destination = `/organizaciones/${result.slug}`;
      // The account exists even if the automatic login fails; log in manually and land on the team.
      router.replace(login?.ok ? destination : `/auth/login?registered=1&callbackUrl=${encodeURIComponent(destination)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <FormAlert message={formError} />}

      <ProfileFields
        errors={fieldErrors}
        beforePassword={
          // Not submitted: the server always uses the invited email.
          <FormField label="Correo" type="email" value={email} readOnly disabled className="opacity-70" />
        }
      />

      <SubmitButton pending={pending} pendingLabel="Creando cuenta…">
        Crear cuenta y unirme
      </SubmitButton>
    </form>
  );
}
