"use client";

import {
  Home,
  CheckSquare,
  Trophy,
  Calendar,
  BarChart3,
  History,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

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
    href: "/organizaciones",
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

/** Main navigation, shared by the desktop sidebar and the mobile menu. */
export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
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

          // Nested pages (e.g. /organizaciones/[slug]) keep their section highlighted.
          const active = item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
