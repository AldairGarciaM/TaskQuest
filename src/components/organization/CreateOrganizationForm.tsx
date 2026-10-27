"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createOrganization } from "@/app/actions/organizations";
import { createOrganizationSchema, type OrganizationFieldErrors } from "@/lib/validations/organization";

import FormField from "@/components/form/FormField";

export default function CreateOrganizationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<OrganizationFieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createOrganizationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await createOrganization(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.error) toast.error(result.error);
        return;
      }
      toast.success("Organización creada", { description: parsed.data.name });
      router.push(`/organizaciones/${result.slug}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <FormField
          label="Nombre de la organización"
          name="name"
          placeholder="ej. Equipo de diseño"
          maxLength={60}
          required
          error={errors.name?.[0]}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97] disabled:opacity-70 sm:mt-7"
      >
        <Plus size={16} aria-hidden />
        {pending ? "Creando…" : "Crear"}
      </button>
    </form>
  );
}
