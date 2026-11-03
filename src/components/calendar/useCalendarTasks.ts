"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { toast } from "sonner";

import { rescheduleOrgTask } from "@/app/actions/org-tasks";
import { rescheduleTask } from "@/app/actions/tasks";
import { toggleTaskWithToasts } from "@/components/task/completion";
import { relativeDayLabel } from "@/lib/calendar";
import type { CalendarMonth } from "@/lib/data/calendar";
import type { TaskDTO } from "@/lib/data/dashboard";

import { entryKey, isDone, isMovable, type Entry, type OrgTask, type PersonalTask } from "./entries";
import { edgeScrollDelta, LONG_PRESS_MS, movedPastTolerance } from "./touch";

/** Spread onto the element a task can be dropped on. `data-calendar-day` lets touch drags find it. */
export interface DropTarget {
  "data-calendar-day": string;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

/** Spread onto a movable task so a long press picks it up on touch screens. */
export interface TouchSource {
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
}

/** The card that follows the finger while a task is carried on a touch screen. */
export interface TouchGhost {
  title: string;
  kind: Entry["kind"];
  width: number;
}

interface TouchSession {
  entry: Entry;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  active: boolean;
  timer: number;
  raf: number;
  scroller: HTMLElement;
  cleanup: () => void;
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

/** The day under a point of the screen, from the nearest drop target. */
function dayAt(x: number, y: number): string | null {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-calendar-day]")?.dataset.calendarDay ?? null;
}

/** The element that scrolls the calendar (the app's <main>), or the page. */
function scrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement as HTMLElement;
}

/**
 * The calendar's tasks by day plus what you can do with them: complete, move to another day (mouse
 * drag, or long press and drag on touch screens) with Undo, and the create/edit sheet. Shared by the
 * month and week views. `onDropped` runs after a task lands on a day.
 */
export function useCalendarTasks(
  data: CalendarMonth,
  today: string,
  userId: string,
  onDropped?: (key: string) => void,
) {
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
  const [touchGhost, setTouchGhost] = useState<TouchGhost | null>(null);
  const touch = useRef<TouchSession | null>(null);
  const ghostElement = useRef<HTMLElement | null>(null);
  /** The click that follows a touch drop must not open the task's link. */
  const suppressClick = useRef(false);

  // Leaving the page mid-drag drops nothing.
  useEffect(() => () => touch.current?.cleanup(), []);

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

  function dropOn(entry: Entry, key: string) {
    move(entry, key);
    onDropped?.(key);
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

  function dropTarget(key: string): DropTarget {
    return {
      "data-calendar-day": key,
      onDragOver(event) {
        if (!dragging) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropDay(key);
      },
      onDragLeave(event) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null);
      },
      onDrop(event) {
        event.preventDefault();
        if (dragging) dropOn(dragging, key);
        endDrag();
      },
    };
  }

  /** Moves the ghost card under the finger without re-rendering the calendar. */
  function placeGhost(x: number, y: number) {
    ghostElement.current?.style.setProperty("transform", `translate3d(${x}px, ${y}px, 0) translate(-50%, -130%)`);
  }

  function ghostRef(node: HTMLElement | null) {
    ghostElement.current = node;
    if (node && touch.current) placeGhost(touch.current.x, touch.current.y);
  }

  function autoScroll(session: TouchSession) {
    if (!session.active) return;
    const rect = session.scroller.getBoundingClientRect();
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    const delta = edgeScrollDelta(session.y, top, bottom);
    if (delta !== 0) {
      session.scroller.scrollBy(0, delta);
      setDropDay(dayAt(session.x, session.y));
    }
    session.raf = requestAnimationFrame(() => autoScroll(session));
  }

  function touchSource(entry: Entry): TouchSource {
    if (!isMovable(entry)) return {};
    return {
      onPointerDown(event) {
        if (event.pointerType !== "touch" || touch.current) return;
        // Taps on the checkbox or the edit button stay taps.
        if ((event.target as HTMLElement).closest("button, input, [role='checkbox']")) return;

        const source = event.currentTarget;
        const session: TouchSession = {
          entry,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          width: source.getBoundingClientRect().width,
          active: false,
          timer: 0,
          raf: 0,
          scroller: scrollerOf(source),
          cleanup: () => {},
        };

        const onMove = (e: globalThis.PointerEvent) => {
          if (e.pointerId !== session.pointerId) return;
          session.x = e.clientX;
          session.y = e.clientY;
          if (!session.active) {
            if (movedPastTolerance(session.startX, session.startY, e.clientX, e.clientY)) finish();
            return;
          }
          placeGhost(e.clientX, e.clientY);
          setDropDay(dayAt(e.clientX, e.clientY));
        };
        // Once the task is picked up, the finger carries it instead of scrolling the page.
        const onTouchMove = (e: TouchEvent) => {
          if (session.active) e.preventDefault();
        };
        const onUp = (e: globalThis.PointerEvent) => {
          if (e.pointerId !== session.pointerId) return;
          if (session.active) {
            const key = dayAt(e.clientX, e.clientY);
            if (key) dropOn(session.entry, key);
            suppressClick.current = true;
            window.setTimeout(() => (suppressClick.current = false), 400);
          }
          finish();
        };
        const onCancel = (e: globalThis.PointerEvent) => {
          if (e.pointerId === session.pointerId) finish();
        };

        function finish() {
          session.cleanup();
          if (session.active) {
            setTouchGhost(null);
            endDrag();
          }
        }

        session.cleanup = () => {
          window.clearTimeout(session.timer);
          cancelAnimationFrame(session.raf);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("touchmove", onTouchMove);
          if (touch.current === session) touch.current = null;
        };

        session.timer = window.setTimeout(() => {
          session.active = true;
          setDragging(entry);
          setTouchGhost({ title: entry.task.title, kind: entry.kind, width: session.width });
          setDropDay(dayAt(session.x, session.y));
          navigator.vibrate?.(12);
          session.raf = requestAnimationFrame(() => autoScroll(session));
        }, LONG_PRESS_MS);

        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        touch.current = session;
      },
      // A long press would otherwise open the browser's menu for links and text.
      onContextMenu(event) {
        if (touch.current) event.preventDefault();
      },
      onClickCapture(event) {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
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
    touchSource,
    touchGhost,
    ghostRef,
    form: { open: formOpen, onOpenChange: setFormOpen, task: editing, formKey, defaultDueDate: formDay },
  };
}
