import { DifficultyStyles, type Difficulty } from "@/app/constants/taskDifficulty";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  title: string;
  description: string;
  xp: number;
  difficulty: Difficulty;
  dueDate: string;
}

export default function TaskCard({
  title,
  description,
  xp,
  difficulty,
  dueDate,
}: TaskCardProps) {
  const style = DifficultyStyles[difficulty];
  const DifficultyIcon = style.icon;

  return (
    <Card className="relative overflow-hidden border-slate-800 bg-slate-900 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1 duration-300">
      <div
        className={cn("absolute left-0 top-0 h-full w-1", style.color)}
      />

      <CardContent className="p-6 pl-8">
        <div className="flex items-start justify-between">

          <div className="space-y-5">

            <div className="flex items-center gap-2">
               <Checkbox className="ml-2" />
               <h3 className="text-lg font-semibold text-amber-100">
                {title}
              </h3>
            </div>

            <p className="text-sm text-slate-400">
              {description}
            </p>

          </div>

          <span className="text-xl font-bold text-green-400">
            +{xp} XP
          </span>

        </div>

        <div className="mt-4 flex items-center justify-between">

          <Badge className={style.badge}>
            <DifficultyIcon aria-hidden="true" />
            {difficulty}
          </Badge>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CalendarDays size={16} />
            {dueDate}
          </div>

        </div>

      </CardContent>
    </Card>
  );
}