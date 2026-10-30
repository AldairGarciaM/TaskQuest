import { ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import CreateOrganizationForm from "@/components/organization/CreateOrganizationForm";
import JoinOrganizationForm from "@/components/organization/JoinOrganizationForm";
import RoleBadge from "@/components/organization/RoleBadge";
import { getMyOrganizations } from "@/lib/data/organizations";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Organizaciones · TaskQuest",
};

export default async function OrganizationsPage() {
  const user = await requireUser();
  const organizations = await getMyOrganizations(user.id);

  return (
    <div className="max-w-5xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Organizaciones</h1>
        <p className="text-slate-400">Reúne a tu equipo. La XP que ganen juntos sube su nivel personal.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="create-heading"
          className="@container space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div>
            <h2 id="create-heading" className="font-semibold">
              Nueva organización
            </h2>
            <p className="text-sm text-slate-400">Serás su dueño: podrás invitar a tu equipo y repartir tareas.</p>
          </div>
          <CreateOrganizationForm />
        </section>

        <section
          aria-labelledby="join-heading"
          className="@container space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div>
            <h2 id="join-heading" className="font-semibold">
              Unirse a una organización
            </h2>
            <p className="text-sm text-slate-400">Pide el código a un dueño o admin del equipo. Entrarás como miembro.</p>
          </div>
          <JoinOrganizationForm />
        </section>
      </div>

      <section aria-labelledby="mine-heading" className="space-y-4">
        <h2 id="mine-heading" className="text-sm font-medium tracking-wide text-slate-400 uppercase">
          Tus organizaciones
        </h2>

        {organizations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
              <Users size={22} aria-hidden />
            </span>
            <p className="font-medium text-slate-200">Aún no perteneces a ninguna</p>
            <p className="max-w-sm text-sm text-slate-500">
              Crea una, únete con un código o pide a alguien que te invite con tu correo.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  href={`/organizaciones/${organization.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 transition-colors duration-150 hover:border-slate-700 hover:bg-slate-800/60"
                >
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-lg font-bold text-violet-200"
                  >
                    {organization.name[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-100">{organization.name}</span>
                    <span className="text-sm text-slate-500 tabular-nums">
                      {organization.memberCount} {organization.memberCount === 1 ? "miembro" : "miembros"}
                    </span>
                  </span>
                  <RoleBadge role={organization.role} />
                  <ChevronRight
                    size={18}
                    aria-hidden
                    className="text-slate-600 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
