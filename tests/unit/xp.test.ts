import { describe, expect, it } from "vitest";

import { levelFromXp, levelProgress, levelTitle, nextLevelTitle, XP_BY_DIFFICULTY, xpForLevel } from "@/lib/xp";

describe("xpForLevel", () => {
  it("each level costs 100 XP more than the previous one", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });
});

describe("levelFromXp", () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [1000, 5],
  ])("%i XP is level %i", (xp, level) => {
    expect(levelFromXp(xp)).toBe(level);
  });

  it("never goes below level 1 for negative or fractional XP", () => {
    expect(levelFromXp(-50)).toBe(1);
    expect(levelFromXp(99.9)).toBe(1);
  });

  it("matches the level thresholds for every XP value", () => {
    for (let xp = 0; xp < 100_000; xp += 13) {
      const level = levelFromXp(xp);
      expect(xpForLevel(level)).toBeLessThanOrEqual(xp);
      expect(xpForLevel(level + 1)).toBeGreaterThan(xp);
    }
  });
});

describe("levelProgress", () => {
  it("reports progress inside the current level", () => {
    expect(levelProgress(150)).toEqual({
      level: 2,
      title: "Novato",
      current: 50,
      required: 200,
      remaining: 150,
      percent: 25,
    });
  });

  it("starts each level at 0%", () => {
    expect(levelProgress(300)).toMatchObject({ level: 3, current: 0, percent: 0 });
  });
});

describe("levelTitle", () => {
  it.each([
    [1, "Novato"],
    [3, "Aprendiz"],
    [5, "Aventurero"],
    [10, "Veterano"],
    [15, "Héroe"],
    [20, "Leyenda"],
  ])("level %i is %s", (level, title) => {
    expect(levelTitle(level)).toBe(title);
  });
});

it("harder difficulties reward more XP", () => {
  const { EASY, MEDIUM, HARD, EPIC } = XP_BY_DIFFICULTY;
  expect(EASY).toBeLessThan(MEDIUM);
  expect(MEDIUM).toBeLessThan(HARD);
  expect(HARD).toBeLessThan(EPIC);
});

describe("levelTitle / nextLevelTitle", () => {
  it("names each level band and points to the next one", () => {
    expect([1, 2, 3, 4, 5, 9, 10, 15, 20, 40].map(levelTitle)).toEqual([
      "Novato",
      "Novato",
      "Aprendiz",
      "Aprendiz",
      "Aventurero",
      "Aventurero",
      "Veterano",
      "Héroe",
      "Leyenda",
      "Leyenda",
    ]);
    expect(nextLevelTitle(1)).toEqual({ level: 3, title: "Aprendiz" });
    expect(nextLevelTitle(4)).toEqual({ level: 5, title: "Aventurero" });
    expect(nextLevelTitle(19)).toEqual({ level: 20, title: "Leyenda" });
    expect(nextLevelTitle(20)).toBeNull();
  });
});
