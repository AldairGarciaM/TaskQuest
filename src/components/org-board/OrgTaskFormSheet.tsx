"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createOrgTask, updateOrgTask } from "@/app/actions/org-tasks";
import FormAlert from "@/components/auth/FormAlert";
import SubmitButton from "@/components/auth/SubmitButton";
import FormField from "@/components/form/FormField";
import DifficultyPicker from "@/components/task/DifficultyPicker";
import { DescriptionField } from "@/components/task/TaskFormSheet";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BoardPerson, OrgTaskDTO } from "@/lib/data/org-board";
import { TITLE_MAX, orgTaskInputSchema, type OrgTaskFieldErrors } from "@/lib/validations/task";

interface OrgTaskFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  members: BoardPerson[];
  /** Task being edited; null creates a new one. */
  task: OrgTaskDTO | null;
  /** Changes every time the sheet opens, so the form starts fresh. */
  formKey: number;
}

export default function OrgTaskFormSheet({
  open,
  onOpenChange,
  organizationId,
  members,
  task,
  formKey,
}: OrgTaskFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-slate-800 bg-slate-950 text-slate-100 data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-800 p-6">
          <SheetTitle className="text-lg font-bold text-slate-50">{task ? "Editar tarea" : "Nueva tarea"}</SheetTitle>
          <SheetDescription className="text-sm text-slate-400">
            Asígnala a alguien o déjala libre para que cualquier miembro la tome.
          </SheetDescription>
        </SheetHeader>

        <OrgTaskForm
          key={formKey}
          organizationId={organizationId}
          members={members}
          task={task}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

interface OrgTaskFormProps {
  organizationId: string;
  members: BoardPerson[];
  task: OrgTaskDTO | null;
  onDone: () => void;
}

function OrgTaskForm({ organizationId, members, task, onDone }: OrgTaskFormProps) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<OrgTaskFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (key: string) => form.get(key)?.toString();
    const values = {
      title: field("title") ?? "",
      description: field("description"),
      difficulty: field("difficulty"),
      dueDate: field("dueDate"),
      assigneeId: field("assigneeId"),
    };

    const parsed = orgTaskInputSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as OrgTaskFieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = task ? await updateOrgTask(task.id, values) : await createOrgTask(organizationId, values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? null);
        return;
      }

      const assignee = members.find((m) => m.userId === parsed.data.assigneeId);
      toast.success(task ? "Tarea actualizada" : "Tarea creada", {
        description: assignee ? `Asignada a ${assignee.firstName}` : "Libre para cualquier miembro",
      });
      onDone();
    });
  }

  const assigneeError = fieldErrors.assigneeId?.[0];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {formError && <FormAlert message={formError} />}

        <FormField
          label="Título"
          name="title"
          defaultValue={task?.title}
          placeholder="Ej. Revisar el diseño de la portada"
          maxLength={TITLE_MAX}
          autoComplete="off"
          autoFocus
          required
          error={fieldErrors.title?.[0]}
        />

        <div className="space-y-2">
          <label htmlFor="org-task-assignee" className="block text-sm font-medium text-slate-300">
            Responsable
          </label>
          <select
            id="org-task-assignee"
            name="assigneeId"
            defaultValue={task?.assignee?.userId ?? ""}
            aria-invalid={assigneeError ? true : undefined}
            aria-describedby="org-task-assignee-hint"
            className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 aria-invalid:border-rose-500/70"
          >
            <option value="">Libre: cualquier miembro puede tomarla</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.firstName} {member.lastName} (@{member.username})
              </option>
            ))}
          </select>
          <p id="org-task-assignee-hint" className={assigneeError ? "text-xs text-rose-400" : "text-xs text-slate-500"}>
            {assigneeError ?? "Elige a alguien para una tarea específica."}
          </p>
        </div>

        <DescriptionField defaultValue={task?.description ?? ""} error={fieldErrors.description?.[0]} />

        <DifficultyPicker
          name="difficulty"
          defaultValue={task?.difficulty ?? "EASY"}
          error={fieldErrors.difficulty?.[0]}
        />

        <FormField
          label="Fecha límite (opcional)"
          name="dueDate"
          type="date"
          defaultValue={task?.dueDate ?? ""}
          className="scheme-dark"
          error={fieldErrors.dueDate?.[0]}
        />
      </div>

      <div className="flex gap-3 border-t border-slate-800 p-6">
        <button
          type="button"
          onClick={onDone}
          className="h-11 flex-1 rounded-xl border border-slate-800 text-sm font-medium text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-900 active:scale-[0.97]"
        >
          Cancelar
        </button>
        <div className="flex-1">
          <SubmitButton pending={pending} pendingLabel="Guardando…">
            {task ? "Guardar cambios" : "Crear tarea"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
