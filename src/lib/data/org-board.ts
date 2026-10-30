import type { Prisma } from "@/generated/prisma/client";
import type { Difficulty, OrgRole, OrgTaskStatus } from "@/generated/prisma/enums";
import { dueDateToInput } from "@/lib/dates";
import type { MemberDTO } from "@/lib/data/organizations";
import { canManageTasks } from "@/lib/organizations/permissions";
import { prisma } from "@/lib/prisma";

export interface BoardPerson {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface OrgTaskDTO {
  id: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  xpReward: number;
  status: OrgTaskStatus;
  /** "YYYY-MM-DD" for <input type="date">. */
  dueDate: string | null;
  /** When the assignee sent it for review (IN_REVIEW only). */
  submittedAt: string | null;
  /** What a manager asked to change when sending it back (PENDING only). */
  reviewNote: string | null;
  completedAt: string | null;
  selfAssigned: boolean;
  /** null = open: any member can take it. */
  assignee: BoardPerson | null;
}

export interface RankingEntry extends BoardPerson {
  level: number;
  xp: number;
  completed: number;
}

const personSelect = { id: true, firstName: true, lastName: true, username: true } as const;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  difficulty: true,
  xpReward: true,
  status: true,
  dueDate: true,
  submittedAt: true,
  reviewNote: true,
  completedAt: true,
  selfAssigned: true,
  assignee: { select: personSelect },
} as const;

function toPerson(user: { id: string; firstName: string; lastName: string; username: string }): BoardPerson {
  return { userId: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username };
}

type TaskRow = Prisma.OrgTaskGetPayload<{ select: typeof taskSelect }>;

function toTaskDTO(t: TaskRow): OrgTaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    difficulty: t.difficulty,
    xpReward: t.xpReward,
    status: t.status,
    dueDate: t.dueDate ? dueDateToInput(t.dueDate) : null,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    reviewNote: t.reviewNote,
    completedAt: t.completedAt?.toISOString() ?? null,
    selfAssigned: t.selfAssigned,
    assignee: t.assignee ? toPerson(t.assignee) : null,
  };
}

/** Tasks of the board plus each current member's XP earned in this organization. */
export async function getOrgBoard(organizationId: string, members: MemberDTO[]) {
  const [tasks, totals] = await Promise.all([
    prisma.orgTask.findMany({
      where: { organizationId },
      // Pending, then in review, then completed (enum order), then by due date (no date last), newest first.
      orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      select: taskSelect,
    }),
    prisma.orgTask.groupBy({
      by: ["completedById"],
      where: { organizationId, status: "COMPLETED", completedById: { not: null } },
      _sum: { awardedXp: true },
      _count: { _all: true },
    }),
  ]);

  const byUser = new Map(totals.map((t) => [t.completedById, t]));
  const ranking: RankingEntry[] = members
    .map((m) => {
      const total = byUser.get(m.userId);
      return {
        userId: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        username: m.username,
        level: m.level,
        xp: total?._sum.awardedXp ?? 0,
        completed: total?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.completed - a.completed || a.firstName.localeCompare(b.firstName, "es"));

  return {
    tasks: tasks.map(toTaskDTO),
    ranking,
  };
}

export interface MyOrgTasksGroup {
  organization: { id: string; name: string; slug: string };
  /** Owners and admins approve or send back the tasks in review. */
  canReview: boolean;
  tasks: OrgTaskDTO[];
}

const MANAGER_ROLES: OrgRole[] = (["OWNER", "ADMIN", "MEMBER"] as const).filter(canManageTasks);

/** Most tasks the dashboard lists across all of a user's organizations. */
export const MY_ORG_TASKS_LIMIT = 100;

/**
 * For every organization the user belongs to: their tasks (pending or waiting for review), the open
 * ones they can take and, where they're a manager, everyone's tasks waiting for review. Grouped by organization (in the order they joined). Organizations without such tasks are kept,
 * with an empty list, so the dashboard can still link to their boards.
 */
export async function getMyOrgTasks(userId: string): Promise<MyOrgTasksGroup[]> {
  const [memberships, tasks] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { role: true, organization: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.orgTask.findMany({
      where: {
        organization: { members: { some: { userId } } },
        OR: [
          { assigneeId: userId, status: { in: ["PENDING", "IN_REVIEW"] } },
          { assigneeId: null, status: "PENDING" },
          {
            status: "IN_REVIEW",
            organization: { members: { some: { userId, role: { in: MANAGER_ROLES } } } },
          },
        ],
      },
      // Due soonest first (no date last), then newest.
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: MY_ORG_TASKS_LIMIT,
      select: { ...taskSelect, organizationId: true },
    }),
  ]);

  const byOrganization = new Map<string, OrgTaskDTO[]>();
  for (const task of tasks) {
    const list = byOrganization.get(task.organizationId) ?? [];
    list.push(toTaskDTO(task));
    byOrganization.set(task.organizationId, list);
  }

  return memberships.map(({ role, organization }) => ({
    organization,
    canReview: canManageTasks(role),
    tasks: byOrganization.get(organization.id) ?? [],
  }));
}

/** A team task on the dashboard summary, with where it comes from. */
export interface DashboardOrgTask extends OrgTaskDTO {
  organization: { name: string; slug: string };
  /** Owner or admin there: their own tasks skip review. */
  canReview: boolean;
}

/**
 * Team tasks for the dashboard summary: the ones assigned to me that are still open (pending or in
 * review), due soonest first, and the latest ones I completed. Only organizations I still belong to.
 */
export async function getDashboardOrgTasks(
  userId: string,
  completedLimit: number,
): Promise<{ active: DashboardOrgTask[]; completed: DashboardOrgTask[]; completedTotal: number }> {
  const mine = { organization: { members: { some: { userId } } } } as const;
  const select = { ...taskSelect, organizationId: true, organization: { select: { name: true, slug: true } } } as const;

  const completedWhere = { ...mine, completedById: userId, status: "COMPLETED" } as const;
  const [memberships, active, completed, completedTotal] = await Promise.all([
    prisma.membership.findMany({ where: { userId }, select: { organizationId: true, role: true } }),
    prisma.orgTask.findMany({
      where: { ...mine, assigneeId: userId, status: { in: ["PENDING", "IN_REVIEW"] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: MY_ORG_TASKS_LIMIT,
      select,
    }),
    prisma.orgTask.findMany({
      where: completedWhere,
      orderBy: { completedAt: "desc" },
      take: completedLimit,
      select,
    }),
    prisma.orgTask.count({ where: completedWhere }),
  ]);

  const managed = new Set(memberships.filter((m) => canManageTasks(m.role)).map((m) => m.organizationId));
  const toDashboardTask = ({ organizationId, organization, ...task }: (typeof active)[number]): DashboardOrgTask => ({
    ...toTaskDTO(task),
    organization,
    canReview: managed.has(organizationId),
  });
  return { active: active.map(toDashboardTask), completed: completed.map(toDashboardTask), completedTotal };
}
