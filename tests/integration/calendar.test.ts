import { describe, expect, it } from "vitest";

import { getCalendarMonth } from "@/lib/data/calendar";
import { dueDateFromInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

import { createUser } from "./helpers";

const OCTOBER = { year: 2026, month: 10 };

async function task(userId: string, title: string, dueDate: string | null, status: "PENDING" | "COMPLETED" = "PENDING") {
  return prisma.task.create({
    data: {
      userId,
      title,
      difficulty: "EASY",
      xpReward: 10,
      status,
      dueDate: dueDate ? dueDateFromInput(dueDate) : null,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}

describe("getCalendarMonth", () => {
  it("returns my personal tasks due on the visible weeks, with the trailing days of the grid", async () => {
    const me = await createUser();
    const someoneElse = await createUser();
    await task(me.id, "Antes de la cuadrícula", "2026-09-27");
    await task(me.id, "Primer día visible", "2026-09-28");
    await task(me.id, "Mitad de mes", "2026-10-15", "COMPLETED");
    await task(me.id, "Último día visible", "2026-11-01");
    await task(me.id, "Después", "2026-11-02");
    await task(me.id, "Sin fecha", null);
    await task(me.id, "Sin fecha hecha", null, "COMPLETED");
    await task(someoneElse.id, "Ajena", "2026-10-15");

    const month = await getCalendarMonth(me.id, OCTOBER);
    expect(month.tasks.map((t) => [t.title, t.dueDate, t.status])).toEqual([
      ["Primer día visible", "2026-09-28", "PENDING"],
      ["Mitad de mes", "2026-10-15", "COMPLETED"],
      ["Último día visible", "2026-11-01", "PENDING"],
    ]);
    expect(month.undatedPending).toBe(1);
  });

  it("includes team tasks assigned to me in organizations I belong to", async () => {
    const me = await createUser();
    const teammate = await createUser();
    const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });
    const former = await prisma.organization.create({ data: { name: "Antigua", slug: `antigua-${Date.now()}` } });
    await prisma.membership.createMany({
      data: [
        { organizationId: organization.id, userId: me.id, role: "MEMBER" },
        { organizationId: organization.id, userId: teammate.id, role: "OWNER" },
      ],
    });
    const orgTask = (organizationId: string, title: string, assigneeId: string | null, dueDate: string | null) =>
      prisma.orgTask.create({
        data: {
          organizationId,
          title,
          difficulty: "HARD",
          xpReward: 50,
          assigneeId,
          dueDate: dueDate ? dueDateFromInput(dueDate) : null,
        },
      });
    await orgTask(organization.id, "Mía", me.id, "2026-10-20");
    await orgTask(organization.id, "Libre", null, "2026-10-20");
    await orgTask(organization.id, "Del compañero", teammate.id, "2026-10-20");
    await orgTask(organization.id, "Mía sin fecha", me.id, null);
    await orgTask(former.id, "De una org en la que ya no estoy", me.id, "2026-10-20");

    const { orgTasks } = await getCalendarMonth(me.id, OCTOBER);
    expect(orgTasks).toEqual([
      expect.objectContaining({
        title: "Mía",
        dueDate: "2026-10-20",
        status: "PENDING",
        organization: { name: "Equipo", slug: organization.slug },
      }),
    ]);
  });
});
