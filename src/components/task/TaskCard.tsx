"use client";

import { CalendarDays, EllipsisVertical, Pencil, Trash2 } from "lucide-react";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskDTO } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: TaskDTO;
  onToggle: (task: TaskDTO, completed: boolean) => void;
  onEdit: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}

const dueDateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function todayInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function describeDueDate(dueDate: string) {
  const today = todayInput();
  if (dueDate === today) return { text: "Hoy", overdue: false };
  return {
    text: dueDateFormatter.format(new Date(`${dueDate}T00:00:00.000Z`)),
    overdue: dueDate < today,
  };
}

export default function TaskCard({ task, onToggle, onEdit, onDelete }: TaskCardProps) {
  const style = DifficultyStyles[task.difficulty];
  const DifficultyIcon = style.icon;
  const completed = task.status === "COMPLETED";
  const due = task.dueDate ? describeDueDate(task.dueDate) : null;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-slate-800 bg-slate-900 transition-[border-color,opacity] duration-200",
        completed ? "opacity-70" : "hover:border-slate-700",
      )}
    >
      <div className={cn("absolute top-0 left-0 h-full w-1", completed ? "bg-slate-700" : style.color)} />

      <CardContent className="p-4 pl-6 sm:p-6 sm:pl-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <Checkbox
            checked={completed}
            onCheckedChange={(checked) => onToggle(task, checked)} 
            aria-label={completed ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
            className="mt-1 size-5 rounded-md border-slate-600 text-white data-checked:border-violet-600 data-checked:bg-violet-600"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <h3
              className={cn(
                "text-base font-semibold break-words sm:text-lg",
                completed ? "text-slate-500 line-through" : "text-amber-100",
              )}
            >
              {task.title}
            </h3>

            {task.description && (
              <p className="text-sm break-words whitespace-pre-line text-slate-400">{task.description}</p>
            )}
          </div>

          <span className={cn("text-base font-bold whitespace-nowrap sm:text-xl", completed ? "text-slate-500" : "text-green-400")}>
            +{task.xpReward} XP
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Opciones de "${task.title}"`}
              className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none"
            >
              <EllipsisVertical size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40 rounded-xl border border-slate-800 bg-slate-900 p-1 text-slate-200 ring-0"
            >
              <DropdownMenuItem
                onClick={() => onEdit(task)}
                className="rounded-lg text-sm focus:bg-slate-800 focus:text-slate-50"
              >
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(task)}
                className="rounded-lg text-sm text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
              >
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pl-8 sm:pl-9">
          <Badge className={style.badge}>
            <DifficultyIcon aria-hidden="true" />
            {style.label}
          </Badge>

          {due && (
            <div
              className={cn(
                "flex items-center gap-2 text-sm",
                due.overdue && !completed ? "text-rose-400" : "text-slate-400",
              )}
            >
              <CalendarDays size={16} aria-hidden />
              <span>
                {due.overdue && !completed && <span className="sr-only">Vencida: </span>}
                {due.text}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
