import type { Prisma } from "@/generated/prisma/client";
import type { Difficulty, TaskStatus } from "@/generated/prisma/enums";
import { dueDateToInput } from "@/lib/dates";
import type { MemberDTO } from "@/lib/data/organizations";
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
  status: TaskStatus;
  /** "YYYY-MM-DD" for <input type="date">. */
  dueDate: string | null;
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
      // Pending first (enum order), then by due date (no date last), newest first.
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
  tasks: OrgTaskDTO[];
}

/** Most pending tasks the dashboard lists across all of a user's organizations. */
export const MY_ORG_TASKS_LIMIT = 100;

/**
 * Pending tasks of every organization the user belongs to that are theirs or open to take,
 * grouped by organization (in the order they joined). Organizations without such tasks are kept,
 * with an empty list, so the dashboard can still link to their boards.
 */
export async function getMyOrgTasks(userId: string): Promise<MyOrgTasksGroup[]> {
  const [memberships, tasks] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { organization: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.orgTask.findMany({
      where: {
        status: "PENDING",
        organization: { members: { some: { userId } } },
        OR: [{ assigneeId: userId }, { assigneeId: null }],
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

  return memberships.map(({ organization }) => ({
    organization,
    tasks: byOrganization.get(organization.id) ?? [],
  }));
}
