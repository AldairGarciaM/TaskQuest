import type { Metadata } from "next";

import InviteMemberForm from "@/components/organization/InviteMemberForm";
import JoinCodePanel from "@/components/organization/JoinCodePanel";
import MemberList from "@/components/organization/MemberList";
import OrganizationDangerZone from "@/components/organization/OrganizationDangerZone";
import PendingInvitations from "@/components/organization/PendingInvitations";
import { canManageInvitations, invitableRoles } from "@/lib/organizations/permissions";

import { loadOrganization } from "../organization";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organization } = await loadOrganization((await params).slug);
  return { title: `Miembros · ${organization.name} · TaskQuest` };
}

export default async function MembersPage({ params }: PageProps) {
  const { user, organization } = await loadOrganization((await params).slug);
  const roles = invitableRoles(organization.myRole);

  return (
    <div className="max-w-3xl space-y-10">
      <section aria-labelledby="members-heading" className="space-y-4">
        <h2 id="members-heading" className="text-sm font-medium tracking-wide text-slate-400 uppercase">
          Miembros
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
        <section aria-labelledby="code-heading" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <h2 id="code-heading" className="font-semibold">
              Unirse con código
            </h2>
            <p className="text-sm text-slate-400">
              Compártelo con tu equipo: lo escriben en «Organizaciones» y entran como miembros.
            </p>
          </div>
          <JoinCodePanel organizationId={organization.id} code={organization.joinCode} />
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
