import type { Metadata } from "next";

import LoginForm from "@/components/auth/LoginForm";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Iniciar sesión · TaskQuest",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string; restablecida?: string; expirada?: string }>;
}) {
  const { callbackUrl, registered, restablecida, expirada } = await searchParams;
  const notice =
    restablecida === "1"
      ? "Contraseña actualizada. Inicia sesión con la nueva."
      : expirada === "1"
        ? "Tu sesión se cerró porque la contraseña cambió. Inicia sesión de nuevo."
        : registered === "1"
          ? "Cuenta creada. Inicia sesión para empezar."
          : undefined;

  return <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} notice={notice} />;
}
