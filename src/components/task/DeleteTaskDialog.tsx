"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import type { TaskDTO } from "@/lib/data/dashboard";

interface DeleteTaskDialogProps {
  open: boolean;
  /** Kept after closing so the text doesn't vanish during the exit animation. */
  task: TaskDTO | null;
  onCancel: () => void;
  onConfirm: (task: TaskDTO) => void;
}

export default function DeleteTaskDialog({ open, task, onCancel, onConfirm }: DeleteTaskDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          <AlertDialog.Title className="text-lg font-bold">¿Eliminar esta misión?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm break-words text-slate-400">
            “{task?.title}” se eliminará para siempre.
            {task?.status === "COMPLETED" && " Conservarás la XP que ya ganaste con ella."}
          </AlertDialog.Description>

          <div className="mt-6 flex gap-3">
            <AlertDialog.Close className="h-10 flex-1 rounded-xl border border-slate-800 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-900 active:scale-[0.97]">
              Cancelar
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => task && onConfirm(task)}
              className="h-10 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-rose-500 active:scale-[0.97]"
            >
              Eliminar
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
