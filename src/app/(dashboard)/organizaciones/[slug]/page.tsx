import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cache } from "react";

import InviteMemberForm from "@/components/organization/InviteMemberForm";
import MemberList from "@/components/organization/MemberList";
import OrganizationDangerZone from "@/components/organization/OrganizationDangerZone";
import PendingInvitations from "@/components/organization/PendingInvitations";
import RoleBadge from "@/components/organization/RoleBadge";
import { getOrganizationForMember } from "@/lib/data/organizations";
import { canManageInvitations, invitableRoles } from "@/lib/organizations/permissions";
import { requireUser } from "@/lib/session";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Shared by generateMetadata and the page within one request.
const loadOrganization = cache(async (slug: string) => {
  const user = await requireUser();
  return { user, organization: await getOrganizationForMember(slug, user.id) };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organization } = await loadOrganization((await params).slug);
  return { title: `${organization?.name ?? "Organización"} · TaskQuest` };
}

export default async function OrganizationPage({ params }: PageProps) {
  const { user, organization } = await loadOrganization((await params).slug);
  // Not a member (or it doesn't exist, or you just left it): don't reveal which.
  if (!organization) redirect("/organizaciones");

  const roles = invitableRoles(organization.myRole);

  return (
    <div className="max-w-3xl space-y-10">
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
      </header>

      <section aria-labelledby="members-heading" className="space-y-4">
        <h2 id="members-heading" className="text-sm font-medium tracking-wide text-slate-400 uppercase">
          Miembros <span className="tabular-nums">({organization.members.length})</span>
        </h2>
        <MemberList
          organizationId={organization.id}
          myUserId={user.id}
          myRole={organization.myRole}
          members={organization.members}
        />
      </section>

      {roles.length > 0 && (
        <section aria-labelledby="invite-heading" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <h2 id="invite-heading" className="font-semibold">
              Invitar
            </h2>
            <p className="text-sm text-slate-400">Solo la cuenta con ese correo podrá aceptar.</p>
          </div>
          <InviteMemberForm organizationId={organization.id} roles={roles} />
        </section>
      )}

      {canManageInvitations(organization.myRole) && (
        <section aria-labelledby="pending-heading" className="space-y-4">
          <h2 id="pending-heading" className="text-sm font-medium tracking-wide text-slate-400 uppercase">
            Invitaciones pendientes
          </h2>
          <PendingInvitations myRole={organization.myRole} invitations={organization.invitations} />
        </section>
      )}

      <OrganizationDangerZone
        organizationId={organization.id}
        organizationName={organization.name}
        myRole={organization.myRole}
      />
    </div>
  );
}
