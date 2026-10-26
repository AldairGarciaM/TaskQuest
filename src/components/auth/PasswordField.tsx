"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import AuthField from "./AuthField";

type PasswordFieldProps = Omit<ComponentProps<typeof AuthField>, "type" | "trailing">;

export default function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <AuthField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:text-slate-200 focus-visible:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <Icon size={18} />
        </button>
      }
    />
  );
}
