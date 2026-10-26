import { describe, expect, it } from "vitest";

import { createTask, setTaskCompleted } from "@/app/actions/tasks";
import type { DailyMissionType } from "@/generated/prisma/enums";
import { getAchievements } from "@/lib/data/achievements";
import { getDashboardData } from "@/lib/data/dashboard";
import { dayKey } from "@/lib/dates";
import { DAILY_CATALOG } from "@/lib/gamification/daily";
import { prisma } from "@/lib/prisma";

import { createSignedInUser } from "./helpers";

const today = () => dayKey(new Date());

async function newTask(title: string, difficulty: "EASY" | "MEDIUM" | "HARD" | "EPIC") {
  expect((await createTask({ title, difficulty })).ok).toBe(true);
  return prisma.task.findFirstOrThrow({ where: { title } });
}

/** Replaces today's daily missions with a known set so tests don't depend on the random pick. */
async function setTodayMissions(userId: string, types: DailyMissionType[]) {
  await prisma.dailyMission.deleteMany({ where: { userId } });
  await prisma.dailyMission.createMany({
    data: types.map((type) => ({
      userId,
      day: today(),
      type,
      target: DAILY_CATALOG[type].target,
      xpReward: DAILY_CATALOG[type].xpReward,
    })),
  });
}

const xpOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).xp;

describe("daily missions", () => {
  it("creates three missions for today when the dashboard loads", async () => {
    const user = await createSignedInUser();

    const data = await getDashboardData(user.id);
    await getDashboardData(user.id);

    expect(data.dailyMissions).toHaveLength(3);
    expect(await prisma.dailyMission.count({ where: { userId: user.id, day: today() } })).toBe(3);
    expect(data.dailyMissions.every((m) => m.progress === 0 && !m.rewarded)).toBe(true);
  });

  it("grants the bonus once when a mission reaches its target", async () => {
    const user = await createSignedInUser();
    await setTodayMissions(user.id, ["COMPLETE_HARD", "COMPLETE_TASKS", "COMPLETE_VARIETY"]);
    const hard = await newTask("Difícil", "HARD");
    const epic = await newTask("Épica", "EPIC");

    const first = await setTaskCompleted(hard.id, true);
    expect(first).toMatchObject({ ok: true, xpDelta: 50, bonusXp: 40 });
    if (first.ok) expect(first.dailyRewards).toEqual([{ title: "Reto mayor", xpReward: 40 }]);

    // A second hard task doesn't pay the same mission again, but completes "variety" (2 difficulties).
    const second = await setTaskCompleted(epic.id, true);
    expect(second).toMatchObject({ ok: true, xpDelta: 100, bonusXp: 25 });

    expect(await xpOf(user.id)).toBe(50 + 40 + 100 + 25);
  });

  it("takes the bonus back when the mission drops below its target", async () => {
    const user = await createSignedInUser();
    await setTodayMissions(user.id, ["COMPLETE_HARD", "COMPLETE_TASKS", "COMPLETE_ON_TIME"]);
    const hard = await newTask("Difícil", "HARD");

    await setTaskCompleted(hard.id, true);
    expect(await xpOf(user.id)).toBe(90);

    expect(await setTaskCompleted(hard.id, false)).toMatchObject({ ok: true, xpDelta: -50, bonusXp: -40 });
    expect(await xpOf(user.id)).toBe(0);
    expect(await prisma.dailyMission.count({ where: { userId: user.id, rewardedAt: { not: null } } })).toBe(0);

    // Completing again pays everything once more, never twice.
    await setTaskCompleted(hard.id, true);
    expect(await xpOf(user.id)).toBe(90);
  });

  it("shows live progress on the dashboard", async () => {
    const user = await createSignedInUser();
    await setTodayMissions(user.id, ["COMPLETE_TASKS", "COMPLETE_HARD", "COMPLETE_VARIETY"]);
    const easy = await newTask("Fácil", "EASY");
    await setTaskCompleted(easy.id, true);

    const { dailyMissions } = await getDashboardData(user.id);
    expect(dailyMissions.find((m) => m.type === "COMPLETE_TASKS")).toMatchObject({ progress: 1, target: 3, rewarded: false });
    expect(dailyMissions.find((m) => m.type === "COMPLETE_HARD")).toMatchObject({ progress: 0 });
  });
});

describe("achievements", () => {
  it("unlocks achievements as tasks are completed and keeps them", async () => {
    const user = await createSignedInUser();
    await setTodayMissions(user.id, ["COMPLETE_TASKS", "COMPLETE_ON_TIME", "COMPLETE_VARIETY"]);
    const epic = await newTask("Épica", "EPIC");

    const result = await setTaskCompleted(epic.id, true);
    expect(result.ok && result.achievements.sort()).toEqual(["first-epic", "first-quest"]);

    // Marking it as pending doesn't take achievements away, and completing again doesn't repeat them.
    await setTaskCompleted(epic.id, false);
    const again = await setTaskCompleted(epic.id, true);
    expect(again.ok && again.achievements).toEqual([]);
    expect(await prisma.userAchievement.count({ where: { userId: user.id } })).toBe(2);
  });

  it("unlocks the daily sweep when every daily mission is done", async () => {
    const user = await createSignedInUser();
    await setTodayMissions(user.id, ["COMPLETE_HARD", "COMPLETE_VARIETY", "COMPLETE_TASKS"]);
    const tasks = [await newTask("A", "HARD"), await newTask("B", "EASY"), await newTask("C", "MEDIUM")];

    let unlocked: string[] = [];
    for (const task of tasks) {
      const result = await setTaskCompleted(task.id, true);
      if (result.ok) unlocked = unlocked.concat(result.achievements);
    }
    expect(unlocked).toContain("daily-sweep");
  });

  it("reports progress toward locked achievements", async () => {
    const user = await createSignedInUser();
    const task = await newTask("Una", "EASY");
    await setTaskCompleted(task.id, true);

    const achievements = await getAchievements(user.id);
    expect(achievements.find((a) => a.key === "first-quest")).toMatchObject({ current: 1, target: 1 });
    expect(achievements.find((a) => a.key === "first-quest")?.unlockedAt).not.toBeNull();
    expect(achievements.find((a) => a.key === "quests-10")).toMatchObject({ current: 1, target: 10, unlockedAt: null });
  });
});
