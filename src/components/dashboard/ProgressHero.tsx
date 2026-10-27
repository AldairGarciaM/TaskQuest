"use client";

import { ArrowUpRight, Flame, ListTodo, Sparkles, Target, Trophy, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { levelProgress, nextLevelTitle } from "@/lib/xp";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FILL = { duration: 0.9, ease: EASE_OUT } as const;

interface ProgressHeroProps {
  userId: string;
  firstName: string;
  fullName: string;
  xp: number;
  streak: number;
  completedCount: number;
  pendingCount: number;
  achievements: { unlocked: number; total: number };
}

export default function ProgressHero({
  userId,
  firstName,
  fullName,
  xp,
  streak,
  completedCount,
  pendingCount,
  achievements,
}: ProgressHeroProps) {
  const reduceMotion = useReducedMotion();
  const progress = levelProgress(xp);
  const next = nextLevelTitle(progress.level);
  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <section
      aria-labelledby="progress-heading"
      className="relative isolate overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
    >
      {/* Soft glow behind the level ring. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 -z-10 size-96 rounded-full bg-violet-600/20 blur-3xl"
      />

      <div className="flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:p-8">
        <LevelRing
          percent={progress.percent}
          level={progress.level}
          reduceMotion={!!reduceMotion}
          avatar={
            <Avatar className="size-full">
              <AvatarImage
                src={`https://api.dicebear.com/10.x/bottts/svg?seed=${encodeURIComponent(userId)}`}
                alt=""
              />
              <AvatarFallback className="bg-slate-800 text-2xl font-semibold text-slate-200">{initials}</AvatarFallback>
            </Avatar>
          }
        />

        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-1">
            <p className="text-sm text-slate-400">Hola, {firstName}</p>
            <h1 id="progress-heading" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-bold tracking-tight text-yellow-300 tabular-nums">
                Nivel {progress.level}
              </span>
              <span className="text-lg font-medium text-slate-300">{progress.title}</span>
            </h1>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-300 tabular-nums">
                <span className="font-semibold text-slate-50">{progress.current}</span> / {progress.required} XP
              </span>
              <span className="text-slate-400 tabular-nums">
                {progress.remaining} XP para el nivel {progress.level + 1}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progreso al siguiente nivel"
              aria-valuemin={0}
              aria-valuemax={progress.required}
              aria-valuenow={progress.current}
              className="h-2.5 overflow-hidden rounded-full bg-slate-800"
            >
              <motion.div
                className="h-full origin-left rounded-full bg-linear-to-r from-violet-500 to-yellow-300"
                initial={reduceMotion ? false : { transform: "scaleX(0)" }}
                animate={{ transform: `scaleX(${progress.percent / 100})` }}
                transition={reduceMotion ? { duration: 0 } : FILL}
              />
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-yellow-300" aria-hidden />
              <span className="tabular-nums">{xp.toLocaleString("es-MX")}</span> XP en total
            </span>
            {next && (
              <span>
                Próximo título: <span className="text-slate-200">{next.title}</span> en el nivel{" "}
                <span className="tabular-nums">{next.level}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 lg:grid-cols-4">
        <Stat
          icon={Flame}
          label="Racha"
          value={streak}
          unit={streak === 1 ? "día" : "días"}
          hint={streak > 0 ? "Días seguidos completando misiones" : "Completa una misión para empezarla"}
          tone={streak > 0 ? "text-orange-400" : "text-slate-500"}
        />
        <Stat
          icon={Target}
          label="Completadas"
          value={completedCount}
          hint="Misiones personales terminadas"
          tone="text-emerald-400"
        />
        <Stat
          icon={ListTodo}
          label="Pendientes"
          value={pendingCount}
          hint="Misiones personales por hacer"
          tone="text-violet-400"
        />
        <Stat
          icon={Trophy}
          label="Logros"
          value={achievements.unlocked}
          unit={`/ ${achievements.total}`}
          hint="Ver todos los logros"
          tone="text-yellow-300"
          href="/logros"
        />
      </ul>
    </section>
  );
}

function LevelRing({
  percent,
  level,
  reduceMotion,
  avatar,
}: {
  percent: number;
  level: number;
  reduceMotion: boolean;
  avatar: React.ReactNode;
}) {
  const gradientId = useId();

  return (
    <div className="relative mx-auto size-36 shrink-0 sm:mx-0">
      <svg viewBox="0 0 144 144" aria-hidden className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
        </defs>
        <circle cx="72" cy="72" r="66" fill="none" strokeWidth="6" className="stroke-slate-800" />
        <motion.circle
          cx="72"
          cy="72"
          r="66"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          initial={reduceMotion ? false : { pathLength: 0 }}
          // A tiny minimum keeps the round cap visible at 0 XP.
          animate={{ pathLength: Math.max(percent / 100, 0.001) }}
          transition={reduceMotion ? { duration: 0 } : FILL}
        />
      </svg>

      <div className="absolute inset-3 overflow-hidden rounded-full bg-slate-950">{avatar}</div>

      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-xs font-bold text-yellow-300 tabular-nums">
        Nv. {level}
      </span>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit?: string;
  hint: string;
  tone: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm text-slate-400">
        <Icon size={16} className={tone} aria-hidden />
        {label}
        {href && (
          <ArrowUpRight
            size={14}
            aria-hidden
            className="ml-auto text-slate-600 transition-colors duration-150 group-hover:text-slate-300"
          />
        )}
      </span>
      <span className="mt-2 block text-2xl font-bold text-slate-50 tabular-nums">
        {value.toLocaleString("es-MX")}
        {unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
      </span>
      <span className="mt-1 block text-xs text-slate-500">{hint}</span>
    </>
  );

  return (
    <li className="bg-slate-900">
      {href ? (
        <Link
          href={href}
          className="group block h-full p-5 transition-colors duration-150 hover:bg-slate-800/50 focus-visible:bg-slate-800/50 focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <div className="h-full p-5">{body}</div>
      )}
    </li>
  );
}
