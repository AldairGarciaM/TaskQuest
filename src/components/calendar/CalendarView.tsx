"use client";

import { CalendarPlus, CircleDashed } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import TaskFormSheet from "@/components/task/TaskFormSheet";
import { dayLabel, monthGrid, WEEKDAY_LABELS, type CalendarDay, type YearMonth } from "@/lib/calendar";
import type { CalendarMonth } from "@/lib/data/calendar";
import { cn } from "@/lib/utils";

import {
  EntryRow,
  entryKey,
  isDone,
  isMovable,
  isPending,
  TOUCH_HOLD_CLASS,
  TouchDragGhost,
  type Entry,
} from "./entries";
import { useCalendarTasks, type DropTarget, type TouchSource } from "./useCalendarTasks";

interface CalendarViewProps {
  month: YearMonth;
  /** "YYYY-MM-DD" in the app time zone, computed on the server. */
  today: string;
  data: CalendarMonth;
  /** The signed-in user, so their own team tasks read "ti". */
  userId: string;
  /** Day to open on (from `?dia=`); ignored when it isn't on this month's grid. */
  initialDay?: string | null;
}

/** Chips a day cell shows before collapsing the rest into "+N". */
const CHIPS_PER_DAY = 3;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function CalendarView({ month, today, data, userId, initialDay }: CalendarViewProps) {
  const reduceMotion = useReducedMotion();
  const grid = monthGrid(month);
  const [selected, setSelected] = useState(
    () =>
      grid.find((d) => d.key === initialDay)?.key ??
      grid.find((d) => d.key === today)?.key ??
      grid.find((d) => d.inMonth)!.key,
  );
  // A dropped task opens its new day in the panel.
  const calendar = useCalendarTasks(data, today, userId, setSelected);
  const { byDay, draggingKey } = calendar;
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const selectedEntries = byDay.get(selected) ?? [];
  const monthEntries = grid.filter((d) => d.inMonth).flatMap((d) => byDay.get(d.key) ?? []);
  const overdue = monthEntries.filter((e) => isPending(e) && e.task.dueDate < today).length;

  function select(key: string, focus = false) {
    setSelected(key);
    if (focus) cells.current.get(key)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -(index % 7),
      End: 6 - (index % 7),
    };
    const move = moves[event.key];
    if (move === undefined) return;
    const target = grid[index + move];
    if (!target) return;
    event.preventDefault();
    select(target.key, true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Mes" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2 sm:p-4">
        <CalendarSummary
          total={monthEntries.length}
          totalLabel="con fecha este mes"
          overdue={overdue}
          undatedPending={data.undatedPending}
        />

        <div className="grid grid-cols-7 border-b border-slate-800 pb-2" aria-hidden>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="text-center text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              {label}
            </span>
          ))}
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="mt-2 grid grid-cols-7 gap-1"
        >
          {grid.map((day, index) => (
            <DayCell
              key={day.key}
              day={day}
              entries={byDay.get(day.key) ?? []}
              isToday={day.key === today}
              isSelected={day.key === selected}
              isPast={day.key < today}
              isDropTarget={calendar.dropDay === day.key}
              draggingKey={draggingKey}
              onChipDragStart={calendar.startDrag}
              onDragEnd={calendar.endDrag}
              touchSource={calendar.touchSource}
              dropTarget={calendar.dropTarget(day.key)}
              buttonRef={(node) => {
                if (node) cells.current.set(day.key, node);
                else cells.current.delete(day.key);
              }}
              onSelect={() => select(day.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          ))}
        </motion.div>
      </section>

      <section
        aria-labelledby="day-heading"
        className="h-fit rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:sticky xl:top-0"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="day-heading" className="text-lg font-semibold first-letter:uppercase">
              {dayLabel(selected)}
            </h2>
            <p className="text-sm text-slate-400">
              {selected === today
                ? "Hoy"
                : selectedEntries.length === 0
                  ? "Día libre"
                  : `${selectedEntries.length} ${selectedEntries.length === 1 ? "tarea" : "tareas"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => calendar.openForm(null, selected)}
            className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:outline-none"
          >
            <CalendarPlus size={16} aria-hidden /> Nueva
          </button>
        </div>

        {selectedEntries.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center">
            <CircleDashed size={22} className="text-slate-600" aria-hidden />
            <p className="text-sm text-slate-400">Nada programado para este día.</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {selectedEntries.map((entry) => (
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
                    touchSource={calendar.touchSource}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <TaskFormSheet {...calendar.form} />
      <TouchDragGhost ghost={calendar.touchGhost} ghostRef={calendar.ghostRef} />
    </div>
  );
}

/** Counts, overdue and undated tasks, the color legend and the drag hint above a month or a week. */
export function CalendarSummary({
  total,
  totalLabel,
  overdue,
  undatedPending,
}: {
  total: number;
  totalLabel: string;
  overdue: number;
  undatedPending: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 pb-3 text-xs text-slate-400">
      <span>
        <span className="font-semibold text-slate-200 tabular-nums">{total}</span> {totalLabel}
      </span>
      {overdue > 0 && (
        <span className="text-rose-300">
          <span className="font-semibold tabular-nums">{overdue}</span> vencida{overdue === 1 ? "" : "s"}
        </span>
      )}
      {undatedPending > 0 && (
        <Link href="/misiones" className="underline-offset-4 hover:text-slate-200 hover:underline">
          <span className="font-semibold tabular-nums">{undatedPending}</span> pendiente
          {undatedPending === 1 ? "" : "s"} sin fecha
        </Link>
      )}
      <span className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-400" aria-hidden /> Personal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-400" aria-hidden /> Equipo
        </span>
      </span>
      <span className="hidden w-full text-slate-500 pointer-fine:lg:block">
        Arrastra una misión pendiente a otro día para cambiar su fecha. Las de equipo solo las mueven sus dueños y admins.
      </span>
      <span className="hidden w-full text-slate-500 pointer-coarse:block">
        Mantén presionada una misión pendiente y arrástrala a otro día. Las de equipo solo las mueven sus dueños y admins.
      </span>
    </div>
  );
}

interface DayCellProps {
  day: CalendarDay;
  entries: Entry[];
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  isDropTarget: boolean;
  /** entryKey() of the task being dragged. */
  draggingKey: string | null;
  onChipDragStart: (event: DragEvent, entry: Entry) => void;
  onDragEnd: () => void;
  touchSource: (entry: Entry) => TouchSource;
  dropTarget: DropTarget;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function DayCell({
  day,
  entries,
  isToday,
  isSelected,
  isPast,
  isDropTarget,
  draggingKey,
  onChipDragStart,
  onDragEnd,
  touchSource,
  dropTarget,
  buttonRef,
  onSelect,
  onKeyDown,
}: DayCellProps) {
  const pending = entries.filter(isPending);
  const hasOverdue = isPast && pending.length > 0;
  const hidden = entries.length - CHIPS_PER_DAY;
  const summary =
    entries.length === 0
      ? "sin tareas"
      : `${entries.length} ${entries.length === 1 ? "tarea" : "tareas"}${hasOverdue ? `, ${pending.length} vencida${pending.length === 1 ? "" : "s"}` : ""}`;

  // The cell is the drop target; the button underneath handles selection and keyboard, and the
  // chips sit above it (outside the button, where browsers let them be dragged).
  return (
    <div
      {...dropTarget}
      className={cn(
        "relative flex min-h-14 flex-col items-stretch gap-1 rounded-xl border p-1.5 transition-[background-color,border-color] duration-150 sm:min-h-28 sm:p-2",
        day.inMonth ? "bg-slate-900" : "bg-slate-950/40",
        isDropTarget
          ? "border-dashed border-violet-400 bg-violet-500/10"
          : isSelected
            ? "border-violet-500/70 bg-violet-500/[0.06]"
            : "border-transparent hover:border-slate-700",
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        tabIndex={isSelected ? 0 : -1}
        aria-pressed={isSelected}
        aria-label={`${dayLabel(day.key)}${isToday ? " (hoy)" : ""}: ${summary}`}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
      />

      <span className="pointer-events-none relative flex items-center justify-between">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums",
            isToday ? "bg-violet-500 font-bold text-white" : day.inMonth ? "text-slate-300" : "text-slate-600",
          )}
        >
          {day.day}
        </span>
        {hasOverdue && <span className="size-1.5 rounded-full bg-rose-400" aria-hidden />}
      </span>

      {/* Phones: one dot per task. */}
      {entries.length > 0 && (
        <span className="pointer-events-none relative flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
          {entries.slice(0, 4).map((entry) => (
            <span
              key={entryKey(entry)}
              className={cn(
                "size-1.5 rounded-full",
                isDone(entry) ? "bg-slate-600" : entry.kind === "org" ? "bg-sky-400" : "bg-violet-400",
              )}
            />
          ))}
        </span>
      )}

      <span className="pointer-events-none relative hidden flex-col gap-1 sm:flex" aria-hidden>
        {entries.slice(0, CHIPS_PER_DAY).map((entry) => (
          <span
            key={entryKey(entry)}
            {...(isMovable(entry) && {
              draggable: true,
              onDragStart: (event: DragEvent) => onChipDragStart(event, entry),
              onDragEnd,
              onClick: onSelect,
              ...touchSource(entry),
            })}
            className={cn(
              "flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-4 transition-opacity duration-150",
              isMovable(entry) && cn("pointer-events-auto cursor-grab active:cursor-grabbing", TOUCH_HOLD_CLASS),
              draggingKey === entryKey(entry) && "opacity-40",
              isDone(entry)
                ? "text-slate-500 line-through"
                : entry.kind === "org"
                  ? "bg-sky-500/10 text-sky-100"
                  : "bg-slate-800 text-slate-200",
              isPending(entry) && isPast && "text-rose-200",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                isDone(entry) ? "bg-slate-600" : DifficultyStyles[entry.task.difficulty].color,
              )}
            />
            <span className="truncate">{entry.task.title}</span>
          </span>
        ))}
        {hidden > 0 && <span className="px-1.5 text-[11px] text-slate-500">+{hidden} más</span>}
      </span>
    </div>
  );
}
