import { describe, expect, it } from "vitest";

import { claimOrgTask, completeOrgTask, createOrgTask } from "@/app/actions/org-tasks";
import { leaveOrganization } from "@/app/actions/organizations";
import { getMyOrgTasks } from "@/lib/data/org-board";
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
    await completeOrgTask(done.id);

    expect(titles(await getMyOrgTasks(me.id))).toEqual([
      ["Alpha", ["Libre en Alpha", "Mía en Alpha"]],
      ["Beta", ["Libre en Beta"]],
    ]);
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
