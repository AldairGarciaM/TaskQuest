import type { Difficulty, OrgTaskStatus } from "@/generated/prisma/enums";
import { gridRange, type YearMonth } from "@/lib/calendar";
import type { TaskDTO } from "@/lib/data/dashboard";
import { dueDateFromInput, dueDateToInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** A team task assigned to me, as the calendar shows it (managed from the board). */
export interface CalendarOrgTask {
  id: string;
  title: string;
  difficulty: Difficulty;
  xpReward: number;
  status: OrgTaskStatus;
  dueDate: string;
  organization: { name: string; slug: string };
}

export interface CalendarMonth {
  /** Personal tasks due on a day of the visible grid. */
  tasks: (TaskDTO & { dueDate: string })[];
  orgTasks: CalendarOrgTask[];
  /** Pending personal tasks without a due date (they can't be placed on the calendar). */
  undatedPending: number;
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
      // Only tasks of organizations I still belong to (leaving releases them, but be explicit).
      where: { assigneeId: userId, dueDate, organization: { members: { some: { userId } } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        difficulty: true,
        xpReward: true,
        status: true,
        dueDate: true,
        organization: { select: { name: true, slug: true } },
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
    orgTasks: orgTasks.map((task) => ({ ...task, dueDate: dueDateToInput(task.dueDate!) })),
    undatedPending,
  };
}
