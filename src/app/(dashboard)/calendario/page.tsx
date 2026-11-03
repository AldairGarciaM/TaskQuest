import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import CalendarView from "@/components/calendar/CalendarView";
import WeekView from "@/components/calendar/WeekView";
import {
  addDays,
  monthLabel,
  monthParam,
  parseDayParam,
  parseMonthParam,
  parseViewParam,
  shiftMonth,
  startOfWeek,
  weekLabel,
} from "@/lib/calendar";
import { getCalendarMonth, getCalendarRange } from "@/lib/data/calendar";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Calendario · TaskQuest",
};

const navClass =
  "grid size-10 shrink-0 place-items-center rounded-xl border border-slate-800 text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none";

interface CalendarPageProps {
  searchParams: Promise<{
    mes?: string | string[];
    dia?: string | string[];
    vista?: string | string[];
    semana?: string | string[];
  }>;
}

const weekHref = (monday: string) => `/calendario?vista=semana&semana=${monday}`;

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const view = parseViewParam(params.vista);
  const day = parseDayParam(params.dia);
  const today = dayKey(new Date());

  // Month: a day without a month opens that day's month (links from the dashboard).
  const month = parseMonthParam(params.mes ?? day?.slice(0, 7));
  // Week: the one holding `semana` (any day of it), else `dia`, else today.
  const monday = startOfWeek(parseDayParam(params.semana) ?? day ?? today);
  const sunday = addDays(monday, 6);
  const weekHasToday = monday <= today && today <= sunday;

  const isMonth = view === "month";
  const current = isMonth ? monthParam(month) : monday;
  const isCurrent = isMonth ? today.startsWith(current) : weekHasToday;
  const data = isMonth
    ? await getCalendarMonth(user.id, month)
    : await getCalendarRange(user.id, { from: monday, to: sunday });

  // Switching keeps your place: the week of today if it's in this month, else its first week; and back.
  const toWeek = weekHref(startOfWeek(isMonth ? (today.startsWith(current) ? today : `${current}-01`) : monday));
  const toMonth = `/calendario?mes=${(weekHasToday ? today : monday).slice(0, 7)}`;
  const prev = isMonth ? `/calendario?mes=${monthParam(shiftMonth(month, -1))}` : weekHref(addDays(monday, -7));
  const next = isMonth ? `/calendario?mes=${monthParam(shiftMonth(month, 1))}` : weekHref(addDays(monday, 7));
  const unit = isMonth ? "Mes" : "Semana";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-slate-400">Tus misiones y las tareas de tus equipos según su fecha límite.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Vista del calendario" className="flex rounded-xl bg-slate-950/60 p-1">
            {[
              { label: "Mes", href: isMonth ? null : toMonth },
              { label: "Semana", href: isMonth ? toWeek : null },
            ].map(({ label, href }) =>
              href ? (
                <Link
                  key={label}
                  href={href}
                  className="flex h-8 items-center rounded-lg px-3 text-sm text-slate-400 transition-colors duration-150 hover:text-slate-100"
                >
                  {label}
                </Link>
              ) : (
                <span
                  key={label}
                  aria-current="page"
                  className="flex h-8 items-center rounded-lg bg-slate-800 px-3 text-sm font-medium text-slate-100"
                >
                  {label}
                </span>
              ),
            )}
          </nav>

          <nav aria-label={`Cambiar de ${unit.toLowerCase()}`} className="flex items-center gap-2">
            <Link href={prev} aria-label={`${unit} anterior`} className={navClass}>
              <ChevronLeft size={18} aria-hidden />
            </Link>
            <p
              aria-live="polite"
              className={cn(
                "text-center font-semibold first-letter:uppercase",
                isMonth ? "min-w-40 text-lg" : "min-w-40 text-base sm:min-w-64",
              )}
            >
              {isMonth ? monthLabel(month) : weekLabel(monday)}
            </p>
            <Link href={next} aria-label={`${unit} siguiente`} className={navClass}>
              <ChevronRight size={18} aria-hidden />
            </Link>
            {!isCurrent && (
              <Link
                href={isMonth ? "/calendario" : "/calendario?vista=semana"}
                className="ml-1 flex h-10 items-center rounded-xl border border-slate-800 px-4 text-sm text-slate-300 transition-colors duration-150 hover:bg-slate-800"
              >
                Hoy
              </Link>
            )}
          </nav>
        </div>
      </header>

      {isMonth ? (
        <CalendarView key={current} month={month} today={today} data={data} userId={user.id} initialDay={day} />
      ) : (
        <WeekView key={current} monday={monday} today={today} data={data} userId={user.id} />
      )}
    </div>
  );
}
