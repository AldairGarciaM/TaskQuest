import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";

import { monthLabel, monthParam, shiftMonth, type YearMonth } from "@/lib/calendar";
import type { RankingEntry } from "@/lib/data/org-board";
import { cn } from "@/lib/utils";

const PODIUM = ["text-yellow-300", "text-slate-300", "text-amber-600"];

const navClass =
  "grid size-8 place-items-center rounded-lg border border-slate-800 text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none";

interface OrgRankingProps {
  ranking: RankingEntry[];
  myUserId: string;
  month: YearMonth;
  isCurrentMonth: boolean;
  /** Board URL the month links append `?mes=` to. */
  basePath: string;
}

export default function OrgRanking({ ranking, myUserId, month, isCurrentMonth, basePath }: OrgRankingProps) {
  const label = monthLabel(month);
  const nobodyScored = ranking.every((entry) => entry.xp === 0);

  return (
    <section aria-labelledby="ranking-heading" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-yellow-300" aria-hidden />
        <h2 id="ranking-heading" className="font-semibold">
          Ranking del mes
        </h2>
      </div>

      <nav aria-label="Cambiar el mes del ranking" className="-mt-1 flex items-center gap-2">
        <Link
          href={`${basePath}?mes=${monthParam(shiftMonth(month, -1))}`}
          scroll={false}
          aria-label="Mes anterior"
          className={navClass}
        >
          <ChevronLeft size={16} aria-hidden />
        </Link>
        <p aria-live="polite" className="flex-1 text-center text-sm font-medium text-slate-200 first-letter:uppercase">
          {label}
        </p>
        {isCurrentMonth ? (
          <span aria-hidden className={cn(navClass, "pointer-events-none opacity-40")}>
            <ChevronRight size={16} />
          </span>
        ) : (
          <Link
            href={`${basePath}?mes=${monthParam(shiftMonth(month, 1))}`}
            scroll={false}
            aria-label="Mes siguiente"
            className={navClass}
          >
            <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </nav>

      <p className="-mt-2 text-xs text-slate-500">
        {nobodyScored
          ? isCurrentMonth
            ? "Nadie ha completado tareas este mes todavía. ¡La primera aprobada toma la delantera!"
            : "Nadie completó tareas este mes."
          : "XP ganada en tareas de esta organización aprobadas en el mes."}
      </p>

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
