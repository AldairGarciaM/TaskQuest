import { AlertTriangle, ArrowRight, CalendarCheck, CalendarClock, Users } from "lucide-react";
import Link from "next/link";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import { ownership } from "@/components/calendar/ownership";
import { relativeDayLabel, weekdayLabel } from "@/lib/calendar";
import type { UpcomingDeadlines as Upcoming, UpcomingEntry } from "@/lib/data/calendar";
import { cn } from "@/lib/utils";

/** Agenda rows shown before pointing to the calendar for the rest. */
const MAX_ROWS = 8;
const MAX_OVERDUE = 3;

interface UpcomingDeadlinesProps {
  upcoming: Upcoming;
  today: string;
  userId: string;
}

function dayHref(key: string) {
  return `/calendario?dia=${key}`;
}

export default function UpcomingDeadlines({ upcoming, today, userId }: UpcomingDeadlinesProps) {
  const { days, overdue } = upcoming;
  const total = days.reduce((n, d) => n + d.entries.length, 0);

  // Fill the agenda day by day until MAX_ROWS; whatever doesn't fit is counted below.
  const agenda: { key: string; shown: UpcomingEntry[] }[] = [];
  for (const day of days) {
    const room = MAX_ROWS - agenda.reduce((n, d) => n + d.shown.length, 0);
    if (room > 0 && day.entries.length > 0) agenda.push({ key: day.key, shown: day.entries.slice(0, room) });
  }
  const hidden = total - agenda.reduce((n, d) => n + d.shown.length, 0);

  return (
    <section aria-labelledby="upcoming-heading" className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
            <CalendarClock size={20} aria-hidden />
          </span>
          <div>
            <h2 id="upcoming-heading" className="text-lg font-semibold">
              Próximas fechas
            </h2>
            <p className="text-sm text-slate-400">Lo que vence en los próximos 7 días.</p>
          </div>
        </div>
        <Link
          href="/calendario"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-violet-300 transition-colors duration-150 hover:text-violet-200 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none"
        >
          Ver calendario <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Esta semana">
        {days.map(({ key, entries }) => {
          const isToday = key === today;
          const count = entries.length;
          return (
            <li key={key}>
              <Link
                href={dayHref(key)}
                aria-label={`${relativeDayLabel(key, today)}: ${count === 0 ? "sin tareas" : `${count} ${count === 1 ? "tarea" : "tareas"}`}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none",
                  isToday
                    ? "border-violet-500/60 bg-violet-500/10"
                    : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/50",
                )}
              >
                <span className={cn("text-[11px] uppercase", isToday ? "text-violet-200" : "text-slate-500")}>
                  {isToday ? "Hoy" : weekdayLabel(key)}
                </span>
                <span className={cn("text-lg leading-none font-bold tabular-nums", count ? "text-slate-100" : "text-slate-500")}>
                  {Number(key.slice(8))}
                </span>
                <span
                  className={cn(
                    "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    count ? "bg-amber-400/15 text-amber-200" : "text-transparent",
                  )}
                  aria-hidden
                >
                  {count || "·"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {overdue.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-rose-200">
            <AlertTriangle size={15} aria-hidden />
            {overdue.length === 1 ? "1 tarea vencida" : `${overdue.length} tareas vencidas`}
          </p>
          <ul className="mt-2 space-y-1">
            {overdue.slice(0, MAX_OVERDUE).map((entry) => (
              <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} userId={userId} dateLabel={relativeDayLabel(entry.dueDate, today)} overdue />
            ))}
          </ul>
          {overdue.length > MAX_OVERDUE && (
            <Link href={dayHref(overdue[0].dueDate)} className="mt-1 inline-block px-2 text-xs text-rose-300 hover:underline">
              y {overdue.length - MAX_OVERDUE} más
            </Link>
          )}
        </div>
      )}

      {total === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-400">
          <CalendarCheck size={18} className="shrink-0 text-emerald-300" aria-hidden />
          Nada vence esta semana. Ponle fecha a una misión para verla aquí.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {agenda.map((day) => (
            <div key={day.key}>
              <h3 className="px-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
                {relativeDayLabel(day.key, today)}
              </h3>
              <ul className="mt-1 space-y-1">
                {day.shown.map((entry) => (
                  <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} userId={userId} />
                ))}
              </ul>
            </div>
          ))}
          {hidden > 0 && (
            <Link href="/calendario" className="inline-block px-2 text-sm text-slate-400 hover:text-slate-200 hover:underline">
              +{hidden} más en el calendario
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

interface EntryRowProps {
  entry: UpcomingEntry;
  userId: string;
  /** Shown instead of nothing when rows aren't grouped under a day (overdue list). */
  dateLabel?: string;
  overdue?: boolean;
}

function EntryRow({ entry, userId, dateLabel, overdue }: EntryRowProps) {
  const team = entry.kind === "org";

  return (
    <li>
      <Link
        href={team ? `/organizaciones/${entry.organization.slug}` : dayHref(entry.dueDate)}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-slate-800/60 focus-visible:bg-slate-800/60 focus-visible:outline-none"
      >
        <span className={cn("size-2 shrink-0 rounded-full", DifficultyStyles[entry.difficulty].color)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-100">{entry.title}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
            {team ? (
              <>
                <Users size={12} className="shrink-0 text-sky-300" aria-hidden />
                <span className="truncate">
                  {entry.organization.name} · {ownership(entry, userId)}
                  {entry.status === "IN_REVIEW" && " · En revisión"}
                </span>
              </>
            ) : (
              <span>Misión personal</span>
            )}
            {dateLabel && <span className={cn("shrink-0", overdue && "text-rose-300")}>· {dateLabel}</span>}
          </span>
        </span>
        <span className={cn("text-sm font-semibold whitespace-nowrap tabular-nums", team ? "text-sky-300" : "text-green-400")}>
          +{entry.xpReward} XP
        </span>
      </Link>
    </li>
  );
}
