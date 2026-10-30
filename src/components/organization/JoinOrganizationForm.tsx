"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { joinOrganizationByCode } from "@/app/actions/organizations";
import { joinOrganizationSchema, type JoinFieldErrors } from "@/lib/validations/organization";

import FormField from "@/components/form/FormField";

export default function JoinOrganizationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<JoinFieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = joinOrganizationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await joinOrganizationByCode(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.error) toast.error(result.error);
        return;
      }
      if (result.alreadyMember) toast.info(`Ya eres miembro de ${result.name}`);
      else toast.success(`Te uniste a ${result.name}`, { description: "Entraste como miembro." });
      router.push(`/organizaciones/${result.slug}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 @md:flex-row @md:items-start">
      <div className="flex-1">
        <FormField
          label="Código de la organización"
          name="code"
          placeholder="ABCD-2345"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          required
          error={errors.code?.[0]}
          className="font-mono tracking-[0.2em] uppercase placeholder:tracking-[0.2em]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 text-sm font-semibold text-slate-100 transition-[background-color,transform] duration-150 hover:bg-slate-700 active:scale-[0.97] disabled:opacity-70 @md:mt-7"
      >
        <LogIn size={16} aria-hidden />
        {pending ? "Uniéndote…" : "Unirse"}
      </button>
    </form>
  );
}
