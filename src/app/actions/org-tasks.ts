"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dueDateFromInput } from "@/lib/dates";
import { addUserXp, unlockAchievements } from "@/lib/gamification/server";
import { canManageTasks } from "@/lib/organizations/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { orgTaskInputSchema, reviewNoteSchema, taskIdSchema, type OrgTaskFieldErrors } from "@/lib/validations/task";
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
  if (found.task.status !== "PENDING") return { ok: false, error: notEditable(found.task.status) };

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
  if (count === 0) return { ok: false, error: "Solo se pueden editar tareas pendientes." };

  revalidateBoard();
  return { ok: true };
}

function notEditable(status: string) {
  return status === "IN_REVIEW" ? "Revisa la tarea antes de editarla." : "Reabre la tarea antes de editarla.";
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
    // A note left for a previous assignee isn't meant for the new one.
    data: { assigneeId: user.id, selfAssigned: true, reviewNote: null },
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
    data: { assigneeId: null, selfAssigned: false, reviewNote: null },
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

/**
 * Completes a task in `from` status and pays its XP to `assigneeId`, once: the conditional update
 * makes a double click, or two reviewers approving at the same time, pay a single time.
 */
async function payCompletion(
  tx: Prisma.TransactionClient,
  taskId: string,
  assigneeId: string,
  reviewerId: string,
  from: "PENDING" | "IN_REVIEW",
): Promise<OrgCompletionOutcome | null> {
  const task = await tx.orgTask.findUniqueOrThrow({ where: { id: taskId }, select: { xpReward: true } });
  const now = new Date();
  const { count } = await tx.orgTask.updateMany({
    where: { id: taskId, status: from, assigneeId },
    data: {
      status: "COMPLETED",
      completedAt: now,
      completedById: assigneeId,
      reviewedById: reviewerId,
      reviewNote: null,
      awardedXp: task.xpReward,
    },
  });
  if (count === 0) return null;

  const { level, leveledUp } = await addUserXp(tx, assigneeId, task.xpReward);
  const achievements = await unlockAchievements(tx, assigneeId, level, now);
  return { xpDelta: task.xpReward, achievements, level, leveledUp };
}

export type SubmitOutcome = { status: "IN_REVIEW" } | ({ status: "COMPLETED" } & OrgCompletionOutcome);

/**
 * The assignee finishes the task. A member's work goes to review first; owners and admins are the
 * reviewers, so their own tasks complete (and pay) right away.
 */
export async function submitOrgTask(taskId: unknown): Promise<Result<SubmitOutcome>> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (found.task.assigneeId !== user.id) return { ok: false, error: "Solo quien tiene la tarea puede entregarla." };

  try {
    if (canManageTasks(found.role)) {
      const outcome = await prisma.$transaction((tx) => payCompletion(tx, found.task.id, user.id, user.id, "PENDING"));
      if (!outcome) return { ok: false, error: "Esta tarea ya no está pendiente." };
      revalidateBoard();
      return { ok: true, status: "COMPLETED", ...outcome };
    }

    const { count } = await prisma.orgTask.updateMany({
      where: { id: found.task.id, status: "PENDING", assigneeId: user.id },
      data: { status: "IN_REVIEW", submittedAt: new Date(), reviewNote: null },
    });
    if (count === 0) return { ok: false, error: "Esta tarea ya no está pendiente." };
  } catch (error) {
    console.error("submitOrgTask failed", error);
    return GENERIC_ERROR;
  }

  revalidateBoard();
  return { ok: true, status: "IN_REVIEW" };
}

/** A manager accepts the work: the task completes and its XP goes to the member who did it. */
export async function approveOrgTask(taskId: unknown): Promise<Result<{ xpDelta: number }>> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (!canManageTasks(found.role)) return FORBIDDEN;
  const { assigneeId } = found.task;
  if (found.task.status !== "IN_REVIEW" || !assigneeId) return { ok: false, error: "Esta tarea no está en revisión." };

  try {
    const outcome = await prisma.$transaction((tx) =>
      payCompletion(tx, found.task.id, assigneeId, user.id, "IN_REVIEW"),
    );
    if (!outcome) return { ok: false, error: "Esta tarea no está en revisión." };
    revalidateBoard();
    return { ok: true, xpDelta: outcome.xpDelta };
  } catch (error) {
    console.error("approveOrgTask failed", error);
    return GENERIC_ERROR;
  }
}

/** A manager sends the work back to the same member, optionally saying what to change. No XP moves. */
export async function rejectOrgTask(taskId: unknown, note?: unknown): Promise<Result> {
  const user = await requireUser();
  const found = await taskForMember(taskId, user.id);
  if (!found) return NOT_FOUND;
  if (!canManageTasks(found.role)) return FORBIDDEN;
  const parsed = reviewNoteSchema.safeParse(note ?? undefined);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nota no válida." };

  const { count } = await prisma.orgTask.updateMany({
    where: { id: found.task.id, status: "IN_REVIEW" },
    data: { status: "PENDING", submittedAt: null, reviewNote: parsed.data ?? null, reviewedById: user.id },
  });
  if (count === 0) return { ok: false, error: "Esta tarea no está en revisión." };

  revalidateBoard();
  return { ok: true };
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
        data: {
          status: "PENDING",
          completedAt: null,
          completedById: null,
          submittedAt: null,
          reviewedById: null,
          awardedXp: 0,
        },
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
