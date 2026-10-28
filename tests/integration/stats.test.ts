import { describe, expect, it } from "vitest";

import { getStats } from "@/lib/data/stats";
import { dueDateFromInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

import { createUser } from "./helpers";

const TODAY = "2026-10-28";
/** Noon in Mexico City, so the local day is unambiguous. */
const at = (day: string) => new Date(`${day}T18:00:00.000Z`);

describe("getStats", () => {
  it("adds up personal, team and daily bonus XP of the period, only mine", async () => {
    const me = await createUser({ xp: 500 });
    const other = await createUser();
    const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });

    await prisma.task.createMany({
      data: [
        // On time, late and undated completions inside the 7-day window.
        { userId: me.id, title: "A tiempo", difficulty: "HARD", xpReward: 50, status: "COMPLETED", completedAt: at("2026-10-27"), dueDate: dueDateFromInput("2026-10-27") },
        { userId: me.id, title: "Tarde", difficulty: "EASY", xpReward: 10, status: "COMPLETED", completedAt: at("2026-10-26"), dueDate: dueDateFromInput("2026-10-25") },
        { userId: me.id, title: "Sin fecha", difficulty: "EASY", xpReward: 10, status: "COMPLETED", completedAt: at("2026-10-22") },
        // Previous period and pending ones don't count for the current total.
        { userId: me.id, title: "Antes", difficulty: "MEDIUM", xpReward: 25, status: "COMPLETED", completedAt: at("2026-10-18") },
        { userId: me.id, title: "Pendiente", difficulty: "EPIC", xpReward: 100, status: "PENDING" },
        { userId: other.id, title: "Ajena", difficulty: "EPIC", xpReward: 100, status: "COMPLETED", completedAt: at("2026-10-27") },
      ],
    });
    await prisma.orgTask.create({
      data: {
        organizationId: organization.id,
        title: "De equipo",
        difficulty: "MEDIUM",
        xpReward: 25,
        awardedXp: 25,
        status: "COMPLETED",
        assigneeId: me.id,
        completedById: me.id,
        completedAt: at("2026-10-28"),
      },
    });
    await prisma.dailyMission.createMany({
      data: [
        { userId: me.id, day: "2026-10-27", type: "COMPLETE_HARD", target: 1, xpReward: 40, rewardedAt: at("2026-10-27") },
        { userId: me.id, day: "2026-10-28", type: "COMPLETE_TASKS", target: 3, xpReward: 30 },
      ],
    });

    const stats = await getStats(me.id, 7, TODAY);
    expect(stats).toMatchObject({
      xp: 50 + 10 + 10 + 25 + 40,
      previousXp: 25,
      completed: 4,
      dated: 2,
      onTime: 1,
      byDifficulty: { EASY: 2, MEDIUM: 1, HARD: 1, EPIC: 0 },
      totalXp: 500,
    });
    expect(stats.buckets.find((b) => b.from === "2026-10-27")?.xp).toEqual({ personal: 50, bonus: 40, team: 0 });
    expect(stats.buckets.find((b) => b.from === "2026-10-28")?.xp).toEqual({ personal: 0, bonus: 0, team: 25 });
    // 26, 27 Oct in a row (the 22nd and the 18th stand alone); streaks count personal missions only.
    expect(stats.bestStreak).toBe(2);
  });
});
