import type { Difficulty } from "@/generated/prisma/enums";

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 25,
  HARD: 50,
  EPIC: 100,
};

/** Total XP needed to reach `level`: 0, 100, 300, 600, 1000… (each level costs 100 more than the last). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * safeXp)) / 2));
  // Guard against floating point drift at exact thresholds.
  while (xpForLevel(level + 1) <= safeXp) level++;
  while (level > 1 && xpForLevel(level) > safeXp) level--;
  return level;
}

export interface LevelProgress {
  level: number;
  title: string;
  /** XP earned inside the current level. */
  current: number;
  /** XP the current level requires in total. */
  required: number;
  remaining: number;
  percent: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const required = xpForLevel(level + 1) - floor;
  const current = Math.max(0, xp - floor);

  return {
    level,
    title: levelTitle(level),
    current,
    required,
    remaining: required - current,
    percent: Math.min(100, (current / required) * 100),
  };
}

/** Title earned at each level, highest first. */
const LEVEL_TITLES: { level: number; title: string }[] = [
  { level: 20, title: "Leyenda" },
  { level: 15, title: "Héroe" },
  { level: 10, title: "Veterano" },
  { level: 5, title: "Aventurero" },
  { level: 3, title: "Aprendiz" },
  { level: 1, title: "Novato" },
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES.find((t) => level >= t.level)!.title;
}

/** The next title to unlock and the level it takes; null once the highest title is reached. */
export function nextLevelTitle(level: number): { level: number; title: string } | null {
  return LEVEL_TITLES.findLast((t) => t.level > level) ?? null;
}
