"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Crown, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import { getTaskReviewers, type ReviewerOption } from "@/app/actions/org-tasks";
import type { OrgTaskDTO } from "@/lib/data/org-board";
import { cn } from "@/lib/utils";

interface ChooseReviewerDialogProps {
  open: boolean;
  task: OrgTaskDTO | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reviewerId: string) => void;
}

/** A member picks which owner or admin reviews a task they took from the pool. */
export default function ChooseReviewerDialog({ open, task, pending, onCancel, onConfirm }: ChooseReviewerDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          {/* Keyed so each task loads its own organization's reviewers. */}
          {task && <ReviewerForm key={task.id} task={task} pending={pending} onConfirm={onConfirm} />}
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; reviewers: ReviewerOption[] };

function ReviewerForm({
  task,
  pending,
  onConfirm,
}: {
  task: OrgTaskDTO;
  pending: boolean;
  onConfirm: (reviewerId: string) => void;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTaskReviewers(task.id).then(
      (result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoad({ state: "error", message: result.error ?? "No pudimos cargar a los revisores." });
          return;
        }
        setLoad({ state: "ready", reviewers: result.reviewers });
        // With a single option there's nothing to choose.
        if (result.reviewers.length === 1) setSelected(result.reviewers[0].userId);
      },
      () => !cancelled && setLoad({ state: "error", message: "No pudimos cargar a los revisores." }),
    );
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (selected) onConfirm(selected);
      }}
    >
      <AlertDialog.Title className="text-lg font-bold">¿Quién la revisa?</AlertDialog.Title>
      <AlertDialog.Description className="mt-2 text-sm break-words text-slate-400">
        Elige a quién enviarle “{task.title}”. Le llegará un aviso para revisarla y recibirás {task.xpReward} XP cuando
        la apruebe.
      </AlertDialog.Description>

      <fieldset className="mt-5 space-y-2" aria-busy={load.state === "loading"}>
        <legend className="sr-only">Revisor</legend>
        {load.state === "loading" &&
          [0, 1].map((i) => <div key={i} aria-hidden className="h-14 animate-pulse rounded-xl bg-slate-900" />)}
        {load.state === "error" && <p className="text-sm text-rose-400">{load.message}</p>}
        {load.state === "ready" && load.reviewers.length === 0 && (
          <p className="text-sm text-slate-400">No hay dueños ni admins disponibles para revisarla.</p>
        )}
        {load.state === "ready" &&
          load.reviewers.map((reviewer) => {
            const RoleIcon = reviewer.role === "OWNER" ? Crown : Shield;
            const checked = selected === reviewer.userId;
            return (
              <label
                key={reviewer.userId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-[background-color,border-color] duration-150",
                  checked ? "border-violet-500 bg-violet-500/10" : "border-slate-800 hover:bg-slate-900",
                  "has-focus-visible:ring-2 has-focus-visible:ring-violet-500/40",
                )}
              >
                <input
                  type="radio"
                  name="reviewer"
                  value={reviewer.userId}
                  checked={checked}
                  onChange={() => setSelected(reviewer.userId)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
                >
                  {reviewer.firstName[0]}
                  {reviewer.lastName[0]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {reviewer.firstName} {reviewer.lastName}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <RoleIcon size={13} aria-hidden className={reviewer.role === "OWNER" ? "text-yellow-300" : "text-sky-300"} />
                  {reviewer.role === "OWNER" ? "Dueño" : "Admin"}
                </span>
              </label>
            );
          })}
      </fieldset>

      <div className="mt-6 flex gap-3">
        <AlertDialog.Close className="h-10 flex-1 rounded-xl border border-slate-800 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-900 active:scale-[0.97]">
          Cancelar
        </AlertDialog.Close>
        <button
          type="submit"
          disabled={pending || !selected}
          aria-busy={pending}
          className="h-10 flex-1 rounded-xl bg-violet-600 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97] disabled:opacity-60"
        >
          Enviar a revisión
        </button>
      </div>
    </form>
  );
}
