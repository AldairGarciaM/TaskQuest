"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { approveOrgTask, claimOrgTask, rejectOrgTask, releaseOrgTask, submitOrgTask } from "@/app/actions/org-tasks";
import type { OrgTaskDTO } from "@/lib/data/org-board";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/gamification/achievements";

/**
 * Member and reviewer actions on an org task (take, release, submit, approve, send back) with their
 * toasts; shared by the board and the dashboard.
 */
export function useOrgTaskActions() {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Algo salió mal. Intenta de nuevo.");
        return;
      }
      success();
    });
  }

  function claim(task: OrgTaskDTO) {
    run(() => claimOrgTask(task.id), () => toast.success("Tarea tomada", { description: task.title }));
  }

  function release(task: OrgTaskDTO) {
    run(() => releaseOrgTask(task.id), () => toast("Tarea liberada", { description: task.title }));
  }

  function submit(task: OrgTaskDTO) {
    startTransition(async () => {
      const result = await submitOrgTask(task.id);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos entregar la tarea.");
        return;
      }
      if (result.status === "IN_REVIEW") {
        toast.success("Enviada a revisión", {
          description: `Recibirás ${task.xpReward} XP cuando un admin apruebe “${task.title}”.`,
        });
        return;
      }
      toast.success(`+${result.xpDelta} XP`, { description: `Completaste “${task.title}”` });
      for (const key of result.achievements) {
        const achievement = ACHIEVEMENTS_BY_KEY.get(key);
        if (achievement) toast(`Logro desbloqueado: ${achievement.title}`, { description: achievement.description });
      }
      if (result.leveledUp) toast(`¡Subiste a nivel ${result.level}!`);
    });
  }

  function approve(task: OrgTaskDTO) {
    run(
      () => approveOrgTask(task.id),
      () =>
        toast.success("Tarea aprobada", {
          description: task.assignee
            ? `${task.assignee.firstName} recibió ${task.xpReward} XP por “${task.title}”.`
            : task.title,
        }),
    );
  }

  function reject(task: OrgTaskDTO, note: string, onDone: () => void) {
    run(
      () => rejectOrgTask(task.id, note),
      () => {
        onDone();
        toast("Tarea devuelta", {
          description: task.assignee ? `${task.assignee.firstName} la verá con tus comentarios.` : task.title,
        });
      },
    );
  }

  return { pending, run, claim, release, submit, approve, reject };
}
