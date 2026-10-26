import { Bell, Settings } from "lucide-react";

export default function AppNavbar() {
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
          ¡Hola, Aldair! 👋
        </h2>

        <p className="text-slate-400">
          Listo para completar algunas misiones.
        </p>
      </div>

      <div className="flex gap-3">
        <button className="rounded-full bg-slate-800 p-3">
          <Bell size={18} />
        </button>

        <button className="rounded-full bg-slate-800 p-3">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}