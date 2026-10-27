"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createTask, updateTask } from "@/app/actions/tasks";
import FormAlert from "@/components/auth/FormAlert";
import SubmitButton from "@/components/auth/SubmitButton";
import FormField from "@/components/form/FormField";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TaskDTO } from "@/lib/data/dashboard";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  taskInputSchema,
  type TaskFieldErrors,
} from "@/lib/validations/task";

import DifficultyPicker from "./DifficultyPicker";

interface TaskFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Task being edited; null creates a new one. */
  task: TaskDTO | null;
  /** Changes every time the sheet opens, so the form starts fresh. */
  formKey: number;
}

export default function TaskFormSheet({ open, onOpenChange, task, formKey }: TaskFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-slate-800 bg-slate-950 text-slate-100 data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-800 p-6">
          <SheetTitle className="text-lg font-bold text-slate-50">
            {task ? "Editar misión" : "Nueva misión"}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-400">
            {task
              ? "Ajusta los detalles de tu misión."
              : "La dificultad define cuánta XP ganarás al completarla."}
          </SheetDescription>
        </SheetHeader>

        <TaskForm key={formKey} task={task} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function TaskForm({ task, onDone }: { task: TaskDTO | null; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const isCompleted = task?.status === "COMPLETED";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (key: string) => form.get(key)?.toString();
    const values = {
      title: field("title") ?? "",
      description: field("description"),
      // A disabled fieldset doesn't submit its radios.
      difficulty: field("difficulty") ?? task?.difficulty,
      dueDate: field("dueDate"),
    };

    const parsed = taskInputSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as TaskFieldErrors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = task ? await updateTask(task.id, values) : await createTask(values);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? null);
        return;
      }

      toast.success(task ? "Misión actualizada" : "Misión creada", {
        description: parsed.data.title,
      });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {formError && <FormAlert message={formError} />}

        <FormField
          label="Título"
          name="title"
          defaultValue={task?.title}
          placeholder="Ej. Terminar el reporte mensual"
          maxLength={TITLE_MAX}
          autoComplete="off"
          autoFocus
          required
          error={fieldErrors.title?.[0]}
        />

        <DescriptionField
          defaultValue={task?.description ?? ""}
          error={fieldErrors.description?.[0]}
        />

        <DifficultyPicker
          name="difficulty"
          defaultValue={task?.difficulty ?? "EASY"}
          disabled={isCompleted}
          hint={isCompleted ? "La XP de esta misión ya se cobró, así que su dificultad queda fija." : undefined}
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
            {task ? "Guardar cambios" : "Crear misión"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function DescriptionField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor="task-description" className="block text-sm font-medium text-slate-300">
        Descripción (opcional)
      </label>
      <textarea
        id="task-description"
        name="description"
        rows={3}
        maxLength={DESCRIPTION_MAX}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "task-description-error" : undefined}
        placeholder="Detalles, pasos o notas"
        className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 aria-invalid:border-rose-500/70"
      />
      {error && (
        <p id="task-description-error" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
