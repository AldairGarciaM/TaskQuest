"use client";

import { ClipboardList, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTask } from "@/app/actions/tasks";
import { DIFFICULTIES, DifficultyStyles } from "@/app/constants/taskDifficulty";
import type { Difficulty } from "@/generated/prisma/enums";
import type { TaskDTO } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

import { toggleTaskWithToasts } from "./completion";
import DeleteTaskDialog from "./DeleteTaskDialog";
import { applyTaskAction } from "./optimistic";
import TaskCard from "./TaskCard";
import TaskFormSheet from "./TaskFormSheet";

type Filter = "pending" | "completed";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Case- and accent-insensitive, so "dificil" finds "Difícil". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

interface TaskListProps {
  tasks: TaskDTO[];
}

/** Every personal mission, with search and filters (/misiones). The dashboard shows TaskSummary instead. */
export default function TaskList({ tasks }: TaskListProps) {
  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, applyTaskAction);
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDTO | null>(null);

  const pending = optimisticTasks.filter((task) => task.status === "PENDING");
  const completed = optimisticTasks
    .filter((task) => task.status === "COMPLETED")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const byStatus = filter === "pending" ? pending : completed;

  const needle = normalize(query.trim());
  const matches = byStatus.filter(
    (task) =>
      (!difficulty || task.difficulty === difficulty) &&
      (!needle || normalize(`${task.title} ${task.description ?? ""}`).includes(needle)),
  );
  const filtering = needle !== "" || difficulty !== null;

  function clearFilters() {
    setQuery("");
    setDifficulty(null);
  }

  function openForm(task: TaskDTO | null) {
    setEditing(task);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function handleToggle(task: TaskDTO, isCompleted: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: task.id, completed: isCompleted });
      await toggleTaskWithToasts(task, isCompleted);
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
          Misiones personales
        </h2>

        <div className="flex flex-wrap items-center gap-3">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block sm:max-w-xs sm:flex-1">
          <span className="sr-only">Buscar misiones</span>
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título o descripción"
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 pr-3 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-violet-500/60 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:outline-none"
          />
        </label>

        <div role="group" aria-label="Filtrar por dificultad" className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((value) => {
            const style = DifficultyStyles[value];
            const Icon = style.icon;
            const active = difficulty === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setDifficulty(active ? null : value)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                  active
                    ? cn("border-transparent", style.badge)
                    : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                )}
              >
                <Icon size={14} aria-hidden />
                {style.label}
              </button>
            );
          })}
        </div>
      </div>

      {matches.length === 0 && filtering ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800 px-6 py-14 text-center">
          <Search className="size-10 text-slate-600" aria-hidden />
          <p className="mt-4 font-semibold text-slate-200">Ninguna misión coincide</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">Prueba con otra palabra o quita el filtro de dificultad.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
          >
            <X size={16} aria-hidden /> Limpiar filtros
          </button>
        </div>
      ) : matches.length === 0 ? (
        <EmptyState filter={filter} hasTasks={optimisticTasks.length > 0} onCreate={() => openForm(null)} />
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false} mode="popLayout">
            {matches.map((task) => (
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
