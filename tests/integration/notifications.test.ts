import { describe, expect, it } from "vitest";

import { fetchNotifications, markNotificationsRead } from "@/app/actions/notifications";
import { approveOrgTask, createOrgTask, rejectOrgTask, submitOrgTask } from "@/app/actions/org-tasks";
import { NOTIFICATIONS_KEPT } from "@/lib/notifications/server";
import { prisma } from "@/lib/prisma";

import { createUser, signInAs } from "./helpers";

type TestUser = Awaited<ReturnType<typeof createUser>>;

async function setup() {
  const owner = await createUser({ firstName: "Lucía" });
  const member = await createUser();
  const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });
  await prisma.membership.createMany({
    data: [
      { organizationId: organization.id, userId: owner.id, role: "OWNER" },
      { organizationId: organization.id, userId: member.id, role: "MEMBER" },
    ],
  });
  return { owner, member, organization };
}

/** The owner creates a task for the member and the member hands it in. */
async function taskInReview(organizationId: string, owner: TestUser, member: TestUser) {
  signInAs(owner);
  expect(await createOrgTask(organizationId, { title: "Revisar portada", difficulty: "HARD", assigneeId: member.id })).toEqual({
    ok: true,
  });
  const task = await prisma.orgTask.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  signInAs(member);
  await submitOrgTask(task.id);
  return task;
}

describe("review notifications", () => {
  it("tells the member their task was approved and how much XP they got", async () => {
    const { owner, member, organization } = await setup();
    await prisma.user.update({ where: { id: member.id }, data: { xp: 80 } });
    const task = await taskInReview(organization.id, owner, member);

    signInAs(owner);
    expect((await approveOrgTask(task.id)).ok).toBe(true);
    expect((await approveOrgTask(task.id)).ok).toBe(false);

    signInAs(member);
    const feed = await fetchNotifications();
    expect(feed.unreadCount).toBe(1);
    expect(feed.items).toEqual([
      expect.objectContaining({
        type: "ORG_TASK_APPROVED",
        taskTitle: "Revisar portada",
        xp: 50,
        level: 2,
        actorName: "Lucía",
        read: false,
        organization: { name: "Equipo", slug: organization.slug },
      }),
    ]);

    signInAs(owner);
    expect((await fetchNotifications()).items).toHaveLength(0);
  });

  it("tells the member when changes were requested, with the note", async () => {
    const { owner, member, organization } = await setup();
    const task = await taskInReview(organization.id, owner, member);

    signInAs(owner);
    expect((await rejectOrgTask(task.id, "Falta el enlace")).ok).toBe(true);
    expect((await rejectOrgTask(task.id)).ok).toBe(false);

    signInAs(member);
    const { items } = await fetchNotifications();
    expect(items).toEqual([
      expect.objectContaining({ type: "ORG_TASK_CHANGES_REQUESTED", note: "Falta el enlace", xp: 0, level: null }),
    ]);
  });

  it("doesn't notify when an owner completes their own task", async () => {
    const { owner, organization } = await setup();
    signInAs(owner);
    await createOrgTask(organization.id, { title: "Mía", difficulty: "EASY", assigneeId: owner.id });
    const task = await prisma.orgTask.findFirstOrThrow();
    expect(await submitOrgTask(task.id)).toMatchObject({ ok: true, status: "COMPLETED" });
    expect(await prisma.notification.count()).toBe(0);
  });

  it("marks only my notifications as read", async () => {
    const { owner, member, organization } = await setup();
    const other = await createUser();
    const task = await taskInReview(organization.id, owner, member);
    signInAs(owner);
    await approveOrgTask(task.id);
    await prisma.notification.create({
      data: { type: "ORG_TASK_APPROVED", userId: other.id, organizationId: organization.id, taskTitle: "Otra" },
    });

    signInAs(member);
    await markNotificationsRead();
    const feed = await fetchNotifications();
    expect(feed.unreadCount).toBe(0);
    expect(feed.items[0].read).toBe(true);
    expect(await prisma.notification.count({ where: { userId: other.id, readAt: null } })).toBe(1);
  });

  it(`keeps only the newest ${NOTIFICATIONS_KEPT} per user`, async () => {
    const { owner, member, organization } = await setup();
    const old = Date.now() - 1_000_000;
    await prisma.notification.createMany({
      data: Array.from({ length: NOTIFICATIONS_KEPT }, (_, i) => ({
        type: "ORG_TASK_APPROVED" as const,
        userId: member.id,
        organizationId: organization.id,
        taskTitle: `Vieja ${i}`,
        createdAt: new Date(old + i * 1000),
      })),
    });
    const task = await taskInReview(organization.id, owner, member);
    signInAs(owner);
    await approveOrgTask(task.id);

    expect(await prisma.notification.count({ where: { userId: member.id } })).toBe(NOTIFICATIONS_KEPT);
    expect(await prisma.notification.findFirst({ where: { taskTitle: "Vieja 0" } })).toBeNull();
    expect(await prisma.notification.findFirst({ where: { taskTitle: "Revisar portada" } })).not.toBeNull();
  });

  it("requires a session", async () => {
    await expect(fetchNotifications()).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(markNotificationsRead()).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
