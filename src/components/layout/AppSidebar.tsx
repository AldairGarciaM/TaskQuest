import {
  Home,
  CheckSquare,
  Trophy,
  Calendar,
  BarChart3,
  History,
} from "lucide-react";

const menuItems = [
  {
    label: "Dashboard",
    icon: Home,
  },
  {
    label: "Misiones",
    icon: CheckSquare,
  },
  {
    label: "Logros",
    icon: Trophy,
  },
  {
    label: "Calendario",
    icon: Calendar,
  },
  {
    label: "Estadísticas",
    icon: BarChart3,
  },
  {
    label: "Historial",
    icon: History,
  },
];

export default function AppSidebar() {
  return (
    <aside className="w-72 border-r border-slate-800 bg-slate-950 p-6">
      <h1 className="mb-10 text-3xl font-bold">
        ⚔️ TaskQuest
      </h1>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className="
                flex
                w-full
                items-center
                gap-3
                rounded-xl
                px-4
                py-3
                text-left
                transition
                hover:bg-slate-800
              "
            >
              <Icon size={20} />

              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}