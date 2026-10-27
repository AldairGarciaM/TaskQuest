import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import OrganizationTabs from "@/components/organization/OrganizationTabs";
import RoleBadge from "@/components/organization/RoleBadge";

import { loadOrganization } from "./organization";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function OrganizationLayout({ children, params }: LayoutProps) {
  const { organization } = await loadOrganization((await params).slug);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link
          href="/organizaciones"
          className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors duration-150 hover:text-slate-200"
        >
          <ArrowLeft size={16} aria-hidden />
          Organizaciones
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold break-words">{organization.name}</h1>
          <RoleBadge role={organization.myRole} />
        </div>
        <OrganizationTabs slug={organization.slug} memberCount={organization.members.length} />
      </header>

      {children}
    </div>
  );
}
