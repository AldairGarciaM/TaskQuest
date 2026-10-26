import { Crown, Leaf, Shield, Swords, type LucideIcon } from "lucide-react";

export type Difficulty = "Fácil" | "Media" | "Difícil" | "Épica";

interface DifficultyStyle {
    color: string;
    badge: string;
    icon: LucideIcon;
}

export const DifficultyStyles: Record<Difficulty, DifficultyStyle> = {
    Fácil: {
        color: "bg-green-500",
        badge: "bg-green-500/20 text-green-300",
        icon: Leaf,
    },

    Media: {
        color: "bg-blue-500",
        badge: "bg-blue-500/20 text-blue-300",
        icon: Shield,
    },

    Difícil: {
        color: "bg-orange-500",
        badge: "bg-orange-500/20 text-orange-300",
        icon: Swords,
    },

    Épica: {
        color: "bg-violet-500",
        badge: "bg-violet-500/20 text-violet-300",
        icon: Crown,
    },
};
