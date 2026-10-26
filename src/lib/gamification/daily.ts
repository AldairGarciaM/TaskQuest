import type { DailyMissionType, Difficulty } from "@/generated/prisma/enums";

export const DAILY_MISSIONS_PER_DAY = 3;

interface DailyMissionDefinition {
  title: string;
  description: (target: number) => string;
  target: number;
  xpReward: number;
}

export const DAILY_CATALOG: Record<DailyMissionType, DailyMissionDefinition> = {
  COMPLETE_TASKS: {
    title: "Ritmo constante",
    description: (target) => `Completa ${target} misiones hoy`,
    target: 3,
    xpReward: 30,
  },
  COMPLETE_HARD: {
    title: "Reto mayor",
    description: () => "Completa una misión Difícil o Épica",
    target: 1,
    xpReward: 40,
  },
  COMPLETE_ON_TIME: {
    title: "Puntualidad",
    description: (target) => `Completa ${target} misiones con fecha límite antes de que venzan`,
    target: 2,
    xpReward: 30,
  },
  COMPLETE_VARIETY: {
    title: "Versatilidad",
    description: (target) => `Completa misiones de ${target} dificultades distintas`,
    target: 2,
    xpReward: 25,
  },
};

const ALL_TYPES = Object.keys(DAILY_CATALOG) as DailyMissionType[];

/** Small deterministic hash so the same user gets the same missions all day. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Picks today's mission types for a user, in a stable order. */
export function pickDailyTypes(userId: string, day: string): DailyMissionType[] {
  let seed = hash(`${userId}:${day}`);
  const pool = [...ALL_TYPES];
  const picked: DailyMissionType[] = [];
  while (picked.length < DAILY_MISSIONS_PER_DAY && pool.length > 0) {
    const index = seed % pool.length;
    picked.push(...pool.splice(index, 1));
    seed = Math.floor(seed / 7) + 1;
  }
  return picked;
}

export interface CompletionToday {
  difficulty: Difficulty;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  /** Day the task was completed, "YYYY-MM-DD" in APP_TIME_ZONE. */
  completedDay: string;
}

/** Progress of a mission given the tasks completed today. */
export function dailyProgress(type: DailyMissionType, completions: CompletionToday[]): number {
  switch (type) {
    case "COMPLETE_TASKS":
      return completions.length;
    case "COMPLETE_HARD":
      return completions.filter((c) => c.difficulty === "HARD" || c.difficulty === "EPIC").length;
    case "COMPLETE_ON_TIME":
      return completions.filter((c) => c.dueDate !== null && c.completedDay <= c.dueDate).length;
    case "COMPLETE_VARIETY":
      return new Set(completions.map((c) => c.difficulty)).size;
  }
}
