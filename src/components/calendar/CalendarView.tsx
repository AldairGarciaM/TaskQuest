"use client";

import { CalendarPlus, CircleCheck, CircleDashed, GripVertical, Pencil, UserRound, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition, type DragEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { rescheduleOrgTask } from "@/app/actions/org-tasks";
import { rescheduleTask } from "@/app/actions/tasks";
import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import { toggleTaskWithToasts } from "@/components/task/completion";
import TaskFormSheet from "@/components/task/TaskFormSheet";
import { Checkbox } from "@/components/ui/checkbox";
import { dayLabel, monthGrid, relativeDayLabel, WEEKDAY_LABELS, type CalendarDay, type YearMonth } from "@/lib/calendar";
import type { CalendarMonth, CalendarOrgTask } from "@/lib/data/calendar";
import type { TaskDTO } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

import { ownership } from "./ownership";

type PersonalTask = CalendarMonth["tasks"][number];

type OrgTask = CalendarMonth["orgTasks"][number];

type Entry = { kind: "personal"; task: PersonalTask } | { kind: "org"; task: OrgTask };

function entryKey(entry: Entry) {
  return `${entry.kind}-${entry.task.id}`;
}

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

type OptimisticChange =
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "move"; id: string; dueDate: string };

function applyChange(tasks: PersonalTask[], change: OptimisticChange): PersonalTask[] {
  return tasks.map((task) => {
    if (task.id !== change.id) return task;
    return change.type === "toggle"
      ? { ...task, status: change.completed ? "COMPLETED" : "PENDING" }
      : { ...task, dueDate: change.dueDate };
  });
}

function applyOrgMove(tasks: OrgTask[], change: { id: string; dueDate: string }): OrgTask[] {
  return tasks.map((task) => (task.id === change.id ? { ...task, dueDate: change.dueDate } : task));
}

/** Pending personal tasks, and pending team tasks of organizations I manage, can be dragged. */
function isMovable(entry: Entry) {
  return entry.kind === "personal" ? isPending(entry) : entry.task.canReschedule;
}

export default function CalendarView({ month, today, data, userId, initialDay }: CalendarViewProps) {
  const reduceMotion = useReducedMotion();
  const [tasks, applyOptimistic] = useOptimistic(data.tasks, applyChange);
  const [orgTasks, applyOrgOptimistic] = useOptimistic(data.orgTasks, applyOrgMove);
  const [, startTransition] = useTransition();
  const grid = monthGrid(month);
  const [selected, setSelected] = useState(
    () =>
      grid.find((d) => d.key === initialDay)?.key ??
      grid.find((d) => d.key === today)?.key ??
      grid.find((d) => d.inMonth)!.key,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  /** Task open in the sheet; null creates a new one. */
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [dragging, setDragging] = useState<Entry | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const byDay = new Map<string, Entry[]>();
  for (const task of tasks) byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), { kind: "personal", task }]);
  for (const task of orgTasks) byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), { kind: "org", task }]);
  // Pending first, so a crowded day shows what's still to do.
  for (const entries of byDay.values()) entries.sort((a, b) => Number(isDone(a)) - Number(isDone(b)));

  const selectedEntries = byDay.get(selected) ?? [];
  const monthEntries = grid.filter((d) => d.inMonth).flatMap((d) => byDay.get(d.key) ?? []);
  const overdue = monthEntries.filter((e) => isPending(e) && e.task.dueDate < today).length;

  function toggle(task: PersonalTask, completed: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: task.id, completed });
      await toggleTaskWithToasts(task, completed);
    });
  }

  function move(entry: Entry, dueDate: string, offerUndo = true) {
    const { task } = entry;
    if (task.dueDate === dueDate) return;
    startTransition(async () => {
      let result;
      if (entry.kind === "personal") {
        applyOptimistic({ type: "move", id: task.id, dueDate });
        result = await rescheduleTask(task.id, dueDate);
      } else {
        applyOrgOptimistic({ id: task.id, dueDate });
        result = await rescheduleOrgTask(task.id, dueDate);
      }
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos cambiar la fecha.");
        return;
      }
      if (!offerUndo) return;

      const assignee = entry.kind === "org" ? entry.task.assignee : null;
      const notified = assignee && assignee.userId !== userId ? ` · Avisamos a ${assignee.firstName}` : "";
      const moved = { ...entry, task: { ...task, dueDate } } as Entry;
      toast.success(entry.kind === "personal" ? "Misión movida" : "Tarea de equipo movida", {
        description: `${task.title} · ${relativeDayLabel(dueDate, today)}${notified}`,
        action: { label: "Deshacer", onClick: () => move(moved, task.dueDate, false) },
      });
    });
  }

  function openForm(task: TaskDTO | null) {
    setEditing(task);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function startDrag(event: DragEvent, entry: Entry) {
    event.dataTransfer.effectAllowed = "move";
    // Some browsers won't start a drag without data.
    event.dataTransfer.setData("text/plain", entry.task.title);
    setDragging(entry);
  }

  function endDrag() {
    setDragging(null);
    setDropDay(null);
  }

  function dragOver(event: DragEvent, key: string) {
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropDay(key);
  }

  function drop(event: DragEvent, key: string) {
    event.preventDefault();
    if (dragging) {
      move(dragging, key);
      setSelected(key);
    }
    endDrag();
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
            <Link href="/misiones" className="underline-offset-4 hover:text-slate-200 hover:underline">
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
          <span className="hidden w-full text-slate-500 lg:block">
            Arrastra una misión pendiente a otro día para cambiar su fecha. Las de equipo solo las mueven sus dueños y admins.
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
              isDropTarget={dropDay === day.key}
              draggingKey={dragging && entryKey(dragging)}
              onChipDragStart={startDrag}
              onDragEnd={endDrag}
              onDragOver={(event) => dragOver(event, day.key)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null);
              }}
              onDrop={(event) => drop(event, day.key)}
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
            onClick={() => openForm(null)}
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
                    <PersonalRow
                      task={entry.task}
                      overdue={entry.task.dueDate < today}
                      isDragging={dragging !== null && entryKey(dragging) === entryKey(entry)}
                      onToggle={toggle}
                      onEdit={() => openForm(entry.task)}
                      onDragStart={(event) => startDrag(event, entry)}
                      onDragEnd={endDrag}
                    />
                  ) : (
                    <OrgRow
                      task={entry.task}
                      overdue={entry.task.dueDate < today}
                      userId={userId}
                      isDragging={dragging !== null && entryKey(dragging) === entryKey(entry)}
                      onDragStart={(event) => startDrag(event, entry)}
                      onDragEnd={endDrag}
                    />
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
        task={editing}
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
  isDropTarget: boolean;
  /** entryKey() of the task being dragged. */
  draggingKey: string | null;
  onChipDragStart: (event: DragEvent, entry: Entry) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
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
  onDragOver,
  onDragLeave,
  onDrop,
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
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
              key={`${entry.kind}-${entry.task.id}`}
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
            key={`${entry.kind}-${entry.task.id}`}
            {...(isMovable(entry) && {
              draggable: true,
              onDragStart: (event: DragEvent) => onChipDragStart(event, entry),
              onDragEnd,
              onClick: onSelect,
            })}
            className={cn(
              "flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-4 transition-opacity duration-150",
              isMovable(entry) && "pointer-events-auto cursor-grab active:cursor-grabbing",
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

function PersonalRow({
  task,
  overdue,
  isDragging,
  onToggle,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  task: PersonalTask;
  overdue: boolean;
  isDragging: boolean;
  onToggle: (task: PersonalTask, completed: boolean) => void;
  onEdit: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const completed = task.status === "COMPLETED";
  const style = DifficultyStyles[task.difficulty];

  return (
    <div
      draggable={!completed}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition-opacity duration-150",
        !completed && "lg:cursor-grab lg:active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      {!completed && (
        <GripVertical size={16} aria-hidden className="mt-0.5 -mr-2 hidden shrink-0 text-slate-600 lg:block" />
      )}
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
      <div className="flex flex-col items-end gap-1">
        <span className={cn("text-sm font-semibold whitespace-nowrap tabular-nums", completed ? "text-slate-500" : "text-green-400")}>
          +{task.xpReward} XP
        </span>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar "${task.title}" o cambiar su fecha`}
          className="grid size-7 place-items-center rounded-lg text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-800 hover:text-slate-200 active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
        >
          <Pencil size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function OrgRow({
  task,
  overdue,
  userId,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: OrgTask;
  overdue: boolean;
  userId: string;
  isDragging: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const status = ORG_STATUS[task.status];
  const completed = task.status === "COMPLETED";
  const OwnerIcon = completed ? CircleCheck : UserRound;

  return (
    <Link
      href={`/organizaciones/${task.organization.slug}`}
      // Links drag their URL by default; only tasks I may reschedule start a drag.
      draggable={task.canReschedule}
      onDragStart={task.canReschedule ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 transition-[border-color,opacity] duration-150 hover:border-sky-500/40 focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:outline-none",
        task.canReschedule && "lg:cursor-grab lg:active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
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
