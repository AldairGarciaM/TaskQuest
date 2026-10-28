"use client";

import { CalendarPlus, CircleCheck, CircleDashed, UserRound, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition, type KeyboardEvent } from "react";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import { toggleTaskWithToasts } from "@/components/task/completion";
import TaskFormSheet from "@/components/task/TaskFormSheet";
import { Checkbox } from "@/components/ui/checkbox";
import { dayLabel, monthGrid, WEEKDAY_LABELS, type CalendarDay, type YearMonth } from "@/lib/calendar";
import type { CalendarMonth, CalendarOrgTask, CalendarPerson } from "@/lib/data/calendar";
import { cn } from "@/lib/utils";

type PersonalTask = CalendarMonth["tasks"][number];

type Entry = { kind: "personal"; task: PersonalTask } | { kind: "org"; task: CalendarOrgTask };

interface CalendarViewProps {
  month: YearMonth;
  /** "YYYY-MM-DD" in the app time zone, computed on the server. */
  today: string;
  data: CalendarMonth;
  /** The signed-in user, so their own team tasks read "ti". */
  userId: string;
}

/** Chips a day cell shows before collapsing the rest into "+N". */
const CHIPS_PER_DAY = 3;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const ORG_STATUS: Record<CalendarOrgTask["status"], { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-slate-800 text-slate-300" },
  IN_REVIEW: { label: "En revisión", className: "bg-amber-500/15 text-amber-300" },
  COMPLETED: { label: "Completada", className: "bg-emerald-500/15 text-emerald-300" },
};

function isDone(entry: Entry) {
  return entry.task.status === "COMPLETED";
}

/** Still waiting on me: tasks in review are out of my hands, so they never count as overdue. */
function isPending(entry: Entry) {
  return entry.task.status === "PENDING";
}

function applyToggle(tasks: PersonalTask[], change: { id: string; completed: boolean }): PersonalTask[] {
  return tasks.map((task) =>
    task.id === change.id ? { ...task, status: change.completed ? "COMPLETED" : "PENDING" } : task,
  );
}

export default function CalendarView({ month, today, data, userId }: CalendarViewProps) {
  const reduceMotion = useReducedMotion();
  const [tasks, applyOptimistic] = useOptimistic(data.tasks, applyToggle);
  const [, startTransition] = useTransition();
  const grid = monthGrid(month);
  const [selected, setSelected] = useState(() => grid.find((d) => d.key === today)?.key ?? grid.find((d) => d.inMonth)!.key);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const byDay = new Map<string, Entry[]>();
  for (const task of tasks) byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), { kind: "personal", task }]);
  for (const task of data.orgTasks) byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), { kind: "org", task }]);
  // Pending first, so a crowded day shows what's still to do.
  for (const entries of byDay.values()) entries.sort((a, b) => Number(isDone(a)) - Number(isDone(b)));

  const selectedEntries = byDay.get(selected) ?? [];
  const monthEntries = grid.filter((d) => d.inMonth).flatMap((d) => byDay.get(d.key) ?? []);
  const overdue = monthEntries.filter((e) => isPending(e) && e.task.dueDate < today).length;

  function toggle(task: PersonalTask, completed: boolean) {
    startTransition(async () => {
      applyOptimistic({ id: task.id, completed });
      await toggleTaskWithToasts(task, completed);
    });
  }

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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 pb-3 text-xs text-slate-400">
          <span>
            <span className="font-semibold text-slate-200 tabular-nums">{monthEntries.length}</span> con fecha este mes
          </span>
          {overdue > 0 && (
            <span className="text-rose-300">
              <span className="font-semibold tabular-nums">{overdue}</span> vencida{overdue === 1 ? "" : "s"}
            </span>
          )}
          {data.undatedPending > 0 && (
            <Link href="/#missions-heading" className="underline-offset-4 hover:text-slate-200 hover:underline">
              <span className="font-semibold tabular-nums">{data.undatedPending}</span> pendiente
              {data.undatedPending === 1 ? "" : "s"} sin fecha
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
        </div>

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
            onClick={() => {
              setFormKey((key) => key + 1);
              setFormOpen(true);
            }}
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
                  key={`${entry.kind}-${entry.task.id}`}
                  layout={!reduceMotion}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  {entry.kind === "personal" ? (
                    <PersonalRow task={entry.task} overdue={entry.task.dueDate < today} onToggle={toggle} />
                  ) : (
                    <OrgRow task={entry.task} overdue={entry.task.dueDate < today} userId={userId} />
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <TaskFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        task={null}
        formKey={formKey}
        defaultDueDate={selected}
      />
    </div>
  );
}

interface DayCellProps {
  day: CalendarDay;
  entries: Entry[];
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function DayCell({ day, entries, isToday, isSelected, isPast, buttonRef, onSelect, onKeyDown }: DayCellProps) {
  const pending = entries.filter(isPending);
  const hasOverdue = isPast && pending.length > 0;
  const hidden = entries.length - CHIPS_PER_DAY;
  const summary =
    entries.length === 0
      ? "sin tareas"
      : `${entries.length} ${entries.length === 1 ? "tarea" : "tareas"}${hasOverdue ? `, ${pending.length} vencida${pending.length === 1 ? "" : "s"}` : ""}`;

  return (
    <button
      ref={buttonRef}
      type="button"
      tabIndex={isSelected ? 0 : -1}
      aria-pressed={isSelected}
      aria-label={`${dayLabel(day.key)}${isToday ? " (hoy)" : ""}: ${summary}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "flex min-h-14 flex-col items-stretch gap-1 rounded-xl border p-1.5 text-left transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none sm:min-h-28 sm:p-2",
        day.inMonth ? "bg-slate-900" : "bg-slate-950/40",
        isSelected ? "border-violet-500/70 bg-violet-500/[0.06]" : "border-transparent hover:border-slate-700",
      )}
    >
      <span className="flex items-center justify-between">
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
        <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
          {entries.slice(0, 4).map((entry) => (
            <span
              key={`${entry.kind}-${entry.task.id}`}
              className={cn(
                "size-1.5 rounded-full",
                isDone(entry) ? "bg-slate-600" : entry.kind === "org" ? "bg-sky-400" : "bg-violet-400",
              )}
            />
          ))}
        </span>
      )}

      <span className="hidden flex-col gap-1 sm:flex" aria-hidden>
        {entries.slice(0, CHIPS_PER_DAY).map((entry) => (
          <span
            key={`${entry.kind}-${entry.task.id}`}
            className={cn(
              "flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-4",
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
    </button>
  );
}

function PersonalRow({
  task,
  overdue,
  onToggle,
}: {
  task: PersonalTask;
  overdue: boolean;
  onToggle: (task: PersonalTask, completed: boolean) => void;
}) {
  const completed = task.status === "COMPLETED";
  const style = DifficultyStyles[task.difficulty];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <Checkbox
        checked={completed}
        onCheckedChange={(checked) => onToggle(task, checked)}
        aria-label={completed ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
        className="mt-0.5 size-5 rounded-md border-slate-600 text-white data-checked:border-violet-600 data-checked:bg-violet-600"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium break-words", completed ? "text-slate-500 line-through" : "text-slate-100")}>
          {task.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5", style.badge)}>{style.label}</span>
          {overdue && !completed && <span className="text-rose-300">Vencida</span>}
        </p>
      </div>
      <span className={cn("text-sm font-semibold whitespace-nowrap tabular-nums", completed ? "text-slate-500" : "text-green-400")}>
        +{task.xpReward} XP
      </span>
    </div>
  );
}

function personName(person: CalendarPerson, userId: string) {
  return person.userId === userId ? "ti" : `${person.firstName} ${person.lastName}`;
}

/** "Asignada a …" while the task is still open, "Realizada por …" once it's done. */
function ownership(task: CalendarOrgTask, userId: string): string {
  if (task.status === "COMPLETED") {
    const by = task.completedBy ?? task.assignee;
    return by ? `Realizada por ${personName(by, userId)}` : "Realizada";
  }
  return task.assignee ? `Asignada a ${personName(task.assignee, userId)}` : "Libre: nadie la ha tomado";
}

function OrgRow({ task, overdue, userId }: { task: CalendarOrgTask; overdue: boolean; userId: string }) {
  const status = ORG_STATUS[task.status];
  const completed = task.status === "COMPLETED";
  const OwnerIcon = completed ? CircleCheck : UserRound;

  return (
    <Link
      href={`/organizaciones/${task.organization.slug}`}
      className="flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 transition-colors duration-150 hover:border-sky-500/40 focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:outline-none"
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-sky-300">
        <Users size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium break-words", completed ? "text-slate-500 line-through" : "text-slate-100")}>
          {task.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5", status.className)}>{status.label}</span>
          <span className="text-slate-400">{task.organization.name}</span>
          {overdue && task.status === "PENDING" && <span className="text-rose-300">Vencida</span>}
        </p>
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1.5 text-xs",
            completed ? "text-emerald-300/80" : task.assignee ? "text-slate-300" : "text-slate-500 italic",
          )}
        >
          <OwnerIcon size={13} aria-hidden className="shrink-0" />
          <span className="truncate">{ownership(task, userId)}</span>
        </p>
      </div>
      <span className={cn("text-sm font-semibold whitespace-nowrap tabular-nums", completed ? "text-slate-500" : "text-sky-300")}>
        +{task.xpReward} XP
      </span>
    </Link>
  );
}
