"use client";

import { ArrowRight, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import OrgTaskCard, { type OrgTaskAction } from "@/components/org-board/OrgTaskCard";
import RejectTaskDialog from "@/components/org-board/RejectTaskDialog";
import { useOrgTaskActions } from "@/components/org-board/useOrgTaskActions";
import type { MyOrgTasksGroup, OrgTaskDTO } from "@/lib/data/org-board";
import { cn } from "@/lib/utils";

type Filter = "mine" | "open" | "review";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const EMPTY: Record<Filter, { title: string; body: string }> = {
  mine: {
    title: "No tienes tareas de equipo",
    body: "Toma una tarea libre o espera a que te asignen una.",
  },
  open: {
    title: "No hay tareas libres",
    body: "Cuando un equipo publique tareas sin responsable, aparecerán aquí.",
  },
  review: {
    title: "Nada por revisar",
    body: "Cuando alguien de tus equipos entregue una tarea, la verás aquí para aprobarla.",
  },
};

interface OrgTasksSectionProps {
  groups: MyOrgTasksGroup[];
  myUserId: string;
}

export default function OrgTasksSection({ groups, myUserId }: OrgTasksSectionProps) {
  const reduceMotion = useReducedMotion();
  const { pending, claim, release, submit, approve, reject } = useOrgTaskActions();
  const [filter, setFilter] = useState<Filter>("mine");
  const [rejecting, setRejecting] = useState<OrgTaskDTO | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const matches: Record<Filter, (t: OrgTaskDTO, group: MyOrgTasksGroup) => boolean> = {
    mine: (t) => t.assignee?.userId === myUserId,
    open: (t) => !t.assignee && t.status === "PENDING",
    review: (t, group) => group.canReview && t.status === "IN_REVIEW",
  };
  const reviewer = groups.some((g) => g.canReview);
  const filters: [Filter, string][] = [
    ["mine", "Mías"],
    ["open", "Libres"],
    ...(reviewer ? ([["review", "Por revisar"]] as [Filter, string][]) : []),
  ];
  const count = (key: Filter) => groups.reduce((n, g) => n + g.tasks.filter((t) => matches[key](t, g)).length, 0);
  const visibleGroups = groups
    .map((group) => ({ ...group, tasks: group.tasks.filter((t) => matches[filter](t, group)) }))
    .filter((group) => group.tasks.length > 0);

  function handleAction(action: OrgTaskAction, task: OrgTaskDTO) {
    if (action === "claim") claim(task);
    else if (action === "release") release(task);
    else if (action === "submit") submit(task);
    else if (action === "approve") approve(task);
    else if (action === "reject") {
      setRejecting(task);
      setRejectOpen(true);
    }
  }

  return (
    <section aria-labelledby="org-tasks-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="org-tasks-heading" className="text-xl font-bold">
          Tareas de organizaciones
        </h2>

        {groups.length > 0 && (
          <div role="group" aria-label="Filtrar tareas de organizaciones" className="flex rounded-xl bg-slate-950/60 p-1">
            {filters.map(([value, label]) => (
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
                {label} <span className="text-slate-500 tabular-nums">{count(value)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="Aún no perteneces a ninguna organización"
          body="Crea una o acepta una invitación para ver aquí las tareas de tu equipo."
          action={{ href: "/organizaciones", label: "Ir a organizaciones" }}
        />
      ) : visibleGroups.length === 0 ? (
        <EmptyState {...EMPTY[filter]} />
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(({ organization, canReview, tasks }) => (
            <div key={organization.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-300">
                  <Users size={16} className="shrink-0 text-slate-500" aria-hidden />
                  <span className="truncate">{organization.name}</span>
                  <span className="font-normal text-slate-500 tabular-nums">{tasks.length}</span>
                </h3>
                <Link
                  href={`/organizaciones/${organization.slug}`}
                  className="flex shrink-0 items-center gap-1 text-sm text-violet-300 transition-colors duration-150 hover:text-violet-200"
                >
                  Ver tablero
                  <ArrowRight size={14} aria-hidden />
                  <span className="sr-only"> de {organization.name}</span>
                </Link>
              </div>

              <ul className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {tasks.map((task) => (
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
                        canManage={false}
                        canReview={canReview}
                        busy={pending}
                        onAction={handleAction}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}

      <RejectTaskDialog
        open={rejectOpen}
        task={rejecting}
        pending={pending}
        onCancel={() => setRejectOpen(false)}
        onConfirm={(note) => rejecting && reject(rejecting, note, () => setRejectOpen(false))}
      />
    </section>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
      <Users className="size-10 text-slate-600" aria-hidden />
      <p className="mt-4 font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-400">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
