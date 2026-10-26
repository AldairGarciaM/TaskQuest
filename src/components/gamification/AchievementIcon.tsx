import {
  CalendarCheck,
  Compass,
  Crown,
  Flame,
  Footprints,
  Medal,
  Repeat,
  Rocket,
  Shield,
  Sun,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

import type { AchievementDefinition } from "@/lib/gamification/achievements";

const ICONS: Record<AchievementDefinition["icon"], LucideIcon> = {
  CalendarCheck,
  Compass,
  Crown,
  Flame,
  Footprints,
  Medal,
  Repeat,
  Rocket,
  Shield,
  Sun,
};

export default function AchievementIcon({
  name,
  ...props
}: { name: AchievementDefinition["icon"] } & LucideProps) {
  const Icon = ICONS[name];
  return <Icon aria-hidden {...props} />;
}
