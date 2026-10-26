import DashboardLayout from "@/components/layout/DashboardLayout";
import { requireUser } from "@/lib/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <DashboardLayout userName={user.firstName || "aventurero"}>{children}</DashboardLayout>;
}
