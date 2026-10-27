"use client";

import { ClipboardList, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { deleteOrgTask, reopenOrgTask } from "@/app/actions/org-tasks";
import ConfirmDialog from "@/components/organization/ConfirmDialog";
import type { BoardPerson, OrgTaskDTO } from "@/lib/data/org-board";
import { cn } from "@/lib/utils";

import OrgTaskCard, { type OrgTaskAction } from "./OrgTaskCard";
import OrgTaskFormSheet from "./OrgTaskFormSheet";
import { useOrgTaskActions } from "./useOrgTaskActions";

type Filter = "pending" | "open" | "mine" | "completed";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const EMPTY: Record<Filter, string> = {
  pending: "No hay tareas pendientes.",
  open: "No hay tareas libres. Cuando haya, cualquiera puede tomarlas.",
  mine: "No tienes tareas. Toma una libre o espera a que te asignen.",
  completed: "Aún no se ha completado ninguna tarea.",
};

interface OrgBoardProps {
  organizationId: string;
  myUserId: string;
  canManage: boolean;
  tasks: OrgTaskDTO[];
  members: BoardPerson[];
}

export default function OrgBoard({ organizationId, myUserId, canManage, tasks, members }: OrgBoardProps) {
  const reduceMotion = useReducedMotion();
  const { pending, run, claim, release, complete } = useOrgTaskActions();
  const [filter, setFilter] = useState<Filter>("pending");
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<OrgTaskDTO | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "reopen"; task: OrgTaskDTO } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const matches: Record<Filter, (t: OrgTaskDTO) => boolean> = {
    pending: (t) => t.status === "PENDING",
    open: (t) => t.status === "PENDING" && !t.assignee,
    mine: (t) => t.status === "PENDING" && t.assignee?.userId === myUserId,
    completed: (t) => t.status === "COMPLETED",
  };
  const filters: { key: Filter; label: string }[] = [
    { key: "pending", label: "Pendientes" },
    { key: "open", label: "Libres" },
    { key: "mine", label: "Mías" },
    { key: "completed", label: "Completadas" },
  ];
  const visible = tasks.filter(matches[filter]);

  function openForm(task: OrgTaskDTO | null) {
    setEditing(task);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function handleAction(action: OrgTaskAction, task: OrgTaskDTO) {
    switch (action) {
      case "claim":
        return claim(task);
      case "release":
        return release(task);
      case "complete":
        return complete(task);
      case "edit":
        return openForm(task);
      case "reopen":
      case "delete":
        setConfirm({ kind: action, task });
        setConfirmOpen(true);
    }
  }

  function handleConfirm() {
    if (!confirm) return;
    const { kind, task } = confirm;
    run(
      () => (kind === "delete" ? deleteOrgTask(task.id) : reopenOrgTask(task.id)),
      () => {
        setConfirmOpen(false);
        toast(kind === "delete" ? "Tarea eliminada" : "Tarea reabierta", { description: task.title });
      },
    );
  }

  return (
    <section aria-labelledby="board-heading" className="space-y-5">
      <h2 id="board-heading" className="sr-only">
        Tareas del equipo
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar tareas" className="flex flex-wrap gap-1 rounded-xl bg-slate-950/60 p-1">
          {filters.map(({ key, label }) => {
            const count = tasks.filter(matches[key]).length;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                  filter === key ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {label} <span className="text-slate-500 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97]"
          >
            <Plus size={16} aria-hidden />
            Nueva tarea
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
            <ClipboardList size={22} aria-hidden />
          </span>
          <p className="max-w-sm text-sm text-slate-400">
            {tasks.length === 0 && canManage ? "Crea la primera tarea del equipo." : EMPTY[filter]}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
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
                <OrgTaskCard
                  task={task}
                  myUserId={myUserId}
                  canManage={canManage}
                  busy={pending}
                  onAction={handleAction}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {canManage && (
        <OrgTaskFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={organizationId}
          members={members}
          task={editing}
          formKey={formKey}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirm?.kind === "reopen" ? "¿Reabrir esta tarea?" : "¿Eliminar esta tarea?"}
        description={
          confirm?.kind === "reopen"
            ? `“${confirm.task.title}” vuelve a pendientes y se descuentan los ${confirm.task.xpReward} XP que pagó.`
            : `“${confirm?.task.title}” se eliminará para siempre.${
                confirm?.task.status === "COMPLETED" ? " La XP que ya pagó se conserva." : ""
              }`
        }
        confirmLabel={confirm?.kind === "reopen" ? "Reabrir" : "Eliminar"}
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
