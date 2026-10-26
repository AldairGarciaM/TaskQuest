import { Lock } from "lucide-react";
import type { Metadata } from "next";

import AchievementIcon from "@/components/gamification/AchievementIcon";
import { getAchievements } from "@/lib/data/achievements";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Logros · TaskQuest",
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });

export default async function AchievementsPage() {
  const user = await requireUser();
  const achievements = await getAchievements(user.id);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  // Unlocked first (most recent on top), then locked by closeness to completion.
  const sorted = [...achievements].sort((a, b) => {
    if (a.unlockedAt && b.unlockedAt) return b.unlockedAt.localeCompare(a.unlockedAt);
    if (a.unlockedAt) return -1;
    if (b.unlockedAt) return 1;
    return b.current / b.target - a.current / a.target;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Logros</h1>
          <p className="text-slate-400">Se desbloquean al completar misiones. Una vez ganados, son tuyos.</p>
        </div>
        <p className="text-sm text-slate-400">
          <span className="text-2xl font-bold text-yellow-300 tabular-nums">{unlocked.length}</span>
          <span className="tabular-nums"> / {achievements.length}</span> desbloqueados
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((achievement) => {
          const isUnlocked = achievement.unlockedAt !== null;
          return (
            <li
              key={achievement.key}
              className={cn(
                "flex gap-4 rounded-xl border p-5",
                isUnlocked ? "border-yellow-300/30 bg-slate-900" : "border-slate-800 bg-slate-900/50",
              )}
            >
              <span
                className={cn(
                  "relative grid size-14 shrink-0 place-items-center rounded-2xl",
                  isUnlocked ? "bg-yellow-300/15 text-yellow-300" : "bg-slate-800 text-slate-500",
                )}
              >
                <AchievementIcon name={achievement.icon} size={26} />
                {!isUnlocked && (
                  <Lock
                    size={14}
                    aria-hidden
                    className="absolute -right-1 -bottom-1 rounded-full bg-slate-950 p-0.5 text-slate-400"
                  />
                )}
              </span>

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <h2 className={cn("font-semibold", isUnlocked ? "text-amber-100" : "text-slate-300")}>
                    {achievement.title}
                    <span className="sr-only">{isUnlocked ? " (desbloqueado)" : " (bloqueado)"}</span>
                  </h2>
                  <p className="text-sm text-slate-400">{achievement.description}</p>
                </div>

                {isUnlocked ? (
                  <p className="text-xs text-slate-500">
                    Desbloqueado el {dateFormatter.format(new Date(achievement.unlockedAt!))}
                  </p>
                ) : (
                  achievement.target > 1 && (
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full origin-left rounded-full bg-violet-500"
                          style={{ transform: `scaleX(${achievement.current / achievement.target})` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {achievement.current} / {achievement.target}
                      </p>
                    </div>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
