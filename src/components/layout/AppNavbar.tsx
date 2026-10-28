import { Settings } from "lucide-react";

import type { NotificationFeed } from "@/lib/notifications/server";

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
    <header
      className="
        flex
        h-20
        items-center
        justify-between
        border-b
        border-slate-800
        px-8
      "
    >
      <div>
        <h2 className="text-2xl font-bold">
          ¡Hola, {firstName}! 👋
        </h2>

        <p className="text-slate-400">
          Listo para completar algunas misiones.
        </p>
      </div>

      <div className="flex gap-3">
        <NotificationBell userId={userId} initialFeed={notifications} />

        <button className="rounded-full bg-slate-800 p-3" aria-label="Configuración">
          <Settings size={18} />
        </button>

        <SignOutButton />
      </div>
    </header>
  );
}
