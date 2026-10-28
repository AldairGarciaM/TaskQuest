import DashboardLayout from "@/components/layout/DashboardLayout";
import { getNotificationFeed } from "@/lib/notifications/server";
import { requireUser } from "@/lib/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await getNotificationFeed(user.id);

  return (
    <DashboardLayout userName={user.firstName || "aventurero"} userId={user.id} notifications={notifications}>
      {children}
    </DashboardLayout>
  );
}
