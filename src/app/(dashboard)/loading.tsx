function Block({ className }: { className: string }) {
  return <div className={`rounded-lg bg-slate-800/70 motion-safe:animate-pulse ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando tu progreso…</span>

      <div aria-hidden className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <Block className="size-8" />
            <Block className="h-3 w-20" />
            <Block className="h-8 w-16" />
            <Block className="h-3 w-40" />
          </div>
        ))}
      </div>

      <div aria-hidden className="mt-8 space-y-8">
        <div className="grid items-center gap-8 rounded-xl border border-slate-800 bg-slate-900/80 p-8 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Block className="size-12" />
            <div className="space-y-2">
              <Block className="h-9 w-32" />
              <Block className="h-4 w-24" />
            </div>
            <Block className="h-3 w-full rounded-full" />
            <Block className="h-3 w-56" />
          </div>
          <div className="flex justify-center">
            <Block className="size-36 rounded-full" />
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
