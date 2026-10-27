"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dueDateFromInput } from "@/lib/dates";
import { addUserXp, unlockAchievements } from "@/lib/gamification/server";
import { canManageTasks } from "@/lib/organizations/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { orgTaskInputSchema, taskIdSchema, type OrgTaskFieldErrors } from "@/lib/validations/task";
import { XP_BY_DIFFICULTY } from "@/lib/xp";

type Failure = { ok: false; error?: string; fieldErrors?: OrgTaskFieldErrors };
type Result<T = object> = ({ ok: true } & T) | Failure;

const NOT_FOUND: Failure = { ok: false, error: "No encontramos esa tarea." };
const FORBIDDEN: Failure = { ok: false, error: "No tienes permiso para hacer eso." };
const GENERIC_ERROR: Failure = { ok: false, error: "Algo salió mal. Intenta de nuevo." };
const NOT_A_MEMBER: OrgTaskFieldErrors = { assigneeId: ["Esa persona no es miembro de la organización"] };

/** The board and the dashboard (which lists my tasks and the open ones). */
function revalidateBoard() {
  revalidatePath("/organizaciones", "layout");
  revalidatePath("/");
}

async function roleIn(organizationId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/** The task plus the caller's role in its organization; null if it doesn't exist or they aren't a member. */
async function taskForMember(taskId: unknown, userId: string) {
  const id = taskIdSchema.safeParse(taskId);
  if (!id.success) return null;
  const task = await prisma.orgTask.findUnique({
    where: { id: id.data },
    select: { id: true, organizationId: true, status: true, assigneeId: true, selfAssigned: true, difficulty: true },
  });
  if (!task) return null;
  const role = await roleIn(task.organizationId, userId);
  return role ? { task, role } : null;
}

function invalidInput(error: z.ZodError): Failure {
  return { ok: false, fieldErrors: z.flattenError(error).fieldErrors as OrgTaskFieldErrors };
}

export async function createOrgTask(organizationId: unknown, input: unknown): Promise<Result> {
  const user = await requireUser();
  const orgId = taskIdSchema.safeParse(organizationId);
  if (!orgId.success) return NOT_FOUND;
  const parsed = orgTaskInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const role = await roleIn(orgId.data, user.id);
  if (!role) return NOT_FOUND;
  if (!canManageTasks(role)) return FORBIDDEN;

  const { title, description, difficulty, dueDate, assigneeId } = parsed.data;
  if (assigneeId && !(await roleIn(orgId.data, assigneeId))) return { ok: false, fieldErrors: NOT_A_MEMBER };

  try {
    await prisma.orgTask.create({
      data: {
        organizationId: orgId.data,
        title,
        description,
        difficulty,
        xpReward: XP_BY_DIFFICULTY[difficulty],
        dueDate: dueDate ? dueDateFromInput(dueDate) : null,
        assigneeId: assigneeId ?? null,
        createdById: user.id,
      },
    });
  } catch (error) {
    console.error("createOrgTask failed", error);
    return GENERIC_ERROR;
  }

  revalidateBoard();
  return { ok: true };
}

/** Managers edit pending tasks, including who they're assigned to. */
export async function updateOrgTask(taskId: unknown, input: unknown): Promise<Result> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (!canManageTasks(found.role)) return FORBIDDEN;
  if (found.task.status === "COMPLETED") return { ok: false, error: "Reabre la tarea antes de editarla." };

  const parsed = orgTaskInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { title, description, difficulty, dueDate, assigneeId } = parsed.data;
  if (assigneeId && !(await roleIn(found.task.organizationId, assigneeId))) {
    return { ok: false, fieldErrors: NOT_A_MEMBER };
  }

  const nextAssignee = assigneeId ?? null;
  const { count } = await prisma.orgTask.updateMany({
    where: { id: found.task.id, status: "PENDING" },
    data: {
      title,
      description: description ?? null,
      difficulty,
      xpReward: XP_BY_DIFFICULTY[difficulty],
      dueDate: dueDate ? dueDateFromInput(dueDate) : null,
      assigneeId: nextAssignee,
      // Same person keeps how they got it; a new assignee was chosen by the manager.
      selfAssigned: nextAssignee !== null && nextAssignee === found.task.assigneeId && found.task.selfAssigned,
    },
  });
  if (count === 0) return { ok: false, error: "Reabre la tarea antes de editarla." };

  revalidateBoard();
  return { ok: true };
}

/** Deleting a completed task keeps the XP already paid. */
export async function deleteOrgTask(taskId: unknown): Promise<Result> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (!canManageTasks(found.role)) return FORBIDDEN;

  await prisma.orgTask.deleteMany({ where: { id: found.task.id } });
  revalidateBoard();
  return { ok: true };
}

/** Any member takes an open task. Conditional update so two people can't take the same one. */
export async function claimOrgTask(taskId: unknown): Promise<Result> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;

  const { count } = await prisma.orgTask.updateMany({
    where: { id: found.task.id, status: "PENDING", assigneeId: null },
    data: { assigneeId: user.id, selfAssigned: true },
  });
  if (count === 0) return { ok: false, error: "Alguien más ya tomó esta tarea." };

  revalidateBoard();
  return { ok: true };
}

/** Gives back a task you took yourself. Tasks a manager assigned to you stay yours. */
export async function releaseOrgTask(taskId: unknown): Promise<Result> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;

  const { count } = await prisma.orgTask.updateMany({
    where: { id: found.task.id, status: "PENDING", assigneeId: user.id, selfAssigned: true },
    data: { assigneeId: null, selfAssigned: false },
  });
  if (count === 0) return { ok: false, error: "Solo puedes soltar tareas que tomaste tú." };

  revalidateBoard();
  return { ok: true };
}

export interface OrgCompletionOutcome {
  xpDelta: number;
  achievements: string[];
  level: number;
  leveledUp: boolean;
}

/** The assignee completes the task and the XP goes straight to their personal level. */
export async function completeOrgTask(taskId: unknown): Promise<Result<OrgCompletionOutcome>> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (found.task.assigneeId !== user.id) return { ok: false, error: "Solo quien tiene la tarea puede completarla." };

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<OrgCompletionOutcome | null> => {
      const task = await tx.orgTask.findUniqueOrThrow({ where: { id: found.task.id }, select: { xpReward: true } });
      const now = new Date();
      // Conditional update so a double click can't pay twice.
      const { count } = await tx.orgTask.updateMany({
        where: { id: found.task.id, status: "PENDING", assigneeId: user.id },
        data: { status: "COMPLETED", completedAt: now, completedById: user.id, awardedXp: task.xpReward },
      });
      if (count === 0) return null;

      const { level, leveledUp } = await addUserXp(tx, user.id, task.xpReward);
      const achievements = await unlockAchievements(tx, user.id, level, now);
      return { xpDelta: task.xpReward, achievements, level, leveledUp };
    });
    if (!outcome) return { ok: false, error: "Esta tarea ya no está pendiente." };

    revalidateBoard();
    return { ok: true, ...outcome };
  } catch (error) {
    console.error("completeOrgTask failed", error);
    return GENERIC_ERROR;
  }
}

/** Managers send a completed task back to its assignee and take back the XP it paid. */
export async function reopenOrgTask(taskId: unknown): Promise<Result> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (!canManageTasks(found.role)) return FORBIDDEN;

  try {
    const reopened = await prisma.$transaction(async (tx) => {
      const task = await tx.orgTask.findUniqueOrThrow({
        where: { id: found.task.id },
        select: { status: true, completedById: true, awardedXp: true },
      });
      if (task.status !== "COMPLETED") return false;

      const { count } = await tx.orgTask.updateMany({
        where: { id: found.task.id, status: "COMPLETED" },
        data: { status: "PENDING", completedAt: null, completedById: null, awardedXp: 0 },
      });
      if (count === 0) return false;

      // The completer may have deleted their account (SetNull); then there's no XP to take back.
      if (task.completedById && task.awardedXp > 0) await addUserXp(tx, task.completedById, -task.awardedXp);
      return true;
    });
    if (!reopened) return { ok: false, error: "Esta tarea no está completada." };
  } catch (error) {
    console.error("reopenOrgTask failed", error);
    return GENERIC_ERROR;
  }

  revalidateBoard();
  return { ok: true };
}
