"use client";

import { Check, Copy, Send } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { inviteMember } from "@/app/actions/organizations";
import { ROLE_LABELS, type AssignableRole } from "@/lib/organizations/permissions";
import { inviteMemberSchema, type InviteFieldErrors } from "@/lib/validations/organization";

import FormField from "@/components/form/FormField";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface InviteMemberFormProps {
  organizationId: string;
  roles: AssignableRole[];
}

export default function InviteMemberForm({ organizationId, roles }: InviteMemberFormProps) {
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<InviteFieldErrors>({});
  const [sent, setSent] = useState<{ email: string; url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = inviteMemberSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await inviteMember(organizationId, parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.error) toast.error(result.error);
        return;
      }
      form.reset();
      setCopied(false);
      setSent({ email: parsed.data.email, url: result.url, emailed: result.emailed });
      toast.success(result.emailed ? "Invitación enviada" : "Invitación creada", {
        description: result.emailed ? parsed.data.email : "No hay correo configurado: comparte el enlace.",
      });
    });
  }

  async function copyLink() {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.url);
      setCopied(true);
    } catch {
      toast.error("No pudimos copiar el enlace; cópialo a mano.");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} noValidate className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start">
        <FormField
          label="Correo"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="persona@correo.com"
          required
          error={errors.email?.[0]}
        />

        {roles.length > 1 ? (
          <div className="space-y-2">
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-300">
              Rol
            </label>
            <select
              id="invite-role"
              name="role"
              defaultValue="MEMBER"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 sm:w-36"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="role" value={roles[0]} />
        )}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97] disabled:opacity-70 sm:mt-7"
        >
          <Send size={16} aria-hidden />
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </form>

      <AnimatePresence initial={false}>
        {sent && (
          <motion.div
            key={sent.url}
            initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <p className="text-sm text-slate-300">
              {sent.emailed ? "Enviamos la invitación a " : "Comparte este enlace con "}
              <span className="font-medium text-slate-100">{sent.email}</span>. Vence en 7 días.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={sent.url}
                aria-label="Enlace de invitación"
                onFocus={(event) => event.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 font-mono text-xs text-slate-300 outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
              >
                {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
