import DashboardLayout from "@/components/layout/DashboardLayout";
import { getSidebarOrganizations } from "@/lib/data/organizations";
import { getNotificationFeed } from "@/lib/notifications/server";
import { requireUser } from "@/lib/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, organizations] = await Promise.all([
    getNotificationFeed(user.id),
    getSidebarOrganizations(user.id),
  ]);

  return (
    <DashboardLayout
      userName={user.firstName || "aventurero"}
      userId={user.id}
      notifications={notifications}
      organizations={organizations}
    >
      {children}
    </DashboardLayout>
  );
}
