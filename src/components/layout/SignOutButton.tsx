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
      className="rounded-full bg-slate-800 p-3 transition-[background-color,transform] duration-150 hover:bg-slate-700 active:scale-[0.97]"
    >
      <LogOut size={18} />
    </button>
  );
}
