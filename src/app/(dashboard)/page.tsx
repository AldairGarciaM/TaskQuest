import XpHeroCard from "@/components/dashboard/xpHeroCard";

import {
  ClipboardList,
  Flame,
  Target,
  Star
} from "lucide-react";

import StatsCard from "@/components/dashboard/StatsCard";
import TaskList from "@/components/task/TaskList";
import { getDashboardData } from "@/lib/data/dashboard";
import { requireUser } from "@/lib/session";

export default async function HomePage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);
  const userName = user.name ?? "aventurero";

  return (
    <>

      <div className = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <StatsCard 
            title = "XP Total"
            value = {data.xp.toLocaleString("es-MX")}
            description = "Puntos de experiencia acumulados"
            icon = {Star}
          />
        </div>

        <div >
          <StatsCard 
            title = "Completadas"
            value = {data.completedCount}
            description = "Misiones completadas"
            icon = {Target}
          />
        </div>

        <div>
          <StatsCard 
            title = "Pendientes"
            value = {data.pendingCount}
            description = "Misiones por completar"
            icon = {ClipboardList}
          />
        </div>

        <div>
          <StatsCard 
            title = "Racha de días"
            value = {data.streak}
            description = "Días consecutivos completando misiones"
            icon = {Flame}
          />

        </div>

      </div>
      
      <div className="mt-8 space-y-8">

        <XpHeroCard xp={data.xp} userId={user.id} userName={userName} />
        
        <TaskList tasks={data.tasks} />

      </div>
      
    </>
  );
}
