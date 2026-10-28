import { describe, expect, it } from "vitest";

import { getCalendarMonth, getUpcomingDeadlines } from "@/lib/data/calendar";
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

    // A member only sees their own.
    const { orgTasks } = await getCalendarMonth(me.id, OCTOBER);
    expect(orgTasks).toEqual([
      expect.objectContaining({
        title: "Mía",
        dueDate: "2026-10-20",
        status: "PENDING",
        organization: { name: "Equipo", slug: organization.slug },
        assignee: { userId: me.id, firstName: me.firstName, lastName: me.lastName },
        completedBy: null,
      }),
    ]);

    // The owner follows every dated task of their organization, open ones included.
    const owner = await getCalendarMonth(teammate.id, OCTOBER);
    expect(owner.orgTasks.map((t) => [t.title, t.assignee?.userId ?? null])).toEqual([
      ["Mía", me.id],
      ["Libre", null],
      ["Del compañero", teammate.id],
    ]);
  });

  it("says who finished a completed task", async () => {
    const me = await createUser();
    const admin = await createUser();
    const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });
    await prisma.membership.createMany({
      data: [
        { organizationId: organization.id, userId: me.id, role: "MEMBER" },
        { organizationId: organization.id, userId: admin.id, role: "ADMIN" },
      ],
    });
    await prisma.orgTask.create({
      data: {
        organizationId: organization.id,
        title: "Hecha",
        difficulty: "EASY",
        xpReward: 10,
        status: "COMPLETED",
        assigneeId: me.id,
        completedById: me.id,
        completedAt: new Date(),
        dueDate: dueDateFromInput("2026-10-05"),
      },
    });

    const { orgTasks } = await getCalendarMonth(admin.id, OCTOBER);
    expect(orgTasks).toEqual([
      expect.objectContaining({ title: "Hecha", status: "COMPLETED", completedBy: expect.objectContaining({ userId: me.id }) }),
    ]);
  });
});

describe("getUpcomingDeadlines", () => {
  const TODAY = "2026-10-28";

  async function team() {
    const owner = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });
    const other = await prisma.organization.create({ data: { name: "Otra", slug: `otra-${Date.now()}` } });
    await prisma.membership.createMany({
      data: [
        { organizationId: organization.id, userId: owner.id, role: "OWNER" },
        { organizationId: organization.id, userId: member.id, role: "MEMBER" },
        { organizationId: other.id, userId: outsider.id, role: "OWNER" },
      ],
    });
    const orgTask = (
      organizationId: string,
      title: string,
      assigneeId: string | null,
      dueDate: string,
      status: "PENDING" | "IN_REVIEW" | "COMPLETED" = "PENDING",
    ) =>
      prisma.orgTask.create({
        data: { organizationId, title, difficulty: "MEDIUM", xpReward: 25, assigneeId, status, dueDate: dueDateFromInput(dueDate) },
      });
    return { owner, member, organization, other, orgTask };
  }

  it("lists the next 7 days and the overdue pending ones, skipping what's done", async () => {
    const me = await createUser();
    await task(me.id, "Vencida", "2026-10-20");
    await task(me.id, "Vencida hecha", "2026-10-21", "COMPLETED");
    await task(me.id, "Hoy", TODAY);
    await task(me.id, "Hoy hecha", TODAY, "COMPLETED");
    await task(me.id, "En 6 días", "2026-11-03");
    await task(me.id, "En 7 días", "2026-11-04");
    await task(me.id, "Sin fecha", null);

    const { days, overdue } = await getUpcomingDeadlines(me.id, TODAY);
    expect(days.map((d) => d.key)).toEqual([
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(days.flatMap((d) => d.entries.map((e) => e.title))).toEqual(["Hoy", "En 6 días"]);
    expect(overdue.map((e) => e.title)).toEqual(["Vencida"]);
  });

  it("shows managers the whole team and members only their own", async () => {
    const { owner, member, organization, other, orgTask } = await team();
    await orgTask(organization.id, "Del miembro", member.id, "2026-10-29");
    await orgTask(organization.id, "Libre", null, "2026-10-30");
    await orgTask(organization.id, "En revisión", member.id, "2026-10-31", "IN_REVIEW");
    await orgTask(organization.id, "En revisión atrasada", member.id, "2026-10-01", "IN_REVIEW");
    await orgTask(organization.id, "Atrasada", member.id, "2026-10-02");
    await orgTask(organization.id, "Completada", member.id, "2026-10-29", "COMPLETED");
    await orgTask(other.id, "De otra org", null, "2026-10-29");

    const forOwner = await getUpcomingDeadlines(owner.id, TODAY);
    expect(forOwner.days.flatMap((d) => d.entries.map((e) => e.title))).toEqual(["Del miembro", "Libre", "En revisión"]);
    expect(forOwner.overdue.map((e) => e.title)).toEqual(["Atrasada"]);
    expect(forOwner.days[1].entries[0]).toMatchObject({
      kind: "org",
      assignee: { userId: member.id },
      organization: { name: "Equipo" },
    });

    const forMember = await getUpcomingDeadlines(member.id, TODAY);
    expect(forMember.days.flatMap((d) => d.entries.map((e) => e.title))).toEqual(["Del miembro", "En revisión"]);
    expect(forMember.overdue.map((e) => e.title)).toEqual(["Atrasada"]);
  });
});
