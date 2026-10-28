import type { Difficulty, OrgTaskStatus } from "@/generated/prisma/enums";
import { gridRange, type YearMonth } from "@/lib/calendar";
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
  orgTasks: CalendarOrgTask[];
  /** Pending personal tasks without a due date (they can't be placed on the calendar). */
  undatedPending: number;
}

const personSelect = { id: true, firstName: true, lastName: true } as const;

function toPerson({ id, firstName, lastName }: { id: string; firstName: string; lastName: string }): CalendarPerson {
  return { userId: id, firstName, lastName };
}

export async function getCalendarMonth(userId: string, ym: YearMonth): Promise<CalendarMonth> {
  const { from, to } = gridRange(ym);
  const dueDate = { gte: dueDateFromInput(from), lte: dueDateFromInput(to) };

  const [tasks, orgTasks, undatedPending] = await Promise.all([
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
      where: {
        dueDate,
        OR: [
          // Mine, only while I still belong to the organization (leaving releases them, but be explicit).
          { assigneeId: userId, organization: { members: { some: { userId } } } },
          // Managers follow the whole team's deadlines.
          { organization: { members: { some: { userId, role: { in: [...TASK_MANAGER_ROLES] } } } } },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        difficulty: true,
        xpReward: true,
        status: true,
        dueDate: true,
        organization: { select: { name: true, slug: true } },
        assignee: { select: personSelect },
        completedBy: { select: personSelect },
      },
    }),
    prisma.task.count({ where: { userId, status: "PENDING", dueDate: null } }),
  ]);

  return {
    tasks: tasks.map((task) => ({
      ...task,
      dueDate: dueDateToInput(task.dueDate!),
      completedAt: task.completedAt?.toISOString() ?? null,
    })),
    orgTasks: orgTasks.map((task) => ({
      ...task,
      dueDate: dueDateToInput(task.dueDate!),
      assignee: task.assignee && toPerson(task.assignee),
      completedBy: task.completedBy && toPerson(task.completedBy),
    })),
    undatedPending,
  };
}
