import { Trophy } from "lucide-react";

import type { RankingEntry } from "@/lib/data/org-board";
import { cn } from "@/lib/utils";

const PODIUM = ["text-yellow-300", "text-slate-300", "text-amber-600"];

export default function OrgRanking({ ranking, myUserId }: { ranking: RankingEntry[]; myUserId: string }) {
  return (
    <section aria-labelledby="ranking-heading" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-yellow-300" aria-hidden />
        <h2 id="ranking-heading" className="font-semibold">
          Ranking
        </h2>
      </div>
      <p className="-mt-2 text-xs text-slate-500">XP ganada en tareas de esta organización.</p>

      <ol className="space-y-1">
        {ranking.map((entry, index) => {
          const isMe = entry.userId === myUserId;
          return (
            <li
              key={entry.userId}
              className={cn("flex items-center gap-3 rounded-lg px-2 py-2", isMe && "bg-violet-500/10")}
            >
              <span
                className={cn(
                  "w-5 text-center text-sm font-bold tabular-nums",
                  entry.xp > 0 ? (PODIUM[index] ?? "text-slate-500") : "text-slate-600",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">
                  {entry.firstName} {entry.lastName}
                  {isMe && <span className="ml-1 text-xs font-normal text-slate-500">(tú)</span>}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  Nivel {entry.level} · {entry.completed} {entry.completed === 1 ? "tarea" : "tareas"}
                </span>
              </span>
              <span className="text-sm font-semibold text-green-400 tabular-nums">{entry.xp} XP</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
