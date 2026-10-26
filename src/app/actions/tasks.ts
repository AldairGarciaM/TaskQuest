"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dueDateFromInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { taskIdSchema, taskInputSchema, type TaskFieldErrors } from "@/lib/validations/task";
import { levelFromXp, XP_BY_DIFFICULTY } from "@/lib/xp";

type Failure = { ok: false; error?: string; fieldErrors?: TaskFieldErrors };
type Result<T = object> = ({ ok: true } & T) | Failure;

const NOT_FOUND: Failure = { ok: false, error: "No encontramos esa misión." };
const GENERIC_ERROR: Failure = { ok: false, error: "Algo salió mal. Intenta de nuevo." };

function invalidInput(error: z.ZodError): Failure {
  return { ok: false, fieldErrors: z.flattenError(error).fieldErrors as TaskFieldErrors };
}

export async function createTask(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { title, description, difficulty, dueDate } = parsed.data;

  try {
    await prisma.task.create({
      data: {
        title,
        description,
        difficulty,
        xpReward: XP_BY_DIFFICULTY[difficulty],
        dueDate: dueDate ? dueDateFromInput(dueDate) : null,
        userId: user.id,
      },
    });
  } catch (error) {
    console.error("createTask failed", error);
    return GENERIC_ERROR;
  }

  revalidatePath("/");
  return { ok: true };
}

export async function updateTask(taskId: unknown, input: unknown): Promise<Result> {
  const user = await requireUser();
  const id = taskIdSchema.safeParse(taskId);
  if (!id.success) return NOT_FOUND;
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { title, description, difficulty, dueDate } = parsed.data;

  try {
    const task = await prisma.task.findFirst({
      where: { id: id.data, userId: user.id },
      select: { status: true, difficulty: true },
    });
    if (!task) return NOT_FOUND;

    // The reward of a completed task was already paid out; changing it would desync the user's XP.
    if (task.status === "COMPLETED" && task.difficulty !== difficulty) {
      return {
        ok: false,
        fieldErrors: { difficulty: ["No puedes cambiar la dificultad de una misión completada"] },
      };
    }

    await prisma.task.updateMany({
      where: { id: id.data, userId: user.id },
      data: {
        title,
        description: description ?? null,
        difficulty,
        xpReward: XP_BY_DIFFICULTY[difficulty],
        dueDate: dueDate ? dueDateFromInput(dueDate) : null,
      },
    });
  } catch (error) {
    console.error("updateTask failed", error);
    return GENERIC_ERROR;
  }

  revalidatePath("/");
  return { ok: true };
}

export async function setTaskCompleted(
  taskId: unknown,
  completed: unknown,
): Promise<Result<{ xpDelta: number; level: number; leveledUp: boolean }>> {
  const user = await requireUser();
  const id = taskIdSchema.safeParse(taskId);
  const done = z.boolean().safeParse(completed);
  if (!id.success || !done.success) return NOT_FOUND;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: id.data, userId: user.id },
        select: { status: true, xpReward: true },
      });
      if (!task) return null;

      const target = done.data ? "COMPLETED" : "PENDING";
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { level: true },
      });
      if (task.status === target) {
        return { xpDelta: 0, level: current.level, leveledUp: false };
      }

      // Conditional update so a double click can't award the XP twice.
      const { count } = await tx.task.updateMany({
        where: { id: id.data, userId: user.id, status: task.status },
        data: { status: target, completedAt: done.data ? new Date() : null },
      });
      if (count === 0) return { xpDelta: 0, level: current.level, leveledUp: false };

      const xpDelta = done.data ? task.xpReward : -task.xpReward;
      const { xp } = await tx.user.update({
        where: { id: user.id },
        data: { xp: { increment: xpDelta } },
        select: { xp: true },
      });

      const safeXp = Math.max(0, xp);
      const level = levelFromXp(safeXp);
      await tx.user.update({
        where: { id: user.id },
        data: { xp: safeXp, level },
      });

      return { xpDelta, level, leveledUp: level > current.level };
    });

    if (!result) return NOT_FOUND;
    revalidatePath("/");
    return { ok: true, ...result };
  } catch (error) {
    console.error("setTaskCompleted failed", error);
    return GENERIC_ERROR;
  }
}

/** Deleting keeps any XP already earned from the task. */
export async function deleteTask(taskId: unknown): Promise<Result> {
  const user = await requireUser();
  const id = taskIdSchema.safeParse(taskId);
  if (!id.success) return NOT_FOUND;

  try {
    const { count } = await prisma.task.deleteMany({
      where: { id: id.data, userId: user.id },
    });
    if (count === 0) return NOT_FOUND;
  } catch (error) {
    console.error("deleteTask failed", error);
    return GENERIC_ERROR;
  }

  revalidatePath("/");
  return { ok: true };
}
