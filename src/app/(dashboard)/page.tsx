import ProgressHero from "@/components/dashboard/ProgressHero";
import { SUMMARY_PER_COLUMN } from "@/components/dashboard/summary";
import TaskSummary from "@/components/dashboard/TaskSummary";
import UpcomingDeadlines from "@/components/dashboard/UpcomingDeadlines";
import DailyMissionsCard from "@/components/gamification/DailyMissionsCard";
import { getUpcomingDeadlines } from "@/lib/data/calendar";
import { getDashboardData } from "@/lib/data/dashboard";
import { getDashboardOrgTasks } from "@/lib/data/org-board";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export default async function HomePage() {
  const user = await requireUser();
  const today = dayKey(new Date());
  const [data, upcoming, orgTasks] = await Promise.all([
    getDashboardData(user.id),
    getUpcomingDeadlines(user.id, today),
    getDashboardOrgTasks(user.id, SUMMARY_PER_COLUMN),
  ]);

  return (
    <div className="space-y-8">
      <ProgressHero
        userId={user.id}
        firstName={user.firstName || "aventurero"}
        fullName={user.name || user.username}
        xp={data.xp}
        streak={data.streak}
        completedCount={data.completedCount}
        pendingCount={data.pendingCount}
        achievements={data.achievements}
      />

      <DailyMissionsCard missions={data.dailyMissions} />

      <UpcomingDeadlines upcoming={upcoming} today={today} userId={user.id} />

      {/* A short summary; the full lists with search and open team tasks live in /misiones. */}
      <TaskSummary personal={data.tasks} org={orgTasks} myUserId={user.id} />
    </div>
  );
}
