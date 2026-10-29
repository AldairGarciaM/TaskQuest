import { Settings } from "lucide-react";
import Link from "next/link";

import type { NotificationFeed } from "@/lib/notifications/server";

import MobileNav from "./MobileNav";
import NotificationBell from "./NotificationBell";
import SignOutButton from "./SignOutButton";

interface AppNavbarProps {
  userName: string;
  userId: string;
  notifications: NotificationFeed;
}

export default function AppNavbar({ userName, userId, notifications }: AppNavbarProps) {
  const firstName = userName.split(" ")[0];

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 sm:px-6 lg:h-20 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav />

        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold sm:text-2xl">
            ¡Hola, {firstName}! 👋
          </h2>

          <p className="hidden truncate text-slate-400 sm:block">
            Listo para completar algunas misiones.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 sm:gap-3">
        <NotificationBell userId={userId} initialFeed={notifications} />

        <Link
          href="/configuracion"
          className="rounded-full bg-slate-800 p-3 transition-[background-color,transform] duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none active:scale-[0.97]"
          aria-label="Configuración"
        >
          <Settings size={18} aria-hidden />
        </Link>

        <SignOutButton />
      </div>
    </header>
  );
}
