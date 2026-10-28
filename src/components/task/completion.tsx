import { Sparkles, Target, Trophy } from "lucide-react";
import { toast } from "sonner";

import { setTaskCompleted } from "@/app/actions/tasks";
import type { TaskDTO } from "@/lib/data/dashboard";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/gamification/achievements";

/**
 * Completes (or un-completes) a personal task and announces what it earned: XP, daily mission
 * bonuses, achievements and level ups. Shared by the dashboard list and the calendar.
 * Returns false when the server refused, so callers can roll back.
 */
export async function toggleTaskWithToasts(task: Pick<TaskDTO, "id" | "title">, isCompleted: boolean): Promise<boolean> {
  const result = await setTaskCompleted(task.id, isCompleted);

  if (!result.ok) {
    toast.error(result.error ?? "No pudimos actualizar la misión.");
    return false;
  }
  if (result.xpDelta > 0) {
    toast.success(`+${result.xpDelta} XP`, { description: `Completaste “${task.title}”` });
  } else if (result.xpDelta < 0) {
    toast(`${result.xpDelta} XP`, { description: `“${task.title}” volvió a pendientes` });
  }
  for (const reward of result.dailyRewards) {
    toast(`Misión diaria: ${reward.title}`, {
      description: `+${reward.xpReward} XP extra`,
      icon: <Target className="size-4 text-emerald-300" />,
    });
  }
  if (result.bonusXp < 0) {
    toast(`${result.bonusXp} XP de misiones diarias`, {
      description: "Una misión diaria ya no cumple su objetivo.",
    });
  }
  for (const key of result.achievements) {
    const achievement = ACHIEVEMENTS_BY_KEY.get(key);
    if (!achievement) continue;
    toast(`Logro desbloqueado: ${achievement.title}`, {
      description: achievement.description,
      icon: <Trophy className="size-4 text-yellow-300" />,
      duration: 6000,
    });
  }
  if (result.leveledUp) {
    toast(`¡Subiste a nivel ${result.level}!`, {
      icon: <Sparkles className="size-4 text-yellow-300" />,
      duration: 6000,
    });
  }
  return true;
}
