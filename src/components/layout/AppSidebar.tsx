import SidebarNav from "./SidebarNav";

/** Fixed sidebar on large screens; smaller ones use MobileNav from the navbar. */
export default function AppSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 p-6 lg:block">
      <p className="mb-10 text-3xl font-bold">
        ⚔️ TaskQuest
      </p>

      <SidebarNav />
    </aside>
  );
}
