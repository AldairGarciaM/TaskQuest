import { describe, expect, it } from "vitest";

import {
  claimOrgTask,
  completeOrgTask,
  createOrgTask,
  deleteOrgTask,
  releaseOrgTask,
  reopenOrgTask,
  updateOrgTask,
} from "@/app/actions/org-tasks";
import { leaveOrganization, removeMember } from "@/app/actions/organizations";
import type { OrgRole } from "@/generated/prisma/enums";
import { getOrgBoard } from "@/lib/data/org-board";
import { getOrganizationForMember } from "@/lib/data/organizations";
import { prisma } from "@/lib/prisma";

import { createUser, signInAs, signOut } from "./helpers";

type TestUser = Awaited<ReturnType<typeof createUser>>;

async function setup() {
  const owner = await createUser();
  const admin = await createUser();
  const member = await createUser();
  const other = await createUser();
  const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });
  const roles: [TestUser, OrgRole][] = [
    [owner, "OWNER"],
    [admin, "ADMIN"],
    [member, "MEMBER"],
    [other, "MEMBER"],
  ];
  await prisma.membership.createMany({
    data: roles.map(([user, role]) => ({ organizationId: organization.id, userId: user.id, role })),
  });
  signInAs(owner);
  return { owner, admin, member, other, organization };
}

async function newTask(organizationId: string, input: Record<string, unknown> = {}) {
  const result = await createOrgTask(organizationId, { title: "Revisar portada", difficulty: "HARD", ...input });
  expect(result).toEqual({ ok: true });
  return prisma.orgTask.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
}

const userXp = (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, select: { xp: true, level: true } });

describe("createOrgTask", () => {
  it("creates an open task with server-side XP when no assignee is chosen", async () => {
    const { owner, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: "", xpReward: 9999 });

    expect(task).toMatchObject({ assigneeId: null, xpReward: 50, status: "PENDING", createdById: owner.id });
  });

  it("assigns the task to a chosen member", async () => {
    const { member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    expect(task).toMatchObject({ assigneeId: member.id, selfAssigned: false });
  });

  it("rejects assignees outside the organization", async () => {
    const { organization } = await setup();
    const outsider = await createUser();
    const result = await createOrgTask(organization.id, { title: "X", difficulty: "EASY", assigneeId: outsider.id });
    expect(result).toMatchObject({ ok: false, fieldErrors: { assigneeId: expect.any(Array) } });
  });

  it("lets admins create tasks but not members or outsiders", async () => {
    const { admin, member, organization } = await setup();

    signInAs(admin);
    expect((await createOrgTask(organization.id, { title: "A", difficulty: "EASY" })).ok).toBe(true);

    signInAs(member);
    expect((await createOrgTask(organization.id, { title: "B", difficulty: "EASY" })).ok).toBe(false);

    signInAs(await createUser());
    expect((await createOrgTask(organization.id, { title: "C", difficulty: "EASY" })).ok).toBe(false);
    expect(await prisma.orgTask.count()).toBe(1);
  });

  it("requires a session", async () => {
    const { organization } = await setup();
    signOut();
    await expect(createOrgTask(organization.id, { title: "X", difficulty: "EASY" })).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("claim and release", () => {
  it("lets any member take an open task, but only one of them", async () => {
    const { member, other, organization } = await setup();
    const task = await newTask(organization.id);

    signInAs(member);
    expect((await claimOrgTask(task.id)).ok).toBe(true);
    signInAs(other);
    expect(await claimOrgTask(task.id)).toMatchObject({ ok: false });

    expect(await prisma.orgTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      assigneeId: member.id,
      selfAssigned: true,
    });
  });

  it("lets only one of two parallel claims through", async () => {
    const { member, organization } = await setup();
    const task = await newTask(organization.id);

    signInAs(member);
    const results = await Promise.all([claimOrgTask(task.id), claimOrgTask(task.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("can't claim a task assigned to someone else", async () => {
    const { member, other, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });

    signInAs(other);
    expect((await claimOrgTask(task.id)).ok).toBe(false);
  });

  it("releases self-taken tasks but keeps tasks a manager assigned", async () => {
    const { member, organization } = await setup();
    const open = await newTask(organization.id);
    const assigned = await newTask(organization.id, { assigneeId: member.id });

    signInAs(member);
    await claimOrgTask(open.id);
    expect((await releaseOrgTask(open.id)).ok).toBe(true);
    expect((await prisma.orgTask.findUniqueOrThrow({ where: { id: open.id } })).assigneeId).toBeNull();

    expect((await releaseOrgTask(assigned.id)).ok).toBe(false);
    expect((await prisma.orgTask.findUniqueOrThrow({ where: { id: assigned.id } })).assigneeId).toBe(member.id);
  });
});

describe("completeOrgTask", () => {
  it("pays the XP to the assignee's personal level, once", async () => {
    const { member, organization } = await setup();
    await prisma.user.update({ where: { id: member.id }, data: { xp: 80 } });
    const task = await newTask(organization.id, { assigneeId: member.id });

    signInAs(member);
    const result = await completeOrgTask(task.id);
    expect(result).toMatchObject({ ok: true, xpDelta: 50, level: 2, leveledUp: true });
    expect(await userXp(member.id)).toEqual({ xp: 130, level: 2 });

    expect((await completeOrgTask(task.id)).ok).toBe(false);
    expect(await userXp(member.id)).toEqual({ xp: 130, level: 2 });
    expect(await prisma.orgTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      status: "COMPLETED",
      completedById: member.id,
      awardedXp: 50,
    });
  });

  it("doesn't pay twice for parallel clicks", async () => {
    const { member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });

    signInAs(member);
    const results = await Promise.all([completeOrgTask(task.id), completeOrgTask(task.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await userXp(member.id)).xp).toBe(50);
  });

  it("only the assignee can complete it", async () => {
    const { owner, member, other, organization } = await setup();
    const open = await newTask(organization.id);
    const assigned = await newTask(organization.id, { assigneeId: member.id });

    signInAs(other);
    expect((await completeOrgTask(open.id)).ok).toBe(false);
    expect((await completeOrgTask(assigned.id)).ok).toBe(false);
    signInAs(owner);
    expect((await completeOrgTask(assigned.id)).ok).toBe(false);
  });
});

describe("manager actions", () => {
  it("reopens a completed task and takes the XP back", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await completeOrgTask(task.id);
    expect((await reopenOrgTask(task.id)).ok).toBe(false);

    signInAs(owner);
    expect((await reopenOrgTask(task.id)).ok).toBe(true);

    expect(await userXp(member.id)).toEqual({ xp: 0, level: 1 });
    expect(await prisma.orgTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      status: "PENDING",
      assigneeId: member.id,
      completedById: null,
      awardedXp: 0,
    });
    expect((await reopenOrgTask(task.id)).ok).toBe(false);
  });

  it("edits pending tasks, including the assignee, but not completed ones", async () => {
    const { member, other, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });

    const result = await updateOrgTask(task.id, { title: "Nuevo", difficulty: "EPIC", assigneeId: other.id });
    expect(result.ok).toBe(true);
    expect(await prisma.orgTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      title: "Nuevo",
      xpReward: 100,
      assigneeId: other.id,
    });

    expect((await updateOrgTask(task.id, { title: "Libre", difficulty: "EPIC", assigneeId: "" })).ok).toBe(true);
    expect((await prisma.orgTask.findUniqueOrThrow({ where: { id: task.id } })).assigneeId).toBeNull();

    signInAs(member);
    expect((await updateOrgTask(task.id, { title: "Hack", difficulty: "EASY" })).ok).toBe(false);
  });

  it("refuses to edit a completed task", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await completeOrgTask(task.id);

    signInAs(owner);
    expect(await updateOrgTask(task.id, { title: "X", difficulty: "EPIC" })).toMatchObject({ ok: false });
  });

  it("deleting a completed task keeps the XP", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await completeOrgTask(task.id);
    expect((await deleteOrgTask(task.id)).ok).toBe(false);

    signInAs(owner);
    expect((await deleteOrgTask(task.id)).ok).toBe(true);
    expect(await prisma.orgTask.count()).toBe(0);
    expect((await userXp(member.id)).xp).toBe(50);
  });
});

describe("membership changes", () => {
  it("frees the pending tasks of someone who is removed or leaves", async () => {
    const { member, other, organization } = await setup();
    const removedTask = await newTask(organization.id, { assigneeId: member.id });
    const leftTask = await newTask(organization.id, { assigneeId: other.id });

    expect((await removeMember(organization.id, member.id)).ok).toBe(true);
    signInAs(other);
    expect((await leaveOrganization(organization.id)).ok).toBe(true);

    const tasks = await prisma.orgTask.findMany({ where: { id: { in: [removedTask.id, leftTask.id] } } });
    expect(tasks.every((t) => t.assigneeId === null)).toBe(true);

    signInAs(member);
    expect((await claimOrgTask(removedTask.id)).ok).toBe(false);
  });
});

describe("getOrgBoard ranking", () => {
  it("ranks current members by XP earned in the organization", async () => {
    const { owner, member, other, organization } = await setup();
    const a = await newTask(organization.id, { assigneeId: member.id, difficulty: "EPIC" });
    const b = await newTask(organization.id, { assigneeId: other.id, difficulty: "EASY" });
    const c = await newTask(organization.id, { assigneeId: other.id, difficulty: "EASY" });
    signInAs(member);
    await completeOrgTask(a.id);
    signInAs(other);
    await completeOrgTask(b.id);
    await completeOrgTask(c.id);

    const detail = await getOrganizationForMember(organization.slug, owner.id);
    const { ranking, tasks } = await getOrgBoard(organization.id, detail!.members);
    expect(ranking.slice(0, 2).map((r) => [r.userId, r.xp, r.completed])).toEqual([
      [member.id, 100, 1],
      [other.id, 20, 2],
    ]);
    expect(ranking).toHaveLength(4);
    expect(tasks).toHaveLength(3);
  });
});
