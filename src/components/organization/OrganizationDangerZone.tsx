"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteOrganization, leaveOrganization } from "@/app/actions/organizations";
import type { OrgRole } from "@/generated/prisma/enums";
import { canDeleteOrganization, canLeave } from "@/lib/organizations/permissions";

import ConfirmDialog from "./ConfirmDialog";

interface OrganizationDangerZoneProps {
  organizationId: string;
  organizationName: string;
  myRole: OrgRole;
}

export default function OrganizationDangerZone({ organizationId, organizationName, myRole }: OrganizationDangerZoneProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const isDelete = canDeleteOrganization(myRole);

  if (!isDelete && !canLeave(myRole)) return null;

  function handleConfirm() {
    startTransition(async () => {
      const result = isDelete ? await deleteOrganization(organizationId) : await leaveOrganization(organizationId);
      if (!result.ok) {
        setOpen(false);
        toast.error(result.error ?? "Algo salió mal. Intenta de nuevo.");
        return;
      }
      toast(isDelete ? "Organización eliminada" : "Saliste de la organización", { description: organizationName });
      router.replace("/organizaciones");
    });
  }

  const Icon = isDelete ? Trash2 : LogOut;

  return (
    <section aria-labelledby="danger-heading" className="space-y-3 rounded-xl border border-rose-500/20 p-5">
      <div>
        <h2 id="danger-heading" className="font-semibold text-rose-200">
          {isDelete ? "Eliminar organización" : "Salir de la organización"}
        </h2>
        <p className="text-sm text-slate-400">
          {isDelete
            ? "Se borran sus miembros e invitaciones. La XP personal de cada quien se conserva."
            : "Perderás el acceso hasta que te vuelvan a invitar. Conservas tu XP."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-rose-500/40 px-4 text-sm font-medium text-rose-200 transition-[background-color,transform] duration-150 hover:bg-rose-500/10 active:scale-[0.97]"
      >
        <Icon size={16} aria-hidden />
        {isDelete ? "Eliminar" : "Salir"}
      </button>

      <ConfirmDialog
        open={open}
        title={isDelete ? `¿Eliminar “${organizationName}”?` : `¿Salir de “${organizationName}”?`}
        description={isDelete ? "Esta acción no se puede deshacer." : "Necesitarás una nueva invitación para volver."}
        confirmLabel={isDelete ? "Eliminar" : "Salir"}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
