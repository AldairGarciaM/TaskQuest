"use client";

import { ArrowRight, CircleCheckBig, ClipboardList, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { deleteTask } from "@/app/actions/tasks";
import OrgTaskCard, { type OrgTaskAction } from "@/components/org-board/OrgTaskCard";
import { useOrgTaskActions } from "@/components/org-board/useOrgTaskActions";
import { toggleTaskWithToasts } from "@/components/task/completion";
import DeleteTaskDialog from "@/components/task/DeleteTaskDialog";
import { applyTaskAction } from "@/components/task/optimistic";
import TaskCard from "@/components/task/TaskCard";
import TaskFormSheet from "@/components/task/TaskFormSheet";
import type { TaskDTO } from "@/lib/data/dashboard";
import type { DashboardOrgTask, OrgTaskDTO } from "@/lib/data/org-board";

import { SUMMARY_PER_COLUMN } from "./summary";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type Entry = { kind: "personal"; task: TaskDTO } | { kind: "org"; task: DashboardOrgTask };

/** Due soonest first, undated last. */
function byDueDate(a: Entry, b: Entry) {
  const x = a.task.dueDate;
  const y = b.task.dueDate;
  if (x === y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x.localeCompare(y);
}

function byCompletedAt(a: Entry, b: Entry) {
  return (b.task.completedAt ?? "").localeCompare(a.task.completedAt ?? "");
}

interface TaskSummaryProps {
  personal: TaskDTO[];
  /** `completed` holds only the latest few; `completedTotal` counts them all. */
  org: { active: DashboardOrgTask[]; completed: DashboardOrgTask[]; completedTotal: number };
  myUserId: string;
}

/** Dashboard: personal missions and my team tasks, still open on the left and done on the right. */
export default function TaskSummary({ personal, org, myUserId }: TaskSummaryProps) {
  const [tasks, applyOptimistic] = useOptimistic(personal, applyTaskAction);
  const [, startTransition] = useTransition();
  const orgActions = useOrgTaskActions();
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDTO | null>(null);

  const active: Entry[] = [
    ...tasks.filter((t) => t.status === "PENDING").map((task) => ({ kind: "personal" as const, task })),
    ...org.active.map((task) => ({ kind: "org" as const, task })),
  ].sort(byDueDate);
  const completed: Entry[] = [
    ...tasks.filter((t) => t.status === "COMPLETED").map((task) => ({ kind: "personal" as const, task })),
    ...org.completed.map((task) => ({ kind: "org" as const, task })),
  ].sort(byCompletedAt);
  const completedTotal = completed.length - org.completed.length + org.completedTotal;

  function openForm(task: TaskDTO | null) {
    setEditing(task);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function toggle(task: TaskDTO, isCompleted: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: task.id, completed: isCompleted });
      await toggleTaskWithToasts(task, isCompleted);
    });
  }

  function remove(task: TaskDTO) {
    setDeleteOpen(false);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: task.id });
      const result = await deleteTask(task.id);
      if (result.ok) toast("Misión eliminada", { description: task.title });
      else toast.error(result.error ?? "No pudimos eliminar la misión.");
    });
  }

  // Only my own tasks are listed, so the review actions never show up here.
  function handleOrgAction(action: OrgTaskAction, task: OrgTaskDTO) {
    if (action === "submit") orgActions.submit(task);
    else if (action === "release") orgActions.release(task);
  }

  function renderEntry(entry: Entry) {
    if (entry.kind === "personal") {
      return (
        <TaskCard
          task={entry.task}
          onToggle={toggle}
          onEdit={openForm}
          onDelete={(target) => {
            setDeleteTarget(target);
            setDeleteOpen(true);
          }}
        />
      );
    }
    return (
      <OrgTaskCard
        task={entry.task}
        myUserId={myUserId}
        canManage={false}
        canReview={entry.task.canReview}
        busy={orgActions.pending}
        onAction={handleOrgAction}
        organization={entry.task.organization}
      />
    );
  }

  return (
    <section aria-labelledby="summary-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="summary-heading" className="text-xl font-bold">
            Resumen de tareas
          </h2>
          <p className="text-sm text-slate-400">Tus misiones personales y lo que te asignaron tus equipos.</p>
        </div>
        <button
          type="button"
          onClick={() => openForm(null)}
          className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97]"
        >
          <Plus size={16} aria-hidden /> Nueva misión
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-6">
        <Column
          id="summary-active"
          title="En curso"
          entries={active}
          total={active.length}
          renderEntry={renderEntry}
          empty={
            <EmptyColumn
              icon={<ClipboardList className="size-9 text-slate-600" aria-hidden />}
              title="¡Todo al día!"
              body="No tienes misiones ni tareas de equipo pendientes."
              action={{ label: "Crear misión", onClick: () => openForm(null) }}
            />
          }
        />
        <Column
          id="summary-completed"
          title="Completadas"
          entries={completed}
          total={completedTotal}
          renderEntry={renderEntry}
          empty={
            <EmptyColumn
              icon={<CircleCheckBig className="size-9 text-slate-600" aria-hidden />}
              title="Aún no completas tareas"
              body="Lo que termines, tuyo o de tu equipo, aparecerá aquí."
            />
          }
        />
      </div>

      <TaskFormSheet open={formOpen} onOpenChange={setFormOpen} task={editing} formKey={formKey} />
      <DeleteTaskDialog open={deleteOpen} task={deleteTarget} onCancel={() => setDeleteOpen(false)} onConfirm={remove} />
    </section>
  );
}

function entryKey(entry: Entry) {
  return `${entry.kind}-${entry.task.id}`;
}

function Column({
  id,
  title,
  entries,
  total,
  renderEntry,
  empty,
}: {
  id: string;
  title: string;
  entries: Entry[];
  total: number;
  renderEntry: (entry: Entry) => ReactNode;
  empty: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const visible = entries.slice(0, SUMMARY_PER_COLUMN);
  const hidden = total - visible.length;

  return (
    <div role="region" aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="flex items-center gap-2 text-sm font-medium tracking-wide text-slate-400 uppercase">
        {title}
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300 tabular-nums normal-case">
          {total}
        </span>
      </h3>

      {visible.length === 0 ? (
        empty
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((entry) => (
              <motion.li
                key={entryKey(entry)}
                layout={!reduceMotion}
                initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{
                  opacity: 0,
                  transform: reduceMotion ? "none" : "scale(0.98)",
                  transition: { duration: 0.15, ease: EASE_OUT },
                }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {renderEntry(entry)}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {hidden > 0 && (
        <Link
          href="/misiones"
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 py-3 text-sm font-medium text-slate-300 transition-colors duration-150 hover:bg-slate-800/60 hover:text-slate-50"
        >
          Ver todas en Misiones
          <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function EmptyColumn({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
      {icon}
      <p className="mt-4 font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-400">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
