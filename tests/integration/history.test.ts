import { describe, expect, it } from "vitest";

import { getHistory, parseCursor, parseHistoryFilter } from "@/lib/data/history";
import { prisma } from "@/lib/prisma";

import { createUser } from "./helpers";

const at = (iso: string) => new Date(iso);

async function seed() {
  const me = await createUser();
  const reviewer = await createUser({ firstName: "Lucía" });
  const other = await createUser();
  const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });

  // A mission and the bonus it triggered share the same instant.
  const tie = at("2026-10-27T18:00:00.000Z");
  await prisma.task.createMany({
    data: [
      { userId: me.id, title: "Hecha", difficulty: "HARD", xpReward: 50, status: "COMPLETED", completedAt: tie },
      { userId: me.id, title: "Vieja", difficulty: "EASY", xpReward: 10, status: "COMPLETED", completedAt: at("2026-10-20T18:00:00.000Z") },
      { userId: me.id, title: "Pendiente", difficulty: "EASY", xpReward: 10, status: "PENDING" },
      { userId: other.id, title: "Ajena", difficulty: "EASY", xpReward: 10, status: "COMPLETED", completedAt: tie },
    ],
  });
  await prisma.dailyMission.createMany({
    data: [
      { userId: me.id, day: "2026-10-27", type: "COMPLETE_HARD", target: 1, xpReward: 40, rewardedAt: tie },
      { userId: me.id, day: "2026-10-27", type: "COMPLETE_TASKS", target: 3, xpReward: 30 },
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
      reviewedById: reviewer.id,
      completedAt: at("2026-10-28T15:00:00.000Z"),
    },
  });
  await prisma.userAchievement.create({ data: { userId: me.id, key: "first-quest", unlockedAt: at("2026-10-20T18:00:01.000Z") } });
  return { me, reviewer };
}

describe("getHistory", () => {
  it("merges everything I achieved, newest first", async () => {
    const { me } = await seed();
    const { items, nextCursor } = await getHistory(me.id);

    expect(items.map((i) => i.kind)).toEqual(["team", "personal", "bonus", "achievement", "personal"]);
    expect(items[0]).toMatchObject({ title: "De equipo", xp: 25, approvedBy: expect.stringMatching(/^Lucía /) });
    expect(items[2]).toMatchObject({ mission: "COMPLETE_HARD", xp: 40 });
    expect(nextCursor).toBeNull();
  });

  it("filters by kind", async () => {
    const { me } = await seed();
    expect((await getHistory(me.id, { filter: "missions" })).items.map((i) => i.kind)).toEqual(["personal", "bonus", "personal"]);
    expect((await getHistory(me.id, { filter: "team" })).items).toHaveLength(1);
    expect((await getHistory(me.id, { filter: "achievements" })).items).toEqual([
      expect.objectContaining({ kind: "achievement", key: "first-quest" }),
    ]);
  });

  it("pages backwards without splitting items that happened at the same instant", async () => {
    const { me } = await seed();
    const first = await getHistory(me.id, { limit: 2 });
    // The second item ties with the third (mission + its bonus), so both stay on this page.
    expect(first.items.map((i) => i.kind)).toEqual(["team", "personal", "bonus"]);
    expect(first.nextCursor).toBe("2026-10-27T18:00:00.000Z");

    const second = await getHistory(me.id, { limit: 2, before: parseCursor(first.nextCursor!) });
    expect(second.items.map((i) => i.kind)).toEqual(["achievement", "personal"]);
    expect(second.nextCursor).toBeNull();
  });

  it("parses its URL params defensively", () => {
    expect(parseHistoryFilter("team")).toBe("team");
    expect(parseHistoryFilter("nope")).toBe("all");
    expect(parseHistoryFilter(["team"])).toBe("all");
    expect(parseCursor("not a date")).toBeNull();
    expect(parseCursor(undefined)).toBeNull();
  });
});
