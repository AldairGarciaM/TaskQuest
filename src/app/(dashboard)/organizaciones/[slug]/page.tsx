import type { Metadata } from "next";

import OrgBoard from "@/components/org-board/OrgBoard";
import OrgRanking from "@/components/org-board/OrgRanking";
import { getOrgBoard } from "@/lib/data/org-board";
import { canManageTasks } from "@/lib/organizations/permissions";

import { loadOrganization } from "./organization";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organization } = await loadOrganization((await params).slug);
  return { title: `${organization.name} · TaskQuest` };
}

export default async function OrganizationBoardPage({ params }: PageProps) {
  const { user, organization } = await loadOrganization((await params).slug);
  const { tasks, ranking } = await getOrgBoard(organization.id, organization.members);

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <OrgBoard
        organizationId={organization.id}
        myUserId={user.id}
        canManage={canManageTasks(organization.myRole)}
        tasks={tasks}
        members={organization.members.map(({ userId, firstName, lastName, username }) => ({
          userId,
          firstName,
          lastName,
          username,
        }))}
      />
      <OrgRanking ranking={ranking} myUserId={user.id} />
    </div>
  );
}
