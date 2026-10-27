import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import type { ReactNode } from "react";

import AuthShell from "@/components/auth/AuthShell";
import AcceptInvitationButton from "@/components/invitation/AcceptInvitationButton";
import InvitationSignupForm from "@/components/invitation/InvitationSignupForm";
import SwitchAccountButton from "@/components/invitation/SwitchAccountButton";
import RoleBadge from "@/components/organization/RoleBadge";
import { authOptions } from "@/lib/auth";
import { findInvitationByToken, type InvitationLookup } from "@/lib/data/organizations";
import { prisma } from "@/lib/prisma";
import { invitationTokenSchema } from "@/lib/validations/organization";

export const metadata: Metadata = {
  title: "Invitación · TaskQuest",
  // Links carry a secret token.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

const linkClass = "font-medium text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline";

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight text-balance text-slate-50">{title}</h1>
      {children && <div className="text-sm text-slate-400">{children}</div>}
    </header>
  );
}

function Unavailable({ invitation, signedIn }: { invitation: Exclude<InvitationLookup, { status: "pending" }>; signedIn: boolean }) {
  const copy = {
    invalid: { title: "Enlace no válido", body: "Revisa que hayas copiado el enlace completo." },
    expired: { title: "Invitación vencida", body: "Pide a quien te invitó que te envíe una nueva." },
    accepted: { title: "Invitación ya usada", body: "Este enlace ya se utilizó para unirse." },
  }[invitation.status];

  return (
    <div className="space-y-8">
      <Heading title={copy.title}>
        {"organizationName" in invitation && (
          <p className="mb-1">
            Organización: <span className="text-slate-200">{invitation.organizationName}</span>
          </p>
        )}
        <p>{copy.body}</p>
      </Heading>
      <Link href={signedIn ? "/organizaciones" : "/auth/login"} className={linkClass}>
        {signedIn ? "Ir a mis organizaciones" : "Ir a iniciar sesión"}
      </Link>
    </div>
  );
}

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;
  const parsedToken = invitationTokenSchema.safeParse(token);
  const [invitation, session] = await Promise.all([
    parsedToken.success ? findInvitationByToken(parsedToken.data) : Promise.resolve({ status: "invalid" } as const),
    getServerSession(authOptions),
  ]);
  const signedInId = session?.user?.id ?? null;

  if (invitation.status !== "pending") {
    return (
      <AuthShell>
        <Unavailable invitation={invitation} signedIn={Boolean(signedInId)} />
      </AuthShell>
    );
  }

  const returnTo = `/invitaciones/${token}`;
  const intro = (
    <Heading title={`Únete a ${invitation.organizationName}`}>
      <p>
        {invitation.inviterName ? `${invitation.inviterName} te invitó` : "Te invitaron"} como{" "}
        <RoleBadge role={invitation.role} className="align-middle" />
      </p>
    </Heading>
  );

  let body: ReactNode;
  if (signedInId) {
    const account = await prisma.user.findUnique({ where: { id: signedInId }, select: { email: true } });
    body =
      account?.email === invitation.email ? (
        <AcceptInvitationButton token={token} organizationName={invitation.organizationName} />
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Esta invitación es para <strong className="font-semibold">{invitation.email}</strong>, pero iniciaste
            sesión como {account?.email ?? "otra cuenta"}.
          </p>
          <SwitchAccountButton returnTo={returnTo} />
        </div>
      );
  } else {
    const hasAccount = await prisma.user.count({ where: { email: invitation.email } });
    body = hasAccount ? (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Ya existe una cuenta con <span className="text-slate-200">{invitation.email}</span>. Inicia sesión para
          aceptar.
        </p>
        <Link
          href={`/auth/login?callbackUrl=${encodeURIComponent(returnTo)}`}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet-500 active:scale-[0.97]"
        >
          Iniciar sesión
        </Link>
      </div>
    ) : (
      <InvitationSignupForm token={token} email={invitation.email} />
    );
  }

  return (
    <AuthShell>
      <div className="space-y-8">
        {intro}
        {body}
      </div>
    </AuthShell>
  );
}
