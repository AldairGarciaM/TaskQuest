import { Crown, Leaf, Shield, Swords, type LucideIcon } from "lucide-react";

import type { Difficulty } from "@/generated/prisma/enums";

interface DifficultyStyle {
    label: "Fácil" | "Media" | "Difícil" | "Épica";
    color: string;
    badge: string;
    icon: LucideIcon;
}

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "EPIC"] as const satisfies readonly Difficulty[];

export const DifficultyStyles: Record<Difficulty, DifficultyStyle> = {
    EASY: {
        label: "Fácil",
        color: "bg-green-500",
        badge: "bg-green-500/20 text-green-300",
        icon: Leaf,
    },

    MEDIUM: {
        label: "Media",
        color: "bg-blue-500",
        badge: "bg-blue-500/20 text-blue-300",
        icon: Shield,
    },

    HARD: {
        label: "Difícil",
        color: "bg-orange-500",
        badge: "bg-orange-500/20 text-orange-300",
        icon: Swords,
    },

    EPIC: {
        label: "Épica",
        color: "bg-violet-500",
        badge: "bg-violet-500/20 text-violet-300",
        icon: Crown,
    },
};
