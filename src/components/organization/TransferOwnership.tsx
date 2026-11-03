"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Crown } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { transferOwnership } from "@/app/actions/organizations";
import type { MemberDTO } from "@/lib/data/organizations";
import { confirmsName } from "@/lib/validations/organization";
import { cn } from "@/lib/utils";

import RoleBadge from "./RoleBadge";

interface TransferOwnershipProps {
  organizationId: string;
  organizationName: string;
  myUserId: string;
  members: MemberDTO[];
}

/** The owner hands the organization to another member and stays on as an admin. */
export default function TransferOwnership({ organizationId, organizationName, myUserId, members }: TransferOwnershipProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const candidates = members
    .filter((m) => m.userId !== myUserId)
    // Admins first: they already help run it.
    .sort((a, b) => Number(b.role === "ADMIN") - Number(a.role === "ADMIN"));

  return (
    <section aria-labelledby="transfer-heading" className="space-y-3 rounded-xl border border-yellow-300/20 p-5">
      <div>
        <h2 id="transfer-heading" className="font-semibold text-yellow-100">
          Transferir propiedad
        </h2>
        <p className="text-sm text-slate-400">
          {candidates.length === 0
            ? "Primero agrega a alguien: solo puedes pasársela a un miembro."
            : "Otra persona del equipo pasa a ser dueña. Tú te quedas como admin."}
        </p>
      </div>
      <button
        type="button"
        disabled={candidates.length === 0}
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
        className="flex h-10 items-center gap-2 rounded-xl border border-yellow-300/40 px-4 text-sm font-medium text-yellow-100 transition-[background-color,transform] duration-150 hover:bg-yellow-300/10 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
      >
        <Crown size={16} aria-hidden />
        Transferir
      </button>

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
            {/* Keyed so each opening starts empty. */}
            <TransferForm
              key={formKey}
              organizationId={organizationId}
              organizationName={organizationName}
              candidates={candidates}
              onDone={() => setOpen(false)}
            />
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

function TransferForm({
  organizationId,
  organizationName,
  candidates,
  onDone,
}: {
  organizationId: string;
  organizationName: string;
  candidates: MemberDTO[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(candidates.length === 1 ? candidates[0].userId : null);
  const [typed, setTyped] = useState("");
  const chosen = candidates.find((m) => m.userId === selected);
  const ready = chosen !== undefined && confirmsName(typed, organizationName);

  function handleSubmit() {
    if (!chosen || !ready) return;
    startTransition(async () => {
      const result = await transferOwnership(organizationId, chosen.userId, typed);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos transferir la organización.");
        return;
      }
      onDone();
      toast.success(`Transferiste “${organizationName}” a ${chosen.firstName}`, {
        description: "Ahora eres admin. Le avisamos con una notificación.",
      });
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <AlertDialog.Title className="text-lg font-bold">Transferir “{organizationName}”</AlertDialog.Title>
      <AlertDialog.Description className="mt-2 text-sm break-words text-slate-400">
        La nueva persona dueña podrá eliminar la organización, cambiar roles y quitar a cualquiera, incluido tú. Solo
        ella podrá devolvértela.
      </AlertDialog.Description>

      <fieldset className="mt-5 space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-300">Nueva persona dueña</legend>
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {candidates.map((member) => {
            const checked = selected === member.userId;
            return (
              <label
                key={member.userId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-[background-color,border-color] duration-150 has-focus-visible:ring-2 has-focus-visible:ring-yellow-300/40",
                  checked ? "border-yellow-300/60 bg-yellow-300/[0.06]" : "border-slate-800 hover:bg-slate-900",
                )}
              >
                <input
                  type="radio"
                  name="new-owner"
                  value={member.userId}
                  checked={checked}
                  onChange={() => setSelected(member.userId)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
                >
                  {member.firstName[0]}
                  {member.lastName[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">@{member.username}</span>
                </span>
                <RoleBadge role={member.role} />
              </label>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="transfer-confirm" className="mt-5 block text-sm text-slate-300">
        Escribe <span className="font-semibold break-words text-slate-100">{organizationName}</span> para confirmar
      </label>
      <input
        id="transfer-confirm"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        className="mt-2 h-11 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 text-sm text-slate-100 outline-none transition-[border-color,box-shadow] duration-150 focus:border-yellow-300/70 focus:ring-2 focus:ring-yellow-300/20"
      />

      <div className="mt-6 flex gap-3">
        <AlertDialog.Close className="h-10 flex-1 rounded-xl border border-slate-800 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-900 active:scale-[0.97]">
          Cancelar
        </AlertDialog.Close>
        <button
          type="submit"
          disabled={pending || !ready}
          aria-busy={pending}
          className="h-10 flex-1 rounded-xl bg-yellow-400 text-sm font-semibold text-slate-950 transition-[background-color,transform] duration-150 hover:bg-yellow-300 active:scale-[0.97] disabled:opacity-50"
        >
          Transferir
        </button>
      </div>
    </form>
  );
}
