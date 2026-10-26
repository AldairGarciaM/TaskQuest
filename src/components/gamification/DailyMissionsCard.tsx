import { AlarmClock, Check, ListChecks, Shapes, Swords, type LucideIcon } from "lucide-react";

import type { DailyMissionType } from "@/generated/prisma/enums";
import type { DailyMissionView } from "@/lib/gamification/server";
import { cn } from "@/lib/utils";

const ICONS: Record<DailyMissionType, LucideIcon> = {
  COMPLETE_TASKS: ListChecks,
  COMPLETE_HARD: Swords,
  COMPLETE_ON_TIME: AlarmClock,
  COMPLETE_VARIETY: Shapes,
};

export default function DailyMissionsCard({ missions }: { missions: DailyMissionView[] }) {
  const done = missions.filter((m) => m.rewarded).length;

  return (
    <section aria-labelledby="daily-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="daily-heading" className="text-xl font-bold">
          Misiones diarias
        </h2>
        <p className="text-sm text-slate-400">
          <span className="tabular-nums">
            {done}/{missions.length}
          </span>{" "}
          completadas · se renuevan a medianoche
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {missions.map((mission) => {
          const Icon = ICONS[mission.type];
          const percent = (mission.progress / mission.target) * 100;

          return (
            <li
              key={mission.type}
              className={cn(
                "flex flex-col gap-4 rounded-xl border bg-slate-900 p-5 transition-colors duration-300",
                mission.rewarded ? "border-emerald-500/40" : "border-slate-800",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-xl",
                    mission.rewarded ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-300",
                  )}
                >
                  <Icon size={20} aria-hidden />
                </span>

                {mission.rewarded ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    <Check size={14} aria-hidden /> +{mission.xpReward} XP cobrados
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-300/10 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                    +{mission.xpReward} XP
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="font-semibold text-amber-100">{mission.title}</h3>
                <p className="text-sm text-slate-400">{mission.description}</p>
              </div>

              <div className="mt-auto space-y-2">
                <div
                  role="progressbar"
                  aria-label={`Progreso de ${mission.title}`}
                  aria-valuemin={0}
                  aria-valuemax={mission.target}
                  aria-valuenow={mission.progress}
                  className="h-2 overflow-hidden rounded-full bg-slate-800"
                >
                  <div
                    className={cn(
                      "h-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                      mission.rewarded ? "bg-emerald-400" : "bg-violet-500",
                    )}
                    style={{ transform: `scaleX(${percent / 100})` }}
                  />
                </div>
                <p className="text-xs text-slate-500 tabular-nums">
                  {mission.progress} / {mission.target}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
