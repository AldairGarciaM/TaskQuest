"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="rounded-full bg-slate-800 p-3 transition-[background-color,transform] duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none active:scale-[0.97]"
    >
      <LogOut size={18} aria-hidden />
    </button>
  );
}
