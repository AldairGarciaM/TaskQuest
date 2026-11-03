import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// The whole app is set in JetBrains Mono (globals.css applies font-mono to <html>).
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "TaskQuest",
  description: "Gestor de tareas con XP, niveles y misiones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark only: the "dark" class keeps shadcn's dark: variants on.
    <html lang="es" className={cn("dark h-full antialiased font-mono", jetbrainsMono.variable)}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
