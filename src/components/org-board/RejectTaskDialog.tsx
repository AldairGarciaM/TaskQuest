"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState } from "react";

import type { OrgTaskDTO } from "@/lib/data/org-board";
import { REVIEW_NOTE_MAX } from "@/lib/validations/task";

interface RejectTaskDialogProps {
  open: boolean;
  task: OrgTaskDTO | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

/** A reviewer sends a task back to its assignee with an optional note on what to change. */
export default function RejectTaskDialog({ open, task, pending, onCancel, onConfirm }: RejectTaskDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          {/* Keyed so each task starts with an empty note. */}
          <RejectForm key={task?.id} task={task} pending={pending} onConfirm={onConfirm} />
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function RejectForm({
  task,
  pending,
  onConfirm,
}: {
  task: OrgTaskDTO | null;
  pending: boolean;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(note);
      }}
    >
      <AlertDialog.Title className="text-lg font-bold">Pedir cambios</AlertDialog.Title>
      <AlertDialog.Description className="mt-2 text-sm break-words text-slate-400">
        “{task?.title}” vuelve a pendientes{task?.assignee ? ` con ${task.assignee.firstName}` : ""}. No se paga XP
        hasta que la apruebes.
      </AlertDialog.Description>

      <label htmlFor="review-note" className="mt-5 block text-sm font-medium text-slate-300">
        ¿Qué falta? (opcional)
      </label>
      <textarea
        id="review-note"
        rows={3}
        maxLength={REVIEW_NOTE_MAX}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Ej. Falta adjuntar el enlace al diseño final"
        className="mt-2 w-full resize-none rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
      />
      <p className="mt-1 text-right text-xs text-slate-500 tabular-nums">
        {note.length}/{REVIEW_NOTE_MAX}
      </p>

      <div className="mt-4 flex gap-3">
        <AlertDialog.Close className="h-10 flex-1 rounded-xl border border-slate-800 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-900 active:scale-[0.97]">
          Cancelar
        </AlertDialog.Close>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="h-10 flex-1 rounded-xl bg-amber-500 text-sm font-semibold text-slate-950 transition-[background-color,transform] duration-150 hover:bg-amber-400 active:scale-[0.97] disabled:opacity-70"
        >
          Devolver tarea
        </button>
      </div>
    </form>
  );
}
