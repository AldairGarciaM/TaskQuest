export interface AchievementStats {
  completedCount: number;
  epicCompletedCount: number;
  streak: number;
  level: number;
  /** True once every daily mission of a single day has been rewarded. */
  completedAllDailyMissions: boolean;
}

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  /** Lucide icon name, resolved in the UI. */
  icon: "Footprints" | "Repeat" | "Rocket" | "Medal" | "Crown" | "Flame" | "CalendarCheck" | "Compass" | "Shield" | "Sun";
  progress: (stats: AchievementStats) => { current: number; target: number };
}

const count = (current: number, target: number) => ({ current: Math.min(current, target), target });

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first-quest",
    title: "Primer paso",
    description: "Completa tu primera misión",
    icon: "Footprints",
    progress: (s) => count(s.completedCount, 1),
  },
  {
    key: "quests-10",
    title: "Constante",
    description: "Completa 10 misiones",
    icon: "Repeat",
    progress: (s) => count(s.completedCount, 10),
  },
  {
    key: "quests-50",
    title: "Imparable",
    description: "Completa 50 misiones",
    icon: "Rocket",
    progress: (s) => count(s.completedCount, 50),
  },
  {
    key: "quests-100",
    title: "Centenario",
    description: "Completa 100 misiones",
    icon: "Medal",
    progress: (s) => count(s.completedCount, 100),
  },
  {
    key: "first-epic",
    title: "Hazaña épica",
    description: "Completa una misión Épica",
    icon: "Crown",
    progress: (s) => count(s.epicCompletedCount, 1),
  },
  {
    key: "streak-3",
    title: "En racha",
    description: "Completa misiones 3 días seguidos",
    icon: "Flame",
    progress: (s) => count(s.streak, 3),
  },
  {
    key: "streak-7",
    title: "Semana perfecta",
    description: "Completa misiones 7 días seguidos",
    icon: "CalendarCheck",
    progress: (s) => count(s.streak, 7),
  },
  {
    key: "level-5",
    title: "Aventurero",
    description: "Alcanza el nivel 5",
    icon: "Compass",
    progress: (s) => count(s.level, 5),
  },
  {
    key: "level-10",
    title: "Veterano",
    description: "Alcanza el nivel 10",
    icon: "Shield",
    progress: (s) => count(s.level, 10),
  },
  {
    key: "daily-sweep",
    title: "Día redondo",
    description: "Completa todas las misiones diarias de un día",
    icon: "Sun",
    progress: (s) => count(s.completedAllDailyMissions ? 1 : 0, 1),
  },
];

export const ACHIEVEMENTS_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

/** Keys whose requirement is met and that the user doesn't have yet. */
export function newlyUnlocked(stats: AchievementStats, unlocked: ReadonlySet<string>): string[] {
  return ACHIEVEMENTS.filter((achievement) => {
    if (unlocked.has(achievement.key)) return false;
    const { current, target } = achievement.progress(stats);
    return current >= target;
  }).map((achievement) => achievement.key);
}
