import { z } from "zod";

import { DIFFICULTIES } from "@/app/constants/taskDifficulty";

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 500;

export const taskIdSchema = z.string().min(1).max(64);

/** Plain calendar date, "YYYY-MM-DD". */
export const dueDateSchema = z.iso.date({ error: "Fecha no válida" });

export const taskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Ponle un nombre a la misión" })
    .max(TITLE_MAX, { error: `Máximo ${TITLE_MAX} caracteres` }),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, { error: `Máximo ${DESCRIPTION_MAX} caracteres` })
    .optional()
    .transform((value) => value || undefined),
  difficulty: z.enum(DIFFICULTIES, { error: "Elige una dificultad" }),
  // Plain calendar date from <input type="date">; empty means no due date.
  dueDate: z
    .union([dueDateSchema, z.literal("")])
    .optional()
    .transform((value) => value || undefined),
});

export type TaskInput = z.input<typeof taskInputSchema>;
export type TaskFieldErrors = Partial<Record<keyof TaskInput, string[]>>;

/** Board task: same fields plus an optional assignee (empty = anyone can take it). */
export const orgTaskInputSchema = taskInputSchema.extend({
  assigneeId: z
    .string()
    .max(64)
    .optional()
    .transform((value) => value || undefined),
});

export type OrgTaskInput = z.input<typeof orgTaskInputSchema>;
export type OrgTaskFieldErrors = Partial<Record<keyof OrgTaskInput, string[]>>;

export const REVIEW_NOTE_MAX = 300;

/** Optional note a manager leaves when sending a task back; blank means no note. */
export const reviewNoteSchema = z
  .string()
  .trim()
  .max(REVIEW_NOTE_MAX, { error: `Máximo ${REVIEW_NOTE_MAX} caracteres` })
  .optional()
  .transform((note) => note || undefined);
