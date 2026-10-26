import DashboardLayout from "../components/layout/DashboardLayout";
import XpHeroCard from "@/components/dashboard/xpHeroCard";

import {
  Trophy,
  Flame, 
  Target,
  Star
} from "lucide-react";

import StatsCard from "@/components/dashboard/StatsCard";
import TaskList from "@/components/task/TaskList";
import { requireUser } from "@/lib/session";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <DashboardLayout userName={user.name ?? "aventurero"}>

      <div className = "mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <StatsCard 
            title = "XP Total"
            value = "2,580"
            description = "Puntos de experiencia acumulados"
            icon = {Star}
          />
        </div>

        <div >
          <StatsCard 
            title = "Misiones"
            value = "7"
            description = "Misiones completadas"
            icon = {Target}
          />
        </div>

        <div>
          <StatsCard 
            title = "Logros"
            value = "3"
            description = "Logros desbloqueados"
            icon = {Trophy}
          />
        </div>

        <div>
          <StatsCard 
            title = "Racha de días"
            value = "5"
            description = "Días consecutivos completando misiones"
            icon = {Flame}
          />

        </div>

      </div>
      
      <div className="space-y-6">

        <XpHeroCard />
        
        <TaskList />

      </div>
      
    </DashboardLayout>
  );
}