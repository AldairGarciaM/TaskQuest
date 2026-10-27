"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptInvitation } from "@/app/actions/invitations";

import FormAlert from "@/components/auth/FormAlert";
import SubmitButton from "@/components/auth/SubmitButton";

export default function AcceptInvitationButton({ token, organizationName }: { token: string; organizationName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation(token);
      if (!result.ok) {
        setError(result.error ?? "No pudimos aceptar la invitación.");
        return;
      }
      toast.success(`Te uniste a ${organizationName}`);
      router.replace(`/organizaciones/${result.slug}`);
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleAccept();
      }}
    >
      {error && <FormAlert message={error} />}
      <SubmitButton pending={pending} pendingLabel="Uniéndote…">
        Unirme a {organizationName}
      </SubmitButton>
    </form>
  );
}
