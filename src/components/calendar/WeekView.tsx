"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import TaskFormSheet from "@/components/task/TaskFormSheet";
import { dayLabel, weekDays } from "@/lib/calendar";
import type { CalendarMonth } from "@/lib/data/calendar";
import { cn } from "@/lib/utils";

import { CalendarSummary } from "./CalendarView";
import { EntryRow, entryKey, isPending } from "./entries";
import { useCalendarTasks } from "./useCalendarTasks";

interface WeekViewProps {
  /** "YYYY-MM-DD" of the week's Monday. */
  monday: string;
  /** "YYYY-MM-DD" in the app time zone, computed on the server. */
  today: string;
  data: CalendarMonth;
  userId: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const weekdayFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: "UTC" });
const shortMonthFormatter = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });

/** The week as an agenda: one row per day with all of its tasks, so nothing hides behind "+N". */
export default function WeekView({ monday, today, data, userId }: WeekViewProps) {
  const reduceMotion = useReducedMotion();
  const calendar = useCalendarTasks(data, today, userId);
  const { byDay, draggingKey } = calendar;
  const days = weekDays(monday);

  const weekEntries = days.flatMap((key) => byDay.get(key) ?? []);
  const overdue = weekEntries.filter((e) => isPending(e) && e.task.dueDate < today).length;

  return (
    <section aria-label="Semana" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2 sm:p-4">
      <CalendarSummary
        total={weekEntries.length}
        totalLabel="con fecha esta semana"
        overdue={overdue}
        undatedPending={data.undatedPending}
      />

      <ol className="space-y-2">
        {days.map((key, index) => {
          const entries = byDay.get(key) ?? [];
          const isToday = key === today;
          const isPast = key < today;
          const pending = entries.filter(isPending).length;
          const date = new Date(`${key}T00:00:00.000Z`);

          return (
            <motion.li
              key={key}
              aria-labelledby={`week-day-${key}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.25, ease: EASE_OUT, delay: reduceMotion ? 0 : index * 0.03 }}
              {...calendar.dropTarget(key)}
              className={cn(
                "grid gap-3 rounded-xl border p-3 transition-[background-color,border-color] duration-150 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-5",
                calendar.dropDay === key
                  ? "border-dashed border-violet-400 bg-violet-500/10"
                  : isToday
                    ? "border-violet-500/50 bg-violet-500/[0.05]"
                    : "border-slate-800/80 bg-slate-900",
              )}
            >
              <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-1">
                <h2 id={`week-day-${key}`} className="flex items-baseline gap-2 lg:flex-col lg:gap-0.5">
                  <span className="sr-only">{dayLabel(key)}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "text-sm font-semibold capitalize",
                      isToday ? "text-violet-300" : isPast ? "text-slate-500" : "text-slate-200",
                    )}
                  >
                    {weekdayFormatter.format(date)}
                  </span>
                  <span
                    aria-hidden
                    className={cn("text-xs tabular-nums", isPast && !isToday ? "text-slate-600" : "text-slate-400")}
                  >
                    {date.getUTCDate()} {shortMonthFormatter.format(date).replace(".", "")}
                  </span>
                </h2>
                {isToday && (
                  <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-semibold text-white">Hoy</span>
                )}
                <span className="ml-auto flex items-center gap-2 lg:mt-auto lg:ml-0">
                  {isPast && pending > 0 && (
                    <span className="text-xs text-rose-300 tabular-nums">
                      {pending} vencida{pending === 1 ? "" : "s"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => calendar.openForm(null, key)}
                    aria-label={`Nueva misión para el ${dayLabel(key)}`}
                    className="grid size-8 place-items-center rounded-lg text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-800 hover:text-slate-200 active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
                  >
                    <Plus size={16} aria-hidden />
                  </button>
                </span>
              </div>

              {entries.length === 0 ? (
                <p className="flex items-center rounded-lg border border-dashed border-slate-800 px-3 py-2.5 text-sm text-slate-500">
                  Libre
                </p>
              ) : (
                <ul className="grid gap-2 2xl:grid-cols-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {entries.map((entry) => (
                      <motion.li
                        key={entryKey(entry)}
                        layout={!reduceMotion}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                      >
                        <EntryRow
                          entry={entry}
                          today={today}
                          userId={userId}
                          draggingKey={draggingKey}
                          onToggle={calendar.toggle}
                          onEdit={(task) => calendar.openForm(task)}
                          onDragStart={calendar.startDrag}
                          onDragEnd={calendar.endDrag}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </motion.li>
          );
        })}
      </ol>

      <TaskFormSheet {...calendar.form} />
    </section>
  );
}
