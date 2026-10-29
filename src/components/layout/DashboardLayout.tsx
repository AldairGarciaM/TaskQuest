import type { NotificationFeed } from "@/lib/notifications/server";

import AppNavbar from "./AppNavbar";
import AppSidebar from "./AppSidebar";

interface Props {
  userName: string;
  userId: string;
  notifications: NotificationFeed;
  children: React.ReactNode;
}

export default function DashboardLayout({
  userName,
  userId,
  notifications,
  children,
}: Props) {
  return (
    <div className="flex h-dvh bg-slate-900 text-white">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppNavbar userName={userName} userId={userId} notifications={notifications} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
