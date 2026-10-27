"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { claimOrgTask, completeOrgTask, releaseOrgTask } from "@/app/actions/org-tasks";
import type { OrgTaskDTO } from "@/lib/data/org-board";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/gamification/achievements";

/** Member actions on an org task (take, release, complete) with their toasts; shared by the board and the dashboard. */
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

  function complete(task: OrgTaskDTO) {
    startTransition(async () => {
      const result = await completeOrgTask(task.id);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos completar la tarea.");
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

  return { pending, run, claim, release, complete };
}
