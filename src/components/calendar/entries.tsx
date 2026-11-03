"use client";

import { CircleCheck, GripVertical, Pencil, UserRound, Users } from "lucide-react";
import Link from "next/link";
import type { DragEvent } from "react";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarMonth, CalendarOrgTask } from "@/lib/data/calendar";
import { cn } from "@/lib/utils";

import { ownership } from "./ownership";

export type PersonalTask = CalendarMonth["tasks"][number];

export type OrgTask = CalendarMonth["orgTasks"][number];

export type Entry = { kind: "personal"; task: PersonalTask } | { kind: "org"; task: OrgTask };

export function entryKey(entry: Entry) {
  return `${entry.kind}-${entry.task.id}`;
}

export function isDone(entry: Entry) {
  return entry.task.status === "COMPLETED";
}

/** Still waiting on me: tasks in review are out of my hands, so they never count as overdue. */
export function isPending(entry: Entry) {
  return entry.task.status === "PENDING";
}

/** Pending personal tasks, and pending team tasks of organizations I manage, can be dragged. */
export function isMovable(entry: Entry) {
  return entry.kind === "personal" ? isPending(entry) : entry.task.canReschedule;
}

const ORG_STATUS: Record<CalendarOrgTask["status"], { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-slate-800 text-slate-300" },
  IN_REVIEW: { label: "En revisión", className: "bg-amber-500/15 text-amber-300" },
  COMPLETED: { label: "Completada", className: "bg-emerald-500/15 text-emerald-300" },
};

export function PersonalRow({
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

export function OrgRow({
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

/** A day's tasks with their rows; shared by the month's day panel and each day of the week view. */
export function EntryRow({
  entry,
  today,
  userId,
  draggingKey,
  onToggle,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  entry: Entry;
  today: string;
  userId: string;
  draggingKey: string | null;
  onToggle: (task: PersonalTask, completed: boolean) => void;
  onEdit: (task: PersonalTask) => void;
  onDragStart: (event: DragEvent, entry: Entry) => void;
  onDragEnd: () => void;
}) {
  const isDragging = draggingKey === entryKey(entry);
  const overdue = entry.task.dueDate < today;
  return entry.kind === "personal" ? (
    <PersonalRow
      task={entry.task}
      overdue={overdue}
      isDragging={isDragging}
      onToggle={onToggle}
      onEdit={() => onEdit(entry.task)}
      onDragStart={(event) => onDragStart(event, entry)}
      onDragEnd={onDragEnd}
    />
  ) : (
    <OrgRow
      task={entry.task}
      overdue={overdue}
      userId={userId}
      isDragging={isDragging}
      onDragStart={(event) => onDragStart(event, entry)}
      onDragEnd={onDragEnd}
    />
  );
}
