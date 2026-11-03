import { describe, expect, it } from "vitest";

import { acceptMyInvitation, declineMyInvitation } from "@/app/actions/invitations";
import { fetchNotifications, markNotificationsRead } from "@/app/actions/notifications";
import { approveOrgTask, createOrgTask, rejectOrgTask, submitOrgTask, updateOrgTask } from "@/app/actions/org-tasks";
import { inviteMember } from "@/app/actions/organizations";
import { getMyPendingInvitations } from "@/lib/data/organizations";
import { getNotificationSignature, NOTIFICATIONS_KEPT } from "@/lib/notifications/server";
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
  // These tests look at review notices; the assignment notice is covered below.
  await prisma.notification.deleteMany({ where: { type: "ORG_TASK_ASSIGNED" } });
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

    // The owner only got the request to review it, not the approval.
    signInAs(owner);
    expect((await fetchNotifications()).items.map((n) => n.type)).toEqual(["ORG_TASK_SUBMITTED"]);
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

describe("assignment notifications", () => {
  const assigned = (userId: string) => prisma.notification.findMany({ where: { userId, type: "ORG_TASK_ASSIGNED" } });

  it("tells the member a manager gave them a task, on creation and on reassignment", async () => {
    const { owner, member, organization } = await setup();
    const other = await createUser();
    await prisma.membership.create({ data: { organizationId: organization.id, userId: other.id, role: "MEMBER" } });

    signInAs(owner);
    await createOrgTask(organization.id, { title: "Portada", difficulty: "EASY", assigneeId: member.id });
    expect(await assigned(member.id)).toMatchObject([{ taskTitle: "Portada", actorName: "Lucía" }]);

    const task = await prisma.orgTask.findFirstOrThrow({ where: { organizationId: organization.id } });
    // Editing without changing who has it doesn't notify again.
    await updateOrgTask(task.id, { title: "Portada v2", difficulty: "EASY", assigneeId: member.id });
    expect(await assigned(member.id)).toHaveLength(1);

    await updateOrgTask(task.id, { title: "Portada v2", difficulty: "EASY", assigneeId: other.id });
    expect(await assigned(other.id)).toMatchObject([{ taskTitle: "Portada v2" }]);
  });

  it("stays quiet for open tasks and for managers assigning themselves", async () => {
    const { owner, organization } = await setup();
    signInAs(owner);
    await createOrgTask(organization.id, { title: "Libre", difficulty: "EASY" });
    await createOrgTask(organization.id, { title: "Mía", difficulty: "EASY", assigneeId: owner.id });
    expect(await prisma.notification.count({ where: { type: "ORG_TASK_ASSIGNED" } })).toBe(0);
  });
});

describe("invitation notifications", () => {
  it("tells an existing account it was invited, and lets it accept from the app", async () => {
    const { owner, organization } = await setup();
    const invitee = await createUser({ email: "ana@correo.com" });

    signInAs(owner);
    expect((await inviteMember(organization.id, { email: "ana@correo.com", role: "ADMIN" })).ok).toBe(true);
    expect(await prisma.notification.findMany({ where: { userId: invitee.id } })).toMatchObject([
      { type: "ORG_INVITATION_RECEIVED", taskTitle: "Equipo", actorName: "Lucía" },
    ]);

    const [invitation] = await getMyPendingInvitations(invitee.id);
    expect(invitation).toMatchObject({ role: "ADMIN", organizationName: "Equipo" });

    // Another account can't use it.
    signInAs(owner);
    expect((await acceptMyInvitation(invitation.id)).ok).toBe(false);

    signInAs(invitee);
    expect(await acceptMyInvitation(invitation.id)).toEqual({ ok: true, slug: organization.slug });
    expect(
      await prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId: organization.id, userId: invitee.id } },
        select: { role: true },
      }),
    ).toEqual({ role: "ADMIN" });
    expect(await getMyPendingInvitations(invitee.id)).toEqual([]);
    expect((await acceptMyInvitation(invitation.id)).ok).toBe(false);
  });

  it("lets the invitee turn it down, which also kills the email link", async () => {
    const { owner, organization } = await setup();
    const invitee = await createUser({ email: "beto@correo.com" });
    signInAs(owner);
    await inviteMember(organization.id, { email: "beto@correo.com", role: "MEMBER" });
    const [invitation] = await getMyPendingInvitations(invitee.id);

    signInAs(invitee);
    expect(await declineMyInvitation(invitation.id)).toEqual({ ok: true });
    expect(await prisma.invitation.count({ where: { organizationId: organization.id } })).toBe(0);
  });

  it("doesn't notify anyone when the email has no account yet", async () => {
    const { owner, organization } = await setup();
    signInAs(owner);
    await inviteMember(organization.id, { email: "nuevo@correo.com", role: "MEMBER" });
    expect(await prisma.notification.count({ where: { type: "ORG_INVITATION_RECEIVED" } })).toBe(0);
  });
});

describe("getNotificationSignature", () => {
  it("changes when a notification arrives, is read or is dropped", async () => {
    const { owner, member, organization } = await setup();
    const empty = await getNotificationSignature(member.id);

    signInAs(owner);
    await createOrgTask(organization.id, { title: "Portada", difficulty: "EASY", assigneeId: member.id });
    const arrived = await getNotificationSignature(member.id);
    expect(arrived).not.toBe(empty);

    signInAs(member);
    await markNotificationsRead();
    const read = await getNotificationSignature(member.id);
    expect(read).not.toBe(arrived);
    expect(await getNotificationSignature(member.id)).toBe(read);
  });
});
