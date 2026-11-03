"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-popover !text-foreground",
          description: "!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
