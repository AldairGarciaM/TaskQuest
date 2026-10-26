import { CircleAlert } from "lucide-react";

export default function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      <CircleAlert size={18} className="mt-px shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
