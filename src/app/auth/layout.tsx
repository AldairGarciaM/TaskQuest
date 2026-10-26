import { DifficultyStyles, type Difficulty } from "@/app/constants/taskDifficulty";

const sampleQuests: { title: string; difficulty: Difficulty; xp: number; done: boolean }[] = [
  { title: "Responder correos pendientes", difficulty: "Fácil", xp: 10, done: true },
  { title: "Terminar el reporte mensual", difficulty: "Difícil", xp: 50, done: true },
  { title: "Preparar la presentación del lunes", difficulty: "Épica", xp: 100, done: false },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-slate-950 text-slate-100 lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800 bg-slate-900 p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(148_163_184/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_184/0.06)_1px,transparent_1px)] bg-size-[32px_32px] mask-[radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
        />

        <p className="relative text-2xl font-bold">⚔️ TaskQuest</p>

        <div className="relative max-w-md space-y-10">
          <h2 className="text-4xl leading-tight font-bold text-balance">
            Tu lista de pendientes, <span className="text-yellow-300">convertida en aventura.</span>
          </h2>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">Registro de misiones</span>
              <span className="text-sm font-semibold text-yellow-300">Nivel 3</span>
            </div>

            <ul className="space-y-3">
              {sampleQuests.map((quest) => {
                const style = DifficultyStyles[quest.difficulty];
                const Icon = style.icon;
                return (
                  <li key={quest.title} className="flex items-center gap-3 text-sm">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${style.badge}`}>
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className={quest.done ? "flex-1 text-slate-500 line-through" : "flex-1 text-slate-200"}>
                      {quest.title}
                    </span>
                    <span className={quest.done ? "text-slate-500" : "font-semibold text-violet-300"}>
                      +{quest.xp} XP
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-2 pt-2">
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[60%] rounded-full bg-linear-to-r from-violet-600 to-yellow-300" />
              </div>
              <p className="text-xs text-slate-500">60 / 100 XP para el nivel 4</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-slate-600">
          Completa tareas, gana XP y mantén tu racha.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm transition-[opacity,translate] duration-300 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0">
          <p className="mb-10 text-xl font-bold lg:hidden">⚔️ TaskQuest</p>
          {children}
        </div>
      </main>
    </div>
  );
}
