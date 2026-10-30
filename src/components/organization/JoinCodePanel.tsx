"use client";

import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { disableJoinCode, regenerateJoinCode } from "@/app/actions/organizations";

import ConfirmDialog from "./ConfirmDialog";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface JoinCodePanelProps {
  organizationId: string;
  /** "ABCD-2345", or null while joining by code is off. */
  code: string | null;
}

/** Owners and admins turn the join code on, copy it, replace it or turn it off. */
export default function JoinCodePanel({ organizationId, code }: JoinCodePanelProps) {
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"regenerate" | "disable" | null>(null);
  const [copied, setCopied] = useState(false);

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateJoinCode(organizationId);
      setConfirm(null);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos generar el código.");
        return;
      }
      setCopied(false);
      toast.success(code ? "Código nuevo listo" : "Código activado", {
        description: code ? "El anterior ya no funciona." : result.code,
      });
    });
  }

  function disable() {
    startTransition(async () => {
      const result = await disableJoinCode(organizationId);
      setConfirm(null);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos desactivar el código.");
        return;
      }
      toast.success("Código desactivado", { description: "Ya nadie puede unirse con él." });
    });
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast.error("No pudimos copiar el código; cópialo a mano.");
    }
  }

  if (!code) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-slate-800 p-4 @sm:flex-row @sm:items-center">
        <p className="flex-1 text-sm text-slate-400">
          Desactivado. Al activarlo, cualquiera con el código puede unirse como miembro desde «Organizaciones».
        </p>
        <button
          type="button"
          onClick={regenerate}
          disabled={pending}
          aria-busy={pending}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97] disabled:opacity-70"
        >
          <KeyRound size={16} aria-hidden />
          {pending ? "Activando…" : "Activar código"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 @sm:flex-row @sm:items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.output
            key={code}
            aria-label="Código para unirse"
            initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="flex-1 font-mono text-2xl font-semibold tracking-[0.25em] text-slate-50 tabular-nums select-all"
          >
            {code}
          </motion.output>
        </AnimatePresence>
        <button
          type="button"
          onClick={copy}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <button
          type="button"
          onClick={() => setConfirm("regenerate")}
          className="flex items-center gap-1.5 text-slate-400 underline-offset-4 transition-colors duration-150 hover:text-slate-200 hover:underline"
        >
          <RefreshCw size={14} aria-hidden /> Generar otro
        </button>
        <button
          type="button"
          onClick={() => setConfirm("disable")}
          className="text-rose-300/80 underline-offset-4 transition-colors duration-150 hover:text-rose-200 hover:underline"
        >
          Desactivar
        </button>
      </div>

      <ConfirmDialog
        open={confirm === "regenerate"}
        tone="primary"
        title="¿Generar otro código?"
        description="El código actual dejará de funcionar. Quienes ya se unieron siguen en la organización."
        confirmLabel="Generar"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={regenerate}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        title="¿Desactivar el código?"
        description="Nadie podrá unirse con él. Puedes activar uno nuevo cuando quieras."
        confirmLabel="Desactivar"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={disable}
      />
    </div>
  );
}
