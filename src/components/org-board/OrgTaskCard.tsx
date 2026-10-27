"use client";

import { CalendarDays, CircleCheck, EllipsisVertical, HandHelping, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrgTaskDTO } from "@/lib/data/org-board";
import { cn } from "@/lib/utils";

export type OrgTaskAction = "claim" | "release" | "complete" | "reopen" | "edit" | "delete";

interface OrgTaskCardProps {
  task: OrgTaskDTO;
  myUserId: string;
  canManage: boolean;
  busy: boolean;
  onAction: (action: OrgTaskAction, task: OrgTaskDTO) => void;
}

const dueDateFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

function todayInput(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const primaryButton =
  "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-60";
const ghostButton =
  "flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition-[background-color,color,transform] duration-150 hover:bg-slate-800 hover:text-slate-200 active:scale-[0.97] disabled:opacity-60";

export default function OrgTaskCard({ task, myUserId, canManage, busy, onAction }: OrgTaskCardProps) {
  const style = DifficultyStyles[task.difficulty];
  const DifficultyIcon = style.icon;
  const completed = task.status === "COMPLETED";
  const mine = task.assignee?.userId === myUserId;
  const open = !task.assignee && !completed;
  const overdue = !completed && task.dueDate !== null && task.dueDate < todayInput();

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-slate-900 transition-[border-color,opacity] duration-200",
        completed ? "border-slate-800 opacity-75" : mine ? "border-violet-500/40" : "border-slate-800 hover:border-slate-700",
      )}
    >
      <div aria-hidden className={cn("absolute top-0 left-0 h-full w-1", completed ? "bg-slate-700" : style.color)} />

      <div className="space-y-4 p-5 pl-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className={cn("font-semibold break-words", completed ? "text-slate-500 line-through" : "text-amber-100")}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm break-words whitespace-pre-line text-slate-400">{task.description}</p>
            )}
          </div>

          <span className={cn("font-bold whitespace-nowrap tabular-nums", completed ? "text-slate-500" : "text-green-400")}>
            +{task.xpReward} XP
          </span>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Opciones de "${task.title}"`}
                className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none"
              >
                <EllipsisVertical size={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 rounded-xl border border-slate-800 bg-slate-900 p-1 text-slate-200 ring-0"
              >
                {completed ? (
                  <DropdownMenuItem
                    onClick={() => onAction("reopen", task)}
                    className="rounded-lg text-sm focus:bg-slate-800 focus:text-slate-50"
                  >
                    <RotateCcw /> Reabrir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onAction("edit", task)}
                    className="rounded-lg text-sm focus:bg-slate-800 focus:text-slate-50"
                  >
                    <Pencil /> Editar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onAction("delete", task)}
                  className="rounded-lg text-sm text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
                >
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Badge className={style.badge}>
            <DifficultyIcon aria-hidden="true" />
            {style.label}
          </Badge>

          {task.dueDate && (
            <span className={cn("flex items-center gap-1.5", overdue ? "text-rose-400" : "text-slate-400")}>
              <CalendarDays size={15} aria-hidden />
              {overdue && <span className="sr-only">Vencida: </span>}
              {task.dueDate === todayInput() ? "Hoy" : dueDateFormatter.format(new Date(`${task.dueDate}T00:00:00.000Z`))}
            </span>
          )}

          <span className="flex items-center gap-2 text-slate-400">
            {task.assignee ? (
              <>
                <span
                  aria-hidden
                  className="grid size-6 place-items-center rounded-md bg-slate-800 text-[10px] font-semibold text-slate-200"
                >
                  {task.assignee.firstName[0]}
                  {task.assignee.lastName[0]}
                </span>
                {completed
                  ? `Completada por ${mine ? "ti" : task.assignee.firstName}`
                  : mine
                    ? "Tú"
                    : `${task.assignee.firstName} ${task.assignee.lastName}`}
              </>
            ) : (
              <span className="rounded-full border border-dashed border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                Libre
              </span>
            )}
          </span>

          <div className="ml-auto flex gap-2">
            {open && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction("claim", task)}
                className={cn(primaryButton, "bg-slate-800 text-slate-100 hover:bg-slate-700")}
              >
                <HandHelping size={16} aria-hidden />
                Tomar
              </button>
            )}
            {mine && !completed && task.selfAssigned && (
              <button type="button" disabled={busy} onClick={() => onAction("release", task)} className={ghostButton}>
                <Undo2 size={16} aria-hidden />
                Soltar
              </button>
            )}
            {mine && !completed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction("complete", task)}
                className={cn(primaryButton, "bg-violet-600 text-white hover:bg-violet-500")}
              >
                <CircleCheck size={16} aria-hidden />
                Completar
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
