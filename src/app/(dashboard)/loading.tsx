function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-slate-800/70 motion-safe:animate-pulse ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando tu progreso…</span>

      <div aria-hidden className="space-y-8">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:p-8">
            <Block className="mx-auto size-36 shrink-0 rounded-full sm:mx-0" />
            <div className="flex-1 space-y-5">
              <div className="space-y-2">
                <Block className="h-4 w-24" />
                <Block className="h-9 w-56" />
              </div>
              <Block className="h-2.5 w-full rounded-full" />
              <Block className="h-4 w-full max-w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-3 bg-slate-900 p-5">
                <Block className="h-4 w-24" />
                <Block className="h-7 w-14" />
                <Block className="h-3 w-full max-w-36" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Block className="h-6 w-28" />
            <Block className="h-10 w-40 rounded-xl" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 pl-8">
              <div className="flex items-start gap-4">
                <Block className="size-5 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Block className="h-5 w-2/3" />
                  <Block className="h-3 w-1/2" />
                </div>
                <Block className="h-6 w-16" />
              </div>
              <Block className="ml-9 h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
