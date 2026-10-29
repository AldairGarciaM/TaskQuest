import ProgressHero from "@/components/dashboard/ProgressHero";
import UpcomingDeadlines from "@/components/dashboard/UpcomingDeadlines";
import DailyMissionsCard from "@/components/gamification/DailyMissionsCard";
import TaskList from "@/components/task/TaskList";
import { getUpcomingDeadlines } from "@/lib/data/calendar";
import { getDashboardData } from "@/lib/data/dashboard";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/lib/session";

const DASHBOARD_PREVIEW = 5;

export default async function HomePage() {
  const user = await requireUser();
  const today = dayKey(new Date());
  const [data, upcoming] = await Promise.all([getDashboardData(user.id), getUpcomingDeadlines(user.id, today)]);

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

      {/* A short preview; the full list with search and team tasks lives in /misiones. */}
      <TaskList tasks={data.tasks} preview={DASHBOARD_PREVIEW} />
    </div>
  );
}
