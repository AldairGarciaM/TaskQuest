import { DIFFICULTIES, DifficultyStyles } from "@/app/constants/taskDifficulty";
import type { Difficulty } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { XP_BY_DIFFICULTY } from "@/lib/xp";

interface DifficultyPickerProps {
  name: string;
  defaultValue: Difficulty;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

export default function DifficultyPicker({
  name,
  defaultValue,
  disabled = false,
  error,
  hint,
}: DifficultyPickerProps) {
  return (
    <fieldset disabled={disabled} className="space-y-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-sm font-medium text-slate-300">Dificultad</legend>

      <div className="grid grid-cols-2 gap-2">
        {DIFFICULTIES.map((difficulty) => {
          const style = DifficultyStyles[difficulty];
          const Icon = style.icon;
          return (
            <label key={difficulty} className="cursor-pointer has-disabled:cursor-not-allowed">
              <input
                type="radio"
                name={name}
                value={difficulty}
                defaultChecked={difficulty === defaultValue}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 transition-[border-color,background-color] duration-150",
                  "hover:border-slate-700 peer-checked:border-violet-500 peer-checked:bg-violet-500/10",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500/40 peer-disabled:opacity-60",
                )}
              >
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", style.badge)}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-slate-100">{style.label}</span>
                  <span className="text-xs text-slate-400">+{XP_BY_DIFFICULTY[difficulty]} XP</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </fieldset>
  );
}
