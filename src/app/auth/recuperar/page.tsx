import type { Metadata } from "next";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña · TaskQuest",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
