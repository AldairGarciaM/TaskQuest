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

function toPerson(user: { id: string; firstName: string; lastName: string; username: string }): BoardPerson {
  return { userId: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username };
}

/** Tasks of the board plus each current member's XP earned in this organization. */
export async function getOrgBoard(organizationId: string, members: MemberDTO[]) {
  const [tasks, totals] = await Promise.all([
    prisma.orgTask.findMany({
      where: { organizationId },
      // Pending first (enum order), then by due date (no date last), newest first.
      orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
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
      },
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
    tasks: tasks.map(
      (t): OrgTaskDTO => ({
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
      }),
    ),
    ranking,
  };
}
