"use client";

import {
  Home,
  CheckSquare,
  Trophy,
  Calendar,
  BarChart3,
  History,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SidebarOrganization } from "@/lib/data/organizations";
import { cn } from "@/lib/utils";

const ORGANIZATIONS_HREF = "/organizaciones";

const menuItems = [
  {
    label: "Dashboard",
    icon: Home,
    href: "/",
  },
  {
    label: "Misiones",
    icon: CheckSquare,
    href: "/misiones",
  },
  {
    label: "Logros",
    icon: Trophy,
    href: "/logros",
  },
  {
    label: "Organizaciones",
    icon: Users,
    href: ORGANIZATIONS_HREF,
  },
  {
    label: "Calendario",
    icon: Calendar,
    href: "/calendario",
  },
  {
    label: "Estadísticas",
    icon: BarChart3,
    href: "/estadisticas",
  },
  {
    label: "Historial",
    icon: History,
    href: "/historial",
  },
];

const itemClass = "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left";

/** Shortcuts listed before the rest collapse into "Ver todas". */
const SHORTCUTS_SHOWN = 5;

/** Tile colors, picked by organization so each keeps its own. */
const TILE_COLORS = [
  "bg-violet-500/20 text-violet-200",
  "bg-sky-500/20 text-sky-200",
  "bg-emerald-500/20 text-emerald-200",
  "bg-amber-500/20 text-amber-200",
  "bg-rose-500/20 text-rose-200",
  "bg-teal-500/20 text-teal-200",
];

function tileColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

interface SidebarNavProps {
  /** My organizations, as shortcuts under "Organizaciones". */
  organizations: SidebarOrganization[];
  onNavigate?: () => void;
}

/** Main navigation, shared by the desktop sidebar and the mobile menu. */
export default function SidebarNav({ organizations, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal">
      <ul className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;

          if (!item.href) {
            return (
              <li key={item.label}>
                <span aria-disabled="true" className={cn(itemClass, "cursor-default text-slate-600")}>
                  <Icon size={20} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] tracking-wide text-slate-500 uppercase">
                    Pronto
                  </span>
                </span>
              </li>
            );
          }

          // Nested pages (e.g. /organizaciones/[slug]) keep their section highlighted,
          // except an organization that has its own shortcut below.
          const inShortcut = organizations.some((o) => isInOrganization(pathname, o.slug));
          const active =
            item.href === pathname ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`) && !(item.href === ORGANIZATIONS_HREF && inShortcut));
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  itemClass,
                  "transition-colors duration-150",
                  active ? "bg-slate-800 text-slate-50" : "text-slate-300 hover:bg-slate-800/60",
                )}
              >
                <Icon size={20} aria-hidden />
                <span>{item.label}</span>
              </Link>
              {item.href === ORGANIZATIONS_HREF && (
                <OrganizationShortcuts organizations={organizations} pathname={pathname} onNavigate={onNavigate} />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isInOrganization(pathname: string, slug: string) {
  const base = `${ORGANIZATIONS_HREF}/${slug}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function OrganizationShortcuts({
  organizations,
  pathname,
  onNavigate,
}: {
  organizations: SidebarOrganization[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const subItem =
    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none";

  if (organizations.length === 0) {
    return (
      <Link
        href={ORGANIZATIONS_HREF}
        onClick={onNavigate}
        className={cn(subItem, "mt-1 ml-6 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300")}
      >
        <Plus size={14} aria-hidden />
        Crea o únete a un equipo
      </Link>
    );
  }

  // The open organization always shows, even past the limit.
  const shown = organizations.filter(
    (o, index) => index < SHORTCUTS_SHOWN || isInOrganization(pathname, o.slug),
  );
  const hidden = organizations.length - shown.length;

  return (
    <ul aria-label="Tus organizaciones" className="mt-1 ml-6 space-y-0.5 border-l border-slate-800 pl-3">
      {shown.map((organization) => {
        const active = isInOrganization(pathname, organization.slug);
        const { attention } = organization;
        return (
          <li key={organization.id}>
            <Link
              href={`${ORGANIZATIONS_HREF}/${organization.slug}`}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                subItem,
                active ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold",
                  tileColor(organization.id),
                )}
              >
                {initials(organization.name)}
              </span>
              <span className="min-w-0 flex-1 truncate">{organization.name}</span>
              {attention > 0 && (
                <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-violet-200 tabular-nums">
                  {attention > 99 ? "99+" : attention}
                  <span className="sr-only"> {attention === 1 ? "tarea te espera" : "tareas te esperan"}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
      {hidden > 0 && (
        <li>
          <Link
            href={ORGANIZATIONS_HREF}
            onClick={onNavigate}
            className={cn(subItem, "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300")}
          >
            Ver todas ({organizations.length})
          </Link>
        </li>
      )}
    </ul>
  );
}
