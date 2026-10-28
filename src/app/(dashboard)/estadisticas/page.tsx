import { ArrowDownRight, ArrowUpRight, Flame, ListChecks, Timer, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DIFFICULTIES, DifficultyStyles } from "@/app/constants/taskDifficulty";
import ColumnChart, { type ChartColumn } from "@/components/stats/ColumnChart";
import { compact, SERIES_COLORS } from "@/components/stats/chart-utils";
import { relativeDayLabel, weekdayLabel, WEEKDAY_LABELS } from "@/lib/calendar";
import { getStats } from "@/lib/data/stats";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { bucketDays, parseRangeParam, percentChange, STAT_RANGES, type XpSource } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Estadísticas · TaskQuest",
};

const XP_SERIES = [
  { key: "personal", label: "Misiones personales", color: SERIES_COLORS.personal },
  { key: "bonus", label: "Bonos diarios", color: SERIES_COLORS.bonus },
  { key: "team", label: "Tareas de equipo", color: SERIES_COLORS.team },
] satisfies { key: XpSource; label: string; color: string }[];

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

function axisDate(key: string) {
  return shortDate.format(new Date(`${key}T00:00:00.000Z`)).replace(".", "");
}

function days(n: number) {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

interface StatsPageProps {
  searchParams: Promise<{ rango?: string | string[] }>;
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const user = await requireUser();
  const range = parseRangeParam((await searchParams).rango);
  const today = dayKey(new Date());
  const stats = await getStats(user.id, range, today);

  const change = percentChange(stats.xp, stats.previousXp);
  const onTimeRate = stats.dated > 0 ? Math.round((stats.onTime / stats.dated) * 100) : null;
  const weekly = bucketDays(range) > 1;
  const per = weekly ? "semana" : "día";

  const xpColumns: ChartColumn<XpSource>[] = stats.buckets.map((b) => ({
    key: b.from,
    label: range === 7 ? weekdayLabel(b.from) : axisDate(b.from),
    title: weekly ? `${axisDate(b.from)} – ${axisDate(b.to)}` : relativeDayLabel(b.from, today),
    values: b.xp,
  }));
  const weekdayColumns: ChartColumn<"tasks">[] = WEEKDAY_LABELS.map((label, i) => ({
    key: label,
    label,
    title: label,
    values: { tasks: stats.byWeekday[i] },
  }));
  const maxDifficulty = Math.max(...Object.values(stats.byDifficulty), 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Estadísticas</h1>
          <p className="text-slate-400">Cómo vas ganando XP y qué días rindes más.</p>
        </div>

        <nav aria-label="Periodo" className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          {STAT_RANGES.map((value) => (
            <Link
              key={value}
              href={`/estadisticas?rango=${value}`}
              aria-current={value === range ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                value === range ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {value} días
            </Link>
          ))}
        </nav>
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">XP ganada en {range} días</p>
          <p className="mt-1 text-5xl font-bold text-slate-50 tabular-nums">{stats.xp.toLocaleString("es-MX")}</p>
          <p className="mt-2 flex flex-wrap items-center gap-1 text-sm">
            {change === null ? (
              <span className="text-slate-500">Sin XP en el periodo anterior para comparar</span>
            ) : (
              <>
                <span
                  className={cn("flex items-center gap-0.5 font-semibold", change >= 0 ? "text-emerald-300" : "text-rose-300")}
                >
                  {change >= 0 ? <ArrowUpRight size={15} aria-hidden /> : <ArrowDownRight size={15} aria-hidden />}
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
                <span className="text-slate-500">vs. los {range} días anteriores</span>
              </>
            )}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Nivel {stats.level} · {compact(stats.totalXp)} XP en total
          </p>
        </div>

        <StatTile icon={ListChecks} label="Tareas completadas" value={String(stats.completed)} detail="Personales y de equipo" />
        <StatTile
          icon={Timer}
          label="A tiempo"
          value={onTimeRate === null ? "—" : `${onTimeRate}%`}
          detail={stats.dated === 0 ? "Ninguna tenía fecha límite" : `${stats.onTime} de ${stats.dated} con fecha límite`}
        />
        <StatTile
          icon={Flame}
          label="Racha actual"
          value={days(stats.currentStreak)}
          detail={`Mejor racha: ${days(stats.bestStreak)}`}
        />
      </section>

      <section aria-labelledby="xp-heading" className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 id="xp-heading" className="font-semibold">
          XP por {per}
        </h2>
        <p className="mb-4 text-sm text-slate-400">De dónde viene cada punto de experiencia.</p>
        <ColumnChart
          title={`XP por ${per}`}
          columns={xpColumns}
          series={XP_SERIES}
          unit="XP"
          labelEvery={range === 30 ? 5 : range === 90 ? 2 : 1}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="difficulty-heading" className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 id="difficulty-heading" className="font-semibold">
            Completadas por dificultad
          </h2>
          <p className="mb-4 text-sm text-slate-400">Tareas terminadas en el periodo.</p>
          <ul className="space-y-3">
            {DIFFICULTIES.map((difficulty) => {
              const count = stats.byDifficulty[difficulty];
              const { label, icon: Icon } = DifficultyStyles[difficulty];
              return (
                <li key={difficulty} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Icon size={15} className="text-slate-500" aria-hidden /> {label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-5 rounded-r-[4px]"
                      style={{
                        width: `calc((100% - 2.5rem) * ${count / maxDifficulty})`,
                        minWidth: count > 0 ? 4 : 0,
                        backgroundColor: SERIES_COLORS.personal,
                      }}
                      aria-hidden
                    />
                    <span className="font-semibold text-slate-200 tabular-nums">{count}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="weekday-heading" className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 id="weekday-heading" className="font-semibold">
            Tareas por día de la semana
          </h2>
          <p className="mb-4 text-sm text-slate-400">Qué días rindes más en el periodo.</p>
          <ColumnChart
            title="Tareas por día de la semana"
            columns={weekdayColumns}
            series={[{ key: "tasks", label: "Tareas", color: SERIES_COLORS.personal }]}
            unit="tareas"
            height={150}
          />
        </section>
      </div>
    </div>
  );
}

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

function StatTile({ icon: Icon, label, value, detail }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Icon size={15} className="text-slate-500" aria-hidden /> {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-50 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
