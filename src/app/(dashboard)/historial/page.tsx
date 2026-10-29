import { ArrowLeft, ChevronDown, History, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DifficultyStyles } from "@/app/constants/taskDifficulty";
import AchievementIcon from "@/components/gamification/AchievementIcon";
import { addDays, relativeDayLabel } from "@/lib/calendar";
import {
  getHistory,
  HISTORY_FILTERS,
  parseCursor,
  parseHistoryFilter,
  type HistoryFilter,
  type HistoryItem,
} from "@/lib/data/history";
import { APP_TIME_ZONE, dayKey } from "@/lib/dates";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/gamification/achievements";
import { DAILY_CATALOG } from "@/lib/gamification/daily";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Historial · TaskQuest",
};

const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: "Todo",
  missions: "Misiones",
  team: "Equipo",
  achievements: "Logros",
};

const EMPTY: Record<HistoryFilter, string> = {
  all: "Aún no hay nada en tu historial. Completa una misión y aparecerá aquí.",
  missions: "Todavía no completas misiones personales.",
  team: "Todavía no completas tareas de equipo.",
  achievements: "Aún no desbloqueas logros.",
};

const timeFormatter = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
const yearFormatter = new Intl.DateTimeFormat("es-MX", { year: "numeric", timeZone: "UTC" });

/** "Hoy", "Ayer", "lun 26 oct", plus the year when it isn't the current one. */
function dayHeading(key: string, today: string) {
  if (key === addDays(today, -1)) return "Ayer";
  const label = relativeDayLabel(key, today);
  return key.slice(0, 4) === today.slice(0, 4)
    ? label
    : `${label} ${yearFormatter.format(new Date(`${key}T00:00:00.000Z`))}`;
}

function href(filter: HistoryFilter, before?: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filtro", filter);
  if (before) params.set("antes", before);
  const query = params.toString();
  return query ? `/historial?${query}` : "/historial";
}

function xpOf(item: HistoryItem) {
  return item.kind === "achievement" ? 0 : item.xp;
}

interface HistoryPageProps {
  searchParams: Promise<{ filtro?: string | string[]; antes?: string | string[] }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = parseHistoryFilter(params.filtro);
  const before = parseCursor(params.antes);
  const { items, nextCursor } = await getHistory(user.id, { filter, before });
  const today = dayKey(new Date());

  const days: { key: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const key = dayKey(new Date(item.at));
    const last = days.at(-1);
    if (last?.key === key) last.items.push(item);
    else days.push({ key, items: [item] });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Historial</h1>
          <p className="text-slate-400">Todo lo que has conseguido, de lo más reciente a lo más antiguo.</p>
        </div>

        <nav aria-label="Filtrar historial" className="flex flex-wrap rounded-xl border border-slate-800 bg-slate-900 p-1">
          {HISTORY_FILTERS.map((value) => (
            <Link
              key={value}
              href={href(value)}
              aria-current={value === filter ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                value === filter ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {FILTER_LABELS[value]}
            </Link>
          ))}
        </nav>
      </header>

      {before && (
        <Link
          href={href(filter)}
          className="inline-flex items-center gap-1.5 text-sm text-violet-300 transition-colors hover:text-violet-200"
        >
          <ArrowLeft size={14} aria-hidden /> Volver a lo más reciente
        </Link>
      )}

      {days.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
            <History size={22} aria-hidden />
          </span>
          <p className="text-sm text-slate-400">{before ? "No hay nada más antiguo." : EMPTY[filter]}</p>
        </div>
      ) : (
        <ol className="space-y-6">
          {days.map((day) => {
            const xp = day.items.reduce((n, item) => n + xpOf(item), 0);
            return (
              <li key={day.key} aria-labelledby={`day-${day.key}`}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 id={`day-${day.key}`} className="text-sm font-semibold text-slate-300 first-letter:uppercase">
                    {dayHeading(day.key, today)}
                  </h2>
                  {xp > 0 && <span className="text-xs font-semibold text-green-400 tabular-nums">+{xp} XP</span>}
                </div>
                <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  {day.items.map((item) => (
                    <HistoryRow key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <Link
            href={href(filter, nextCursor)}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-800 px-4 text-sm text-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
          >
            <ChevronDown size={16} aria-hidden /> Ver más antiguas
          </Link>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const time = timeFormatter.format(new Date(item.at));

  let icon: React.ReactNode;
  let title: React.ReactNode;
  let meta: React.ReactNode;

  switch (item.kind) {
    case "personal": {
      const style = DifficultyStyles[item.difficulty];
      const Icon = style.icon;
      icon = (
        <span className={cn("grid size-9 place-items-center rounded-xl", style.badge)}>
          <Icon size={16} aria-hidden />
        </span>
      );
      title = <>Completaste “{item.title}”</>;
      meta = (
        <>
          Misión {style.label.toLowerCase()}
          {item.onTime === true && <span className="text-emerald-300"> · a tiempo</span>}
          {item.onTime === false && <span className="text-rose-300"> · después de la fecha límite</span>}
        </>
      );
      break;
    }
    case "team":
      icon = (
        <span className="grid size-9 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
          <Users size={16} aria-hidden />
        </span>
      );
      title = <>Completaste “{item.title}”</>;
      meta = (
        <>
          <Link href={`/organizaciones/${item.organization.slug}`} className="hover:text-slate-200 hover:underline">
            {item.organization.name}
          </Link>
          {item.approvedBy && <> · aprobada por {item.approvedBy}</>}
        </>
      );
      break;
    case "bonus": {
      const mission = DAILY_CATALOG[item.mission];
      icon = (
        <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
          <Target size={16} aria-hidden />
        </span>
      );
      title = <>Misión diaria: {mission.title}</>;
      meta = "Bono por cumplir el objetivo del día";
      break;
    }
    case "achievement": {
      const achievement = ACHIEVEMENTS_BY_KEY.get(item.key);
      icon = (
        <span className="grid size-9 place-items-center rounded-xl bg-yellow-400/15 text-yellow-300">
          {achievement ? <AchievementIcon name={achievement.icon} size={16} /> : <History size={16} aria-hidden />}
        </span>
      );
      title = <>Logro desbloqueado: {achievement?.title ?? item.key}</>;
      meta = achievement?.description;
      break;
    }
  }

  const xp = xpOf(item);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{meta}</p>
      </div>
      <div className="shrink-0 text-right">
        {xp > 0 && <p className="text-sm font-semibold text-green-400 tabular-nums">+{xp} XP</p>}
        <p className="text-xs text-slate-500 tabular-nums">
          <time dateTime={item.at}>{time}</time>
        </p>
      </div>
    </li>
  );
}
