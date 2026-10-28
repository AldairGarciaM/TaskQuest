import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import CalendarView from "@/components/calendar/CalendarView";
import { monthLabel, monthParam, parseMonthParam, shiftMonth } from "@/lib/calendar";
import { getCalendarMonth } from "@/lib/data/calendar";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Calendario · TaskQuest",
};

const navClass =
  "grid size-10 place-items-center rounded-xl border border-slate-800 text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const user = await requireUser();
  const month = parseMonthParam((await searchParams).mes);
  const data = await getCalendarMonth(user.id, month);
  const today = dayKey(new Date());
  const current = monthParam(month);
  const isCurrentMonth = today.startsWith(current);
  const label = monthLabel(month);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-slate-400">Tus misiones y las tareas de tus equipos según su fecha límite.</p>
        </div>

        <nav aria-label="Cambiar de mes" className="flex items-center gap-2">
          <Link href={`/calendario?mes=${monthParam(shiftMonth(month, -1))}`} aria-label="Mes anterior" className={navClass}>
            <ChevronLeft size={18} aria-hidden />
          </Link>
          <p aria-live="polite" className="min-w-40 text-center text-lg font-semibold first-letter:uppercase">
            {label}
          </p>
          <Link href={`/calendario?mes=${monthParam(shiftMonth(month, 1))}`} aria-label="Mes siguiente" className={navClass}>
            <ChevronRight size={18} aria-hidden />
          </Link>
          {!isCurrentMonth && (
            <Link
              href="/calendario"
              className="ml-1 flex h-10 items-center rounded-xl border border-slate-800 px-4 text-sm text-slate-300 transition-colors duration-150 hover:bg-slate-800"
            >
              Hoy
            </Link>
          )}
        </nav>
      </header>

      <CalendarView key={current} month={month} today={today} data={data} userId={user.id} />
    </div>
  );
}
