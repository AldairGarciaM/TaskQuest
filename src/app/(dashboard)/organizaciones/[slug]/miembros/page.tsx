import type { Metadata } from "next";

import InviteMemberForm from "@/components/organization/InviteMemberForm";
import JoinCodePanel from "@/components/organization/JoinCodePanel";
import MemberList from "@/components/organization/MemberList";
import OrganizationDangerZone from "@/components/organization/OrganizationDangerZone";
import PendingInvitations from "@/components/organization/PendingInvitations";
import { canManageInvitations, invitableRoles } from "@/lib/organizations/permissions";
import { cn } from "@/lib/utils";

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

  const canInviteAny = roles.length > 0;
  const managesInvitations = canManageInvitations(organization.myRole);
  const hasOptions = canInviteAny || managesInvitations;

  return (
    <div className={cn("space-y-10", hasOptions ? "max-w-6xl" : "max-w-3xl")}>
      <div className={cn("grid gap-10", hasOptions && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8")}>
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

        {hasOptions && (
          <div className="space-y-6">
            <h2 className="text-sm font-medium tracking-wide text-slate-400 uppercase">Agregar miembros</h2>

            {canInviteAny && (
              <section
                aria-labelledby="invite-heading"
                className="@container space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div>
                  <h3 id="invite-heading" className="font-semibold">
                    Invitar por correo
                  </h3>
                  <p className="text-sm text-slate-400">Solo la cuenta con ese correo podrá aceptar.</p>
                </div>
                <InviteMemberForm organizationId={organization.id} roles={roles} />
              </section>
            )}

            {managesInvitations && (
              <section
                aria-labelledby="code-heading"
                className="@container space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div>
                  <h3 id="code-heading" className="font-semibold">
                    Unirse con código
                  </h3>
                  <p className="text-sm text-slate-400">
                    Compártelo con tu equipo: lo escriben en «Organizaciones» y entran como miembros.
                  </p>
                </div>
                <JoinCodePanel organizationId={organization.id} code={organization.joinCode} />
              </section>
            )}

            {managesInvitations && (
              <section aria-labelledby="pending-heading" className="space-y-4">
                <h3 id="pending-heading" className="text-sm font-medium tracking-wide text-slate-400 uppercase">
                  Invitaciones pendientes
                </h3>
                <PendingInvitations myRole={organization.myRole} invitations={organization.invitations} />
              </section>
            )}
          </div>
        )}
      </div>

      <OrganizationDangerZone
        organizationId={organization.id}
        organizationName={organization.name}
        myRole={organization.myRole}
      />
    </div>
  );
}
