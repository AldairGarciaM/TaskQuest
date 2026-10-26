"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto mt-16 flex max-w-md flex-col items-center rounded-2xl border border-slate-800 bg-slate-900 px-8 py-12 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
        <TriangleAlert className="size-7" aria-hidden />
      </span>

      <h2 className="mt-6 text-xl font-bold text-slate-50">No pudimos cargar tu progreso</h2>
      <p className="mt-2 text-sm text-slate-400">
        Algo falló al leer tus misiones. Tus datos están a salvo; intenta de nuevo en un momento.
      </p>

      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-8 flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97]"
      >
        <RotateCcw size={16} aria-hidden /> Reintentar
      </button>

      {error.digest && (
        <p className="mt-6 font-mono text-xs text-slate-600">Código: {error.digest}</p>
      )}
    </div>
  );
}
