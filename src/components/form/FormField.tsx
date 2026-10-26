import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormFieldProps extends ComponentProps<"input"> {
  label: string;
  error?: string;
  trailing?: ReactNode;
}

export default function FormField({
  label,
  error,
  trailing,
  className,
  ...props
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-slate-100",
            "placeholder:text-slate-600 outline-none transition-[border-color,box-shadow] duration-150",
            "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30",
            "aria-invalid:border-rose-500/70 aria-invalid:focus:ring-rose-500/25",
            trailing && "pr-11",
            className,
          )}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
