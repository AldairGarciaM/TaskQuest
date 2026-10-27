"use client";

import { KanbanSquare, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export default function OrganizationTabs({ slug, memberCount }: { slug: string; memberCount: number }) {
  const pathname = usePathname();
  const base = `/organizaciones/${slug}`;
  const tabs = [
    { href: base, label: "Tablero", icon: KanbanSquare },
    { href: `${base}/miembros`, label: `Miembros (${memberCount})`, icon: Users },
  ];

  return (
    <nav aria-label="Secciones de la organización" className="flex gap-1 border-b border-slate-800">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "border-violet-500 text-slate-50"
                : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200",
            )}
          >
            <Icon size={16} aria-hidden />
            <span className="tabular-nums">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
