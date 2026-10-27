import { describe, expect, it } from "vitest";

import {
  approveOrgTask,
  claimOrgTask,
  createOrgTask,
  deleteOrgTask,
  rejectOrgTask,
  releaseOrgTask,
  reopenOrgTask,
  submitOrgTask,
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

/** The assignee hands it in and a manager approves it. */
async function completeAs(assignee: TestUser, taskId: string, reviewer: TestUser) {
  signInAs(assignee);
  expect(await submitOrgTask(taskId)).toMatchObject({ ok: true, status: "IN_REVIEW" });
  signInAs(reviewer);
  expect((await approveOrgTask(taskId)).ok).toBe(true);
}

const userXp = (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, select: { xp: true, level: true } });
const taskRow = (id: string) => prisma.orgTask.findUniqueOrThrow({ where: { id } });

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

    expect(await taskRow(task.id)).toMatchObject({ assigneeId: member.id, selfAssigned: true });
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
    expect((await taskRow(open.id)).assigneeId).toBeNull();

    expect((await releaseOrgTask(assigned.id)).ok).toBe(false);
    expect((await taskRow(assigned.id)).assigneeId).toBe(member.id);
  });
});

describe("review flow", () => {
  it("sends a member's work to review without paying, then pays the member on approval, once", async () => {
    const { owner, member, organization } = await setup();
    await prisma.user.update({ where: { id: member.id }, data: { xp: 80 } });
    const task = await newTask(organization.id, { assigneeId: member.id });

    signInAs(member);
    expect(await submitOrgTask(task.id)).toEqual({ ok: true, status: "IN_REVIEW" });
    expect(await taskRow(task.id)).toMatchObject({ status: "IN_REVIEW", awardedXp: 0, submittedAt: expect.any(Date) });
    expect(await userXp(member.id)).toEqual({ xp: 80, level: 1 });
    expect((await submitOrgTask(task.id)).ok).toBe(false);

    signInAs(owner);
    expect(await approveOrgTask(task.id)).toEqual({ ok: true, xpDelta: 50 });
    expect(await userXp(member.id)).toEqual({ xp: 130, level: 2 });
    expect(await userXp(owner.id)).toEqual({ xp: 0, level: 1 });
    expect(await taskRow(task.id)).toMatchObject({
      status: "COMPLETED",
      completedById: member.id,
      reviewedById: owner.id,
      awardedXp: 50,
    });

    expect((await approveOrgTask(task.id)).ok).toBe(false);
    expect((await userXp(member.id)).xp).toBe(130);
  });

  it("unlocks the member's level achievements on approval, not the reviewer's", async () => {
    const { owner, member, organization } = await setup();
    await prisma.user.update({ where: { id: member.id }, data: { xp: 980 } });
    const task = await newTask(organization.id, { assigneeId: member.id });

    await completeAs(member, task.id, owner);
    const unlocked = await prisma.userAchievement.findMany({ where: { userId: member.id }, select: { key: true } });
    expect(unlocked.map((a) => a.key)).toContain("level-5");
    expect(await prisma.userAchievement.count({ where: { userId: owner.id } })).toBe(0);
  });

  it("doesn't pay twice when two reviewers approve at the same time", async () => {
    const { admin, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await submitOrgTask(task.id);

    signInAs(admin);
    const results = await Promise.all([approveOrgTask(task.id), approveOrgTask(task.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await userXp(member.id)).xp).toBe(50);
  });

  it("only the assignee can hand the task in", async () => {
    const { owner, member, other, organization } = await setup();
    const open = await newTask(organization.id);
    const assigned = await newTask(organization.id, { assigneeId: member.id });

    signInAs(other);
    expect((await submitOrgTask(open.id)).ok).toBe(false);
    expect((await submitOrgTask(assigned.id)).ok).toBe(false);
    signInAs(owner);
    expect((await submitOrgTask(assigned.id)).ok).toBe(false);
    expect((await taskRow(assigned.id)).status).toBe("PENDING");
  });

  it("completes a manager's own task right away", async () => {
    const { admin, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: admin.id });

    signInAs(admin);
    expect(await submitOrgTask(task.id)).toMatchObject({ ok: true, status: "COMPLETED", xpDelta: 50 });
    expect((await userXp(admin.id)).xp).toBe(50);
    expect(await taskRow(task.id)).toMatchObject({ status: "COMPLETED", reviewedById: admin.id });
  });

  it("sends the work back with a note and no XP; handing it in again clears the note", async () => {
    const { admin, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await submitOrgTask(task.id);

    signInAs(admin);
    expect((await rejectOrgTask(task.id, "  Falta el enlace al diseño  ")).ok).toBe(true);
    expect(await taskRow(task.id)).toMatchObject({
      status: "PENDING",
      assigneeId: member.id,
      reviewNote: "Falta el enlace al diseño",
      submittedAt: null,
      awardedXp: 0,
    });
    expect((await userXp(member.id)).xp).toBe(0);
    expect((await rejectOrgTask(task.id)).ok).toBe(false);

    signInAs(member);
    await submitOrgTask(task.id);
    expect(await taskRow(task.id)).toMatchObject({ status: "IN_REVIEW", reviewNote: null });
  });

  it("stores no note when the reviewer leaves it blank, and refuses one that's too long", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await submitOrgTask(task.id);

    signInAs(owner);
    expect((await rejectOrgTask(task.id, "x".repeat(301))).ok).toBe(false);
    expect((await taskRow(task.id)).status).toBe("IN_REVIEW");
    expect((await rejectOrgTask(task.id, "   ")).ok).toBe(true);
    expect((await taskRow(task.id)).reviewNote).toBeNull();
  });

  it("doesn't let members review", async () => {
    const { member, other, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    signInAs(member);
    await submitOrgTask(task.id);

    for (const user of [member, other]) {
      signInAs(user);
      expect(await approveOrgTask(task.id)).toMatchObject({ ok: false });
      expect(await rejectOrgTask(task.id, "No")).toMatchObject({ ok: false });
    }
    expect((await taskRow(task.id)).status).toBe("IN_REVIEW");
  });

  it("can't approve a task that isn't in review", async () => {
    const { member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    expect((await approveOrgTask(task.id)).ok).toBe(false);
    expect((await userXp(member.id)).xp).toBe(0);
  });

  it("freezes a task in review: no release, no edit", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id);
    signInAs(member);
    await claimOrgTask(task.id);
    await submitOrgTask(task.id);

    expect((await releaseOrgTask(task.id)).ok).toBe(false);
    signInAs(owner);
    expect(await updateOrgTask(task.id, { title: "Otra", difficulty: "EASY" })).toMatchObject({ ok: false });
    expect(await taskRow(task.id)).toMatchObject({ status: "IN_REVIEW", assigneeId: member.id, title: "Revisar portada" });
  });
});

describe("manager actions", () => {
  it("reopens a completed task and takes the XP back", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    await completeAs(member, task.id, owner);

    signInAs(member);
    expect((await reopenOrgTask(task.id)).ok).toBe(false);

    signInAs(owner);
    expect((await reopenOrgTask(task.id)).ok).toBe(true);

    expect(await userXp(member.id)).toEqual({ xp: 0, level: 1 });
    expect(await taskRow(task.id)).toMatchObject({
      status: "PENDING",
      assigneeId: member.id,
      completedById: null,
      reviewedById: null,
      submittedAt: null,
      awardedXp: 0,
    });
    expect((await reopenOrgTask(task.id)).ok).toBe(false);
  });

  it("edits pending tasks, including the assignee, but not completed ones", async () => {
    const { member, other, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });

    const result = await updateOrgTask(task.id, { title: "Nuevo", difficulty: "EPIC", assigneeId: other.id });
    expect(result.ok).toBe(true);
    expect(await taskRow(task.id)).toMatchObject({ title: "Nuevo", xpReward: 100, assigneeId: other.id });

    expect((await updateOrgTask(task.id, { title: "Libre", difficulty: "EPIC", assigneeId: "" })).ok).toBe(true);
    expect((await taskRow(task.id)).assigneeId).toBeNull();

    signInAs(member);
    expect((await updateOrgTask(task.id, { title: "Hack", difficulty: "EASY" })).ok).toBe(false);
  });

  it("refuses to edit a completed task", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    await completeAs(member, task.id, owner);

    expect(await updateOrgTask(task.id, { title: "X", difficulty: "EPIC" })).toMatchObject({ ok: false });
  });

  it("deleting a completed task keeps the XP", async () => {
    const { owner, member, organization } = await setup();
    const task = await newTask(organization.id, { assigneeId: member.id });
    await completeAs(member, task.id, owner);

    signInAs(member);
    expect((await deleteOrgTask(task.id)).ok).toBe(false);

    signInAs(owner);
    expect((await deleteOrgTask(task.id)).ok).toBe(true);
    expect(await prisma.orgTask.count()).toBe(0);
    expect((await userXp(member.id)).xp).toBe(50);
  });
});

describe("membership changes", () => {
  it("frees the pending and in-review tasks of someone who is removed or leaves", async () => {
    const { owner, member, other, organization } = await setup();
    const removedTask = await newTask(organization.id, { assigneeId: member.id });
    const leftTask = await newTask(organization.id, { assigneeId: other.id });
    signInAs(other);
    await submitOrgTask(leftTask.id);

    signInAs(owner);
    expect((await removeMember(organization.id, member.id)).ok).toBe(true);
    signInAs(other);
    expect((await leaveOrganization(organization.id)).ok).toBe(true);

    const tasks = await prisma.orgTask.findMany({ where: { id: { in: [removedTask.id, leftTask.id] } } });
    expect(tasks.every((t) => t.assigneeId === null && t.status === "PENDING" && t.submittedAt === null)).toBe(true);

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
    const waiting = await newTask(organization.id, { assigneeId: other.id, difficulty: "EPIC" });
    await completeAs(member, a.id, owner);
    await completeAs(other, b.id, owner);
    await completeAs(other, c.id, owner);
    // Work still in review doesn't count yet.
    signInAs(other);
    await submitOrgTask(waiting.id);

    const detail = await getOrganizationForMember(organization.slug, owner.id);
    const { ranking, tasks } = await getOrgBoard(organization.id, detail!.members);
    expect(ranking.slice(0, 2).map((r) => [r.userId, r.xp, r.completed])).toEqual([
      [member.id, 100, 1],
      [other.id, 20, 2],
    ]);
    expect(ranking).toHaveLength(4);
    expect(tasks.map((t) => t.status)).toEqual(["IN_REVIEW", "COMPLETED", "COMPLETED", "COMPLETED"]);
  });
});
