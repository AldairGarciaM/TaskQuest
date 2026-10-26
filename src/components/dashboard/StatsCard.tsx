import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
}

export default function StatsCard({
  title,
  value,
  description,
  icon: Icon,
}: StatsCardProps) {
  return (
    
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-6">

        <div className="mb-4">
          <Icon className="h-8 w-8 text-violet-500" />
        </div>

        <h3 className="text-sm text-slate-400">
          {title}
        </h3>

        <p className="mt-2 text-3xl font-bold text-amber-100">
          {value}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>

      </CardContent>
    </Card>
  );
}