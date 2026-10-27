"use client";

import { Clock, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { revokeInvitation } from "@/app/actions/organizations";
import type { OrgRole } from "@/generated/prisma/enums";
import type { InvitationDTO } from "@/lib/data/organizations";
import { canInvite } from "@/lib/organizations/permissions";
import { cn } from "@/lib/utils";

import RoleBadge from "./RoleBadge";

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

interface PendingInvitationsProps {
  myRole: OrgRole;
  invitations: InvitationDTO[];
}

export default function PendingInvitations({ myRole, invitations }: PendingInvitationsProps) {
  const [pending, startTransition] = useTransition();

  function handleRevoke(invitation: InvitationDTO) {
    startTransition(async () => {
      const result = await revokeInvitation(invitation.id);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos cancelar la invitación.");
        return;
      }
      toast("Invitación cancelada", { description: invitation.email });
    });
  }

  if (invitations.length === 0) {
    return <p className="text-sm text-slate-500">No hay invitaciones pendientes.</p>;
  }

  return (
    <ul className="space-y-2">
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{invitation.email}</span>
          <RoleBadge role={invitation.role} />
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs tabular-nums",
              invitation.expired ? "text-rose-300" : "text-slate-500",
            )}
          >
            <Clock size={12} aria-hidden />
            {invitation.expired ? "Vencida" : `Vence ${dateFormatter.format(new Date(invitation.expiresAt))}`}
          </span>
          {canInvite(myRole, invitation.role) && (
            <button
              type="button"
              disabled={pending}
              aria-label={`Cancelar invitación de ${invitation.email}`}
              onClick={() => handleRevoke(invitation)}
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-800 hover:text-slate-200 active:scale-[0.95] disabled:opacity-60"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
