import type { Metadata } from "next";
import Link from "next/link";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { findValidResetToken } from "@/lib/password-reset";
import { resetTokenSchema } from "@/lib/validations/auth";

export const metadata: Metadata = {
  title: "Nueva contraseña · TaskQuest",
  // Links carry a secret token.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;
  const parsed = resetTokenSchema.safeParse(token);
  const valid = parsed.success && (await findValidResetToken(parsed.data));

  if (!valid) {
    return (
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance text-slate-50">Este enlace ya no funciona</h1>
          <p className="text-sm text-pretty text-slate-400">
            Los enlaces para restablecer la contraseña vencen en una hora y solo se pueden usar una vez. Si pediste
            varios, solo sirve el más reciente.
          </p>
        </header>
        <Link
          href="/auth/recuperar"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={parsed.data} />;
}
