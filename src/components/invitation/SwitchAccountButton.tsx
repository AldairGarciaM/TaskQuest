"use client";

import { signOut } from "next-auth/react";

/** Signs out and comes back to the invitation so the right account can accept it. */
export default function SwitchAccountButton({ returnTo }: { returnTo: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: returnTo })}
      className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-700 text-sm font-medium text-slate-200 transition-[background-color,transform] duration-150 hover:bg-slate-800 active:scale-[0.97]"
    >
      Cerrar sesión y usar otra cuenta
    </button>
  );
}
