import OrgTasksSection from "@/components/dashboard/OrgTasksSection";
import ProgressHero from "@/components/dashboard/ProgressHero";
import DailyMissionsCard from "@/components/gamification/DailyMissionsCard";
import TaskList from "@/components/task/TaskList";
import { getDashboardData } from "@/lib/data/dashboard";
import { getMyOrgTasks } from "@/lib/data/org-board";
import { requireUser } from "@/lib/session";

export default async function HomePage() {
  const user = await requireUser();
  const [data, orgTaskGroups] = await Promise.all([getDashboardData(user.id), getMyOrgTasks(user.id)]);

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

      <TaskList tasks={data.tasks} />

      <OrgTasksSection groups={orgTaskGroups} myUserId={user.id} />
    </div>
  );
}
