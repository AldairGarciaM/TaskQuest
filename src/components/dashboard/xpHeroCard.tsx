import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";

import { Swords } from "lucide-react";

export default function XpHeroCard() {
  const currentXp = 850;
  const nextLevelXp = 1000;

  const progress =
    (currentXp / nextLevelXp) * 100;

  return (
    <Card className="border-slate-800 bg-slate-900/80">
      <CardContent className="p-8">

        <div className="grid gap-8 md:grid-cols-3 items-center">

          {/* XP */}

          <div className="md:col-span-2 space-y-6">
            <Swords className="h-12 w-12 text-violet-500"></Swords>

            <div>
              <h2 className="text-4xl font-bold text-yellow-300">
                Nivel 5
              </h2>

              <p className="text-slate-400">
                Aventurero
              </p>
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <span>{currentXp} XP</span>
                <span>{nextLevelXp} XP</span>
              </div>

              <Progress value={progress} />
            </div>

            <p className="text-sm text-slate-400">
              {nextLevelXp - currentXp} XP para alcanzar el siguiente nivel
            </p>

          </div>

          {/* Avatar */}

          <div className="flex items-center justify-center">

            <Avatar className="h-36 w-36">
              <AvatarImage
                src="https://api.dicebear.com/10.x/bottts/svg?seed=Aldair"
              />
              <AvatarFallback>
                AG
              </AvatarFallback>
            </Avatar>

          </div>

        </div>

      </CardContent>
    </Card>
  );
}