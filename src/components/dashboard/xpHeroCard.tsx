import { Card, CardContent } from "@/components/ui/card";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { levelProgress } from "@/lib/xp";

import { Swords } from "lucide-react";

interface XpHeroCardProps {
  xp: number;
  userId: string;
  userName: string;
}

export default function XpHeroCard({ xp, userId, userName }: XpHeroCardProps) {
  const progress = levelProgress(xp);
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Card className="border-slate-800 bg-slate-900/80">
      <CardContent className="p-8">

        <div className="grid gap-8 md:grid-cols-3 items-center">

          {/* XP */}

          <div className="md:col-span-2 space-y-6">
            <Swords className="h-12 w-12 text-violet-500"></Swords>

            <div>
              <h2 className="text-4xl font-bold text-yellow-300">
                Nivel {progress.level}
              </h2>

              <p className="text-slate-400">
                {progress.title}
              </p>
            </div>

            <div>
              <div className="mb-2 flex justify-between tabular-nums">
                <span>{progress.current} XP</span>
                <span>{progress.required} XP</span>
              </div>

              <div
                role="progressbar"
                aria-label="Progreso al siguiente nivel"
                aria-valuemin={0}
                aria-valuemax={progress.required}
                aria-valuenow={progress.current}
                className="h-3 overflow-hidden rounded-full bg-slate-800"
              >
                <div
                  className="h-full origin-left rounded-full bg-linear-to-r from-violet-600 to-yellow-300 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                  style={{ transform: `scaleX(${progress.percent / 100})` }}
                />
              </div>
            </div>

            <p className="text-sm text-slate-400">
              {progress.remaining} XP para alcanzar el nivel {progress.level + 1}
            </p>

          </div>

          {/* Avatar */}

          <div className="flex items-center justify-center">

            <Avatar className="h-36 w-36">
              <AvatarImage
                src={`https://api.dicebear.com/10.x/bottts/svg?seed=${encodeURIComponent(userId)}`}
                alt=""
              />
              <AvatarFallback>
                {initials}
              </AvatarFallback>
            </Avatar>

          </div>

        </div>

      </CardContent>
    </Card>
  );
}
