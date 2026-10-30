import { KeyRound, UserRound } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import ChangePasswordForm from "@/components/account/ChangePasswordForm";
import EditProfileForm from "@/components/account/EditProfileForm";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Configuración · TaskQuest",
};

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 rounded-xl border border-slate-800 bg-slate-900 p-6 lg:grid-cols-[16rem_1fr] lg:gap-10">
      <div className="space-y-2">
        <span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-pretty text-slate-400">{description}</p>
      </div>
      <div className="max-w-md">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-slate-400">Tu cuenta y su seguridad.</p>
      </header>

      <Section icon={<UserRound size={20} aria-hidden />} title="Cuenta" description="Tu nombre y los datos con los que inicias sesión: tu correo o tu usuario.">
        <EditProfileForm
          // Remount after saving so the inputs show the normalized values (e.g. lowercase username).
          key={`${user.firstName}|${user.lastName}|${user.username}|${user.email}`}
          profile={{ firstName: user.firstName, lastName: user.lastName, username: user.username, email: user.email }}
        />
      </Section>

      <Section
        icon={<KeyRound size={20} aria-hidden />}
        title="Contraseña"
        description="Necesitas la actual para elegir una nueva. Si no la recuerdas, cierra sesión y usa «¿Olvidaste tu contraseña?»."
      >
        <ChangePasswordForm username={user.username} />
      </Section>
    </div>
  );
}
