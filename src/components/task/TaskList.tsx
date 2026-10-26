"use client";

import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTask, setTaskCompleted } from "@/app/actions/tasks";
import type { TaskDTO } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

import DeleteTaskDialog from "./DeleteTaskDialog";
import TaskCard from "./TaskCard";
import TaskFormSheet from "./TaskFormSheet";

type Filter = "pending" | "completed";

type OptimisticAction =
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string };

function applyAction(tasks: TaskDTO[], action: OptimisticAction): TaskDTO[] {
  if (action.type === "delete") return tasks.filter((task) => task.id !== action.id);
  return tasks.map((task) =>
    task.id === action.id
      ? {
          ...task,
          status: action.completed ? "COMPLETED" : "PENDING",
          completedAt: action.completed ? new Date().toISOString() : null,
        }
      : task,
  );
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function TaskList({ tasks }: { tasks: TaskDTO[] }) {
  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, applyAction);
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const [filter, setFilter] = useState<Filter>("pending");
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDTO | null>(null);

  const pending = optimisticTasks.filter((task) => task.status === "PENDING");
  const completed = optimisticTasks
    .filter((task) => task.status === "COMPLETED")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const visible = filter === "pending" ? pending : completed;

  function openForm(task: TaskDTO | null) {
    setEditing(task);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function handleToggle(task: TaskDTO, isCompleted: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: task.id, completed: isCompleted });
      const result = await setTaskCompleted(task.id, isCompleted);

      if (!result.ok) {
        toast.error(result.error ?? "No pudimos actualizar la misión.");
        return;
      }
      if (result.xpDelta > 0) {
        toast.success(`+${result.xpDelta} XP`, { description: `Completaste “${task.title}”` });
      } else if (result.xpDelta < 0) {
        toast(`${result.xpDelta} XP`, { description: `“${task.title}” volvió a pendientes` });
      }
      if (result.leveledUp) {
        toast(`¡Subiste a nivel ${result.level}!`, {
          icon: <Sparkles className="size-4 text-yellow-300" />,
          duration: 6000,
        });
      }
    });
  }

  function handleDelete(task: TaskDTO) {
    setDeleteOpen(false);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: task.id });
      const result = await deleteTask(task.id);
      if (result.ok) {
        toast("Misión eliminada", { description: task.title });
      } else {
        toast.error(result.error ?? "No pudimos eliminar la misión.");
      }
    });
  }

  return (
    <section aria-labelledby="missions-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="missions-heading" className="text-xl font-bold">
          Misiones
        </h2>

        <div className="flex items-center gap-3">
          <div role="group" aria-label="Filtrar misiones" className="flex rounded-xl bg-slate-950/60 p-1">
            {(
              [
                ["pending", "Pendientes", pending.length],
                ["completed", "Completadas", completed.length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                  filter === value ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {label} <span className="text-slate-500 tabular-nums">{count}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97]"
          >
            <Plus size={16} aria-hidden /> Nueva misión
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState filter={filter} hasTasks={optimisticTasks.length > 0} onCreate={() => openForm(null)} />
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((task) => (
              <motion.li
                key={task.id}
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
                <TaskCard
                  task={task}
                  onToggle={handleToggle}
                  onEdit={openForm}
                  onDelete={(target) => {
                    setDeleteTarget(target);
                    setDeleteOpen(true);
                  }}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <TaskFormSheet open={formOpen} onOpenChange={setFormOpen} task={editing} formKey={formKey} />
      <DeleteTaskDialog
        open={deleteOpen}
        task={deleteTarget}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}

function EmptyState({
  filter,
  hasTasks,
  onCreate,
}: {
  filter: Filter;
  hasTasks: boolean;
  onCreate: () => void;
}) {
  const message =
    filter === "completed"
      ? { title: "Aún no completas misiones", body: "Marca una misión como hecha para ganar tu primera XP." }
      : hasTasks
        ? { title: "¡Todo listo por ahora!", body: "No tienes misiones pendientes. Crea otra cuando quieras." }
        : { title: "Tu aventura empieza aquí", body: "Crea tu primera misión y elige su dificultad." };

  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800 px-6 py-14 text-center">
      <ClipboardList className="size-10 text-slate-600" aria-hidden />
      <p className="mt-4 font-semibold text-slate-200">{message.title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-400">{message.body}</p>
      {filter === "pending" && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
        >
          Crear misión
        </button>
      )}
    </div>
  );
}
