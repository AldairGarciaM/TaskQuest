"use client";

import { Mail } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptMyInvitation, declineMyInvitation } from "@/app/actions/invitations";
import type { MyInvitation } from "@/lib/data/organizations";

import RoleBadge from "./RoleBadge";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const expiryFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/** Invitations to my email, accepted or turned down right here instead of from the email link. */
export default function MyInvitations({ invitations }: { invitations: MyInvitation[] }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  /** The invitation whose button was pressed, to show which one is working. */
  const [busyId, setBusyId] = useState<string | null>(null);

  function respond(invitation: MyInvitation, accept: boolean) {
    setBusyId(invitation.id);
    startTransition(async () => {
      if (accept) {
        const result = await acceptMyInvitation(invitation.id);
        if (!result.ok) {
          toast.error(result.error ?? "No pudimos aceptar la invitación.");
          router.refresh();
          return;
        }
        toast.success(`Te uniste a “${invitation.organizationName}”`);
        router.push(`/organizaciones/${result.slug}`);
        return;
      }
      const result = await declineMyInvitation(invitation.id);
      if (!result.ok) toast.error(result.error ?? "No pudimos rechazar la invitación.");
      else toast("Invitación rechazada", { description: invitation.organizationName });
      router.refresh();
    });
  }

  return (
    <section id="invitaciones" aria-labelledby="invitations-heading" className="scroll-mt-6 space-y-4">
      <h2 id="invitations-heading" className="text-sm font-medium tracking-wide text-slate-400 uppercase">
        Invitaciones para ti
      </h2>
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {invitations.map((invitation) => {
            const busy = pending && busyId === invitation.id;
            return (
              <motion.li
                key={invitation.id}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] px-5 py-4"
              >
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-200"
                >
                  <Mail size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-slate-100">{invitation.organizationName}</span>
                    <RoleBadge role={invitation.role} />
                  </span>
                  <span className="text-sm text-slate-400">
                    {invitation.inviterName ? `${invitation.inviterName} te invitó` : "Te invitaron"} · vence el{" "}
                    {expiryFormatter.format(new Date(invitation.expiresAt))}
                  </span>
                </span>
                <span className="flex w-full gap-2 sm:w-auto">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => respond(invitation, false)}
                    className="h-10 flex-1 rounded-xl border border-slate-800 px-4 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97] disabled:opacity-60 sm:flex-none"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-busy={busy}
                    onClick={() => respond(invitation, true)}
                    className="h-10 flex-1 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-emerald-500 active:scale-[0.97] disabled:opacity-60 sm:flex-none"
                  >
                    Aceptar
                  </button>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
