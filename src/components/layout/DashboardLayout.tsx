import AppNavbar from "./AppNavbar";
import AppSidebar from "./AppSidebar";

interface Props {
  userName: string;
  children: React.ReactNode;
}

export default function DashboardLayout({
  userName,
  children,
}: Props) {
  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AppNavbar userName={userName} />

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
