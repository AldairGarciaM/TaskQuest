import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

interface SubmitButtonProps {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}

export default function SubmitButton({ pending, children, pendingLabel }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending && <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </button>
  );
}
