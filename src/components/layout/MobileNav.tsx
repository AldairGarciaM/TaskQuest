"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import SidebarNav from "./SidebarNav";

const iconButton =
  "grid size-10 shrink-0 place-items-center rounded-full bg-slate-800 transition-[background-color,transform] duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none active:scale-[0.97]";

/** Menu button + slide-in navigation for screens without the sidebar. */
export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Abrir menú" className={`${iconButton} lg:hidden`}>
        <Menu size={18} aria-hidden />
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 overflow-y-auto border-slate-800 bg-slate-950 p-6 text-base text-slate-100"
      >
        <div className="mb-8 flex items-center justify-between gap-3">
          <SheetTitle className="text-2xl font-bold text-slate-50">⚔️ TaskQuest</SheetTitle>
          <SheetClose aria-label="Cerrar menú" className={iconButton}>
            <X size={18} aria-hidden />
          </SheetClose>
        </div>

        {/* Close on every tap: "/#missions-heading" stays on the same path, so a route change isn't enough. */}
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
