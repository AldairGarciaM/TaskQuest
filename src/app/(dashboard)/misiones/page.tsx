import type { Metadata } from "next";

import OrgTasksSection from "@/components/dashboard/OrgTasksSection";
import TaskList from "@/components/task/TaskList";
import { getPersonalTasks } from "@/lib/data/dashboard";
import { getMyOrgTasks } from "@/lib/data/org-board";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Misiones · TaskQuest",
};

export default async function MissionsPage() {
  const user = await requireUser();
  const [tasks, orgTaskGroups] = await Promise.all([getPersonalTasks(user.id), getMyOrgTasks(user.id)]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Misiones</h1>
        <p className="text-slate-400">Todas tus misiones personales y las tareas de tus equipos, en un solo lugar.</p>
      </header>

      <TaskList tasks={tasks} />

      <OrgTasksSection groups={orgTaskGroups} myUserId={user.id} />
    </div>
  );
}
