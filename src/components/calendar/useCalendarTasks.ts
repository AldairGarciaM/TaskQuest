"use client";

import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { toast } from "sonner";

import { rescheduleOrgTask } from "@/app/actions/org-tasks";
import { rescheduleTask } from "@/app/actions/tasks";
import { toggleTaskWithToasts } from "@/components/task/completion";
import { relativeDayLabel } from "@/lib/calendar";
import type { CalendarMonth } from "@/lib/data/calendar";
import type { TaskDTO } from "@/lib/data/dashboard";

import { entryKey, isDone, type Entry, type OrgTask, type PersonalTask } from "./entries";

/** Spread onto the element a task can be dropped on. */
export interface DropTarget {
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
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

/**
 * The calendar's tasks by day plus what you can do with them: complete, drag to another day (with
 * Undo), and the create/edit sheet. Shared by the month and week views.
 */
export function useCalendarTasks(data: CalendarMonth, today: string, userId: string) {
  const [tasks, applyOptimistic] = useOptimistic(data.tasks, applyChange);
  const [orgTasks, applyOrgOptimistic] = useOptimistic(data.orgTasks, applyOrgMove);
  const [, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  /** Task open in the sheet; null creates a new one. */
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  /** Due date a new task starts with. */
  const [formDay, setFormDay] = useState<string | undefined>(undefined);
  const [dragging, setDragging] = useState<Entry | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const byDay = new Map<string, Entry[]>();
  for (const task of tasks) byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), { kind: "personal", task }]);
  for (const task of orgTasks) byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), { kind: "org", task }]);
  // Pending first, so a crowded day shows what's still to do.
  for (const entries of byDay.values()) entries.sort((a, b) => Number(isDone(a)) - Number(isDone(b)));

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

  /** Opens the sheet to edit `task`, or to create one due on `day`. */
  function openForm(task: TaskDTO | null, day?: string) {
    setEditing(task);
    setFormDay(day);
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

  /** Drop-target handlers for the element that represents `key`; `onDropped` runs after a move. */
  function dropTarget(key: string, onDropped?: (key: string) => void): DropTarget {
    return {
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!dragging) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropDay(key);
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null);
      },
      onDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        if (dragging) {
          move(dragging, key);
          onDropped?.(key);
        }
        endDrag();
      },
    };
  }

  return {
    byDay,
    toggle,
    openForm,
    startDrag,
    endDrag,
    dropTarget,
    dropDay,
    draggingKey: dragging && entryKey(dragging),
    form: { open: formOpen, onOpenChange: setFormOpen, task: editing, formKey, defaultDueDate: formDay },
  };
}
