import type { Prisma } from "@/generated/prisma/client";
import type { Difficulty, OrgTaskStatus } from "@/generated/prisma/enums";
import { addDays, gridRange, type YearMonth } from "@/lib/calendar";
import type { TaskDTO } from "@/lib/data/dashboard";
import { dueDateFromInput, dueDateToInput } from "@/lib/dates";
import { TASK_MANAGER_ROLES } from "@/lib/organizations/permissions";
import { prisma } from "@/lib/prisma";

export interface CalendarPerson {
  userId: string;
  firstName: string;
  lastName: string;
}

/**
 * A team task as the calendar shows it (managed from the board): mine, or any task of an
 * organization where I'm an owner or admin.
 */
export interface CalendarOrgTask {
  id: string;
  title: string;
  difficulty: Difficulty;
  xpReward: number;
  status: OrgTaskStatus;
  dueDate: string;
  organization: { name: string; slug: string };
  /** null = open: nobody has taken it yet. */
  assignee: CalendarPerson | null;
  /** Who finished it (COMPLETED only); can differ from the assignee if it was reassigned later. */
  completedBy: CalendarPerson | null;
}

export interface CalendarMonth {
  /** Personal tasks due on a day of the visible grid. */
  tasks: (TaskDTO & { dueDate: string })[];
  /** `canReschedule`: I manage its organization and it is still pending, so I can drag it. */
  orgTasks: (CalendarOrgTask & { canReschedule: boolean })[];
  /** Pending personal tasks without a due date (they can't be placed on the calendar). */
  undatedPending: number;
}

const personSelect = { id: true, firstName: true, lastName: true } as const;

function toPerson({ id, firstName, lastName }: { id: string; firstName: string; lastName: string }): CalendarPerson {
  return { userId: id, firstName, lastName };
}

/** Team tasks I follow: mine, or any of an organization where I'm an owner or admin. */
function visibleOrgTasks(userId: string): Prisma.OrgTaskWhereInput {
  return {
    OR: [
      // Mine, only while I still belong to the organization (leaving releases them, but be explicit).
      { assigneeId: userId, organization: { members: { some: { userId } } } },
      // Managers follow the whole team's deadlines.
      { organization: { members: { some: { userId, role: { in: [...TASK_MANAGER_ROLES] } } } } },
    ],
  };
}

const orgTaskSelect = {
  id: true,
  organizationId: true,
  title: true,
  difficulty: true,
  xpReward: true,
  status: true,
  dueDate: true,
  organization: { select: { name: true, slug: true } },
  assignee: { select: personSelect },
  completedBy: { select: personSelect },
} as const satisfies Prisma.OrgTaskSelect;

function toCalendarOrgTask(task: Prisma.OrgTaskGetPayload<{ select: typeof orgTaskSelect }>): CalendarOrgTask {
  return {
    id: task.id,
    title: task.title,
    difficulty: task.difficulty,
    xpReward: task.xpReward,
    status: task.status,
    organization: task.organization,
    dueDate: dueDateToInput(task.dueDate!),
    assignee: task.assignee && toPerson(task.assignee),
    completedBy: task.completedBy && toPerson(task.completedBy),
  };
}

export async function getCalendarMonth(userId: string, ym: YearMonth): Promise<CalendarMonth> {
  const { from, to } = gridRange(ym);
  const dueDate = { gte: dueDateFromInput(from), lte: dueDateFromInput(to) };

  const [tasks, orgTasks, undatedPending, managed] = await Promise.all([
    prisma.task.findMany({
      where: { userId, dueDate },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        xpReward: true,
        status: true,
        dueDate: true,
        completedAt: true,
      },
    }),
    prisma.orgTask.findMany({
      where: { dueDate, ...visibleOrgTasks(userId) },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: orgTaskSelect,
    }),
    prisma.task.count({ where: { userId, status: "PENDING", dueDate: null } }),
    prisma.membership.findMany({
      where: { userId, role: { in: [...TASK_MANAGER_ROLES] } },
      select: { organizationId: true },
    }),
  ]);
  const managedOrgs = new Set(managed.map((m) => m.organizationId));

  return {
    tasks: tasks.map((task) => ({
      ...task,
      dueDate: dueDateToInput(task.dueDate!),
      completedAt: task.completedAt?.toISOString() ?? null,
    })),
    orgTasks: orgTasks.map((task) => ({
      ...toCalendarOrgTask(task),
      canReschedule: task.status === "PENDING" && managedOrgs.has(task.organizationId),
    })),
    undatedPending,
  };
}

/** A deadline still waiting on someone, as the dashboard lists it. */
export type UpcomingEntry =
  | { kind: "personal"; id: string; title: string; difficulty: Difficulty; xpReward: number; dueDate: string }
  | ({ kind: "org" } & CalendarOrgTask);

export interface UpcomingDeadlines {
  /** Today and the following days, each with its entries (possibly none). */
  days: { key: string; entries: UpcomingEntry[] }[];
  /** Pending with a past due date, oldest first. Tasks in review are out of the assignee's hands. */
  overdue: UpcomingEntry[];
}

/** Open deadlines from `today` to `today + days - 1`, plus the overdue ones. */
export async function getUpcomingDeadlines(userId: string, today: string, days = 7): Promise<UpcomingDeadlines> {
  const until = dueDateFromInput(addDays(today, days - 1));
  const start = dueDateFromInput(today);

  const [tasks, orgTasks] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: "PENDING", dueDate: { lte: until } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, difficulty: true, xpReward: true, dueDate: true },
    }),
    prisma.orgTask.findMany({
      where: {
        AND: [
          visibleOrgTasks(userId),
          {
            OR: [
              { status: "PENDING", dueDate: { lte: until } },
              { status: "IN_REVIEW", dueDate: { gte: start, lte: until } },
            ],
          },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: orgTaskSelect,
    }),
  ]);

  const entries: UpcomingEntry[] = [
    ...tasks.map((task) => ({ kind: "personal" as const, ...task, dueDate: dueDateToInput(task.dueDate!) })),
    ...orgTasks.map((task) => ({ kind: "org" as const, ...toCalendarOrgTask(task) })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    overdue: entries.filter((e) => e.dueDate < today),
    days: Array.from({ length: days }, (_, i) => {
      const key = addDays(today, i);
      return { key, entries: entries.filter((e) => e.dueDate === key) };
    }),
  };
}
