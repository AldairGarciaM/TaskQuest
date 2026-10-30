import { describe, expect, it } from "vitest";

import { approveOrgTask, claimOrgTask, createOrgTask, submitOrgTask } from "@/app/actions/org-tasks";
import { leaveOrganization } from "@/app/actions/organizations";
import { getDashboardOrgTasks, getMyOrgTasks } from "@/lib/data/org-board";
import { prisma } from "@/lib/prisma";

import { createUser, signInAs } from "./helpers";

async function organizationWith(name: string, owner: { id: string }, members: { id: string }[]) {
  const organization = await prisma.organization.create({
    data: { name, slug: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}` },
  });
  await prisma.membership.createMany({
    data: [
      { organizationId: organization.id, userId: owner.id, role: "OWNER" as const },
      ...members.map((m) => ({ organizationId: organization.id, userId: m.id, role: "MEMBER" as const })),
    ],
  });
  return organization;
}

async function addTask(organizationId: string, title: string, assigneeId?: string) {
  expect((await createOrgTask(organizationId, { title, difficulty: "EASY", assigneeId })).ok).toBe(true);
  return prisma.orgTask.findFirstOrThrow({ where: { title } });
}

const titles = (groups: Awaited<ReturnType<typeof getMyOrgTasks>>) =>
  groups.map((g) => [g.organization.name, g.tasks.map((t) => t.title).sort()]);

describe("getMyOrgTasks", () => {
  it("lists my pending tasks and the open ones, grouped by organization", async () => {
    const owner = await createUser();
    const me = await createUser();
    const other = await createUser();
    const alpha = await organizationWith("Alpha", owner, [me, other]);
    const beta = await organizationWith("Beta", owner, [me]);

    signInAs(owner);
    await addTask(alpha.id, "Mía en Alpha", me.id);
    await addTask(alpha.id, "Libre en Alpha");
    await addTask(alpha.id, "De otra persona", other.id);
    const done = await addTask(beta.id, "Ya hecha", me.id);
    await addTask(beta.id, "Libre en Beta");

    signInAs(me);
    await submitOrgTask(done.id);
    signInAs(owner);
    await approveOrgTask(done.id);

    expect(titles(await getMyOrgTasks(me.id))).toEqual([
      ["Alpha", ["Libre en Alpha", "Mía en Alpha"]],
      ["Beta", ["Libre en Beta"]],
    ]);
  });

  it("keeps my tasks in review and shows everyone's reviews only to managers", async () => {
    const owner = await createUser();
    const me = await createUser();
    const other = await createUser();
    const organization = await organizationWith("Equipo", owner, [me, other]);

    signInAs(owner);
    const mine = await addTask(organization.id, "Mi entrega", me.id);
    const theirs = await addTask(organization.id, "Su entrega", other.id);
    signInAs(me);
    await submitOrgTask(mine.id);
    signInAs(other);
    await submitOrgTask(theirs.id);

    const [memberView] = await getMyOrgTasks(me.id);
    expect(memberView.canReview).toBe(false);
    expect(memberView.tasks.map((t) => [t.title, t.status])).toEqual([["Mi entrega", "IN_REVIEW"]]);

    const [ownerView] = await getMyOrgTasks(owner.id);
    expect(ownerView.canReview).toBe(true);
    expect(ownerView.tasks.map((t) => t.title).sort()).toEqual(["Mi entrega", "Su entrega"]);
  });

  it("never shows tasks of organizations I don't belong to", async () => {
    const owner = await createUser();
    const me = await createUser();
    const mine = await organizationWith("Mía", owner, [me]);
    const foreign = await organizationWith("Ajena", owner, []);

    signInAs(owner);
    await addTask(mine.id, "Visible");
    await addTask(foreign.id, "Invisible");

    expect(titles(await getMyOrgTasks(me.id))).toEqual([["Mía", ["Visible"]]]);
  });

  it("keeps organizations without tasks and returns nothing without memberships", async () => {
    const owner = await createUser();
    const me = await createUser();
    await organizationWith("Vacía", owner, [me]);

    expect(titles(await getMyOrgTasks(me.id))).toEqual([["Vacía", []]]);
    expect(await getMyOrgTasks((await createUser()).id)).toEqual([]);
  });

  it("follows claims and leaving the organization", async () => {
    const owner = await createUser();
    const me = await createUser();
    const other = await createUser();
    const organization = await organizationWith("Equipo", owner, [me, other]);

    signInAs(owner);
    const task = await addTask(organization.id, "Disputada");

    signInAs(other);
    await claimOrgTask(task.id);
    expect(titles(await getMyOrgTasks(me.id))).toEqual([["Equipo", []]]);

    signInAs(me);
    expect((await leaveOrganization(organization.id)).ok).toBe(true);
    expect(await getMyOrgTasks(me.id)).toEqual([]);
  });
});

describe("getDashboardOrgTasks", () => {
  it("splits my team tasks into still open and completed by me, with their organization", async () => {
    const owner = await createUser();
    const me = await createUser();
    const other = await createUser();
    const alpha = await organizationWith("Alpha", owner, [me, other]);

    signInAs(owner);
    await addTask(alpha.id, "Pendiente mía", me.id);
    const review = await addTask(alpha.id, "En revisión mía", me.id);
    const done = await addTask(alpha.id, "Hecha por mí", me.id);
    await addTask(alpha.id, "Libre");
    const theirs = await addTask(alpha.id, "Hecha por otra persona", other.id);

    signInAs(me);
    await submitOrgTask(review.id);
    await submitOrgTask(done.id);
    signInAs(other);
    await submitOrgTask(theirs.id);
    signInAs(owner);
    await approveOrgTask(done.id);
    await approveOrgTask(theirs.id);

    const summary = await getDashboardOrgTasks(me.id, 5);
    expect(summary.active.map((t) => [t.title, t.status]).sort()).toEqual([
      ["En revisión mía", "IN_REVIEW"],
      ["Pendiente mía", "PENDING"],
    ]);
    expect(summary.completed.map((t) => t.title)).toEqual(["Hecha por mí"]);
    expect(summary.completedTotal).toBe(1);
    expect(summary.active[0]).toMatchObject({ organization: { name: "Alpha", slug: alpha.slug }, canReview: false });
    expect((await getDashboardOrgTasks(owner.id, 5)).active).toEqual([]);
  });

  it("keeps only the latest completed ones but counts them all, and marks where I manage", async () => {
    const me = await createUser();
    const alpha = await organizationWith("Alpha", me, []);
    signInAs(me);
    for (const title of ["Primera", "Segunda", "Tercera"]) {
      const task = await addTask(alpha.id, title, me.id);
      // A manager's own task skips review.
      await submitOrgTask(task.id);
    }

    const summary = await getDashboardOrgTasks(me.id, 2);
    expect(summary.completed.map((t) => t.title)).toEqual(["Tercera", "Segunda"]);
    expect(summary.completedTotal).toBe(3);
    expect(summary.completed[0].canReview).toBe(true);
  });

  it("drops organizations I left", async () => {
    const owner = await createUser();
    const me = await createUser();
    const alpha = await organizationWith("Alpha", owner, [me]);
    signInAs(owner);
    await addTask(alpha.id, "Pendiente mía", me.id);

    signInAs(me);
    await leaveOrganization(alpha.id);
    expect(await getDashboardOrgTasks(me.id, 5)).toEqual({ active: [], completed: [], completedTotal: 0 });
  });
});
