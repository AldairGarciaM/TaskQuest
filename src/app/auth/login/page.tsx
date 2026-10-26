import type { Metadata } from "next";

import LoginForm from "@/components/auth/LoginForm";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Iniciar sesión · TaskQuest",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>;
}) {
  const { callbackUrl, registered } = await searchParams;

  return <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} registered={registered === "1"} />;
}
