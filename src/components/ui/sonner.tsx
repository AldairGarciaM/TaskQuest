"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-slate-800 !bg-slate-900 !text-slate-100",
          description: "!text-slate-400",
        },
      }}
      {...props}
    />
  );
}
