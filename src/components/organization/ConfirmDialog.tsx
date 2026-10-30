"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  /** "danger" for destructive actions (default), "primary" for plain confirmations. */
  tone?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmation dialog, same look as DeleteTaskDialog. */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  tone = "danger",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl transition-[opacity,scale] duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          <AlertDialog.Title className="text-lg font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm break-words text-slate-400">
            {description}
          </AlertDialog.Description>

          <div className="mt-6 flex gap-3">
            <AlertDialog.Close className="h-10 flex-1 rounded-xl border border-slate-800 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-900 active:scale-[0.97]">
              Cancelar
            </AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending}
              className={cn(
                "h-10 flex-1 rounded-xl text-sm font-semibold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-70",
                tone === "danger" ? "bg-rose-600 hover:bg-rose-500" : "bg-violet-600 hover:bg-violet-500",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
