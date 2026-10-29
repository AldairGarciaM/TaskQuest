import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

/** SMTP is optional in development: without SMTP_HOST, emails are logged instead of sent. */
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

interface InvitationEmail {
  to: string;
  organizationName: string;
  inviterName: string;
  url: string;
}

/** Sends the invitation, or logs the link when SMTP isn't configured. Returns whether it was emailed. */
export async function sendInvitationEmail({ to, organizationName, inviterName, url }: InvitationEmail): Promise<boolean> {
  if (!isMailConfigured()) {
    console.info(`[mail] SMTP not configured. Invitation for ${to}: ${url}`);
    return false;
  }

  const subject = `${inviterName} te invitó a ${organizationName} en TaskQuest`;
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM ?? "TaskQuest <no-reply@taskquest.local>",
      to,
      subject,
      text: `${subject}.\n\nAcepta la invitación aquí (vence en 7 días):\n${url}\n`,
      html: `<p>${escapeHtml(subject)}.</p><p><a href="${escapeHtml(url)}">Aceptar invitación</a></p><p>El enlace vence en 7 días.</p>`,
    });
    return true;
  } catch (error) {
    console.error("sendInvitationEmail failed", error);
    return false;
  }
}

/** Sends the password reset link, or logs it when SMTP isn't configured. Returns whether it was emailed. */
export async function sendPasswordResetEmail({ to, url, ttlMinutes }: { to: string; url: string; ttlMinutes: number }): Promise<boolean> {
  if (!isMailConfigured()) {
    console.info(`[mail] SMTP not configured. Password reset for ${to}: ${url}`);
    return false;
  }

  const subject = "Restablece tu contraseña de TaskQuest";
  const ignore = "Si no lo pediste, ignora este correo: tu contraseña no cambiará.";
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM ?? "TaskQuest <no-reply@taskquest.local>",
      to,
      subject,
      text: `Elige una contraseña nueva aquí (vence en ${ttlMinutes} minutos):\n${url}\n\n${ignore}\n`,
      html: `<p><a href="${escapeHtml(url)}">Elegir una contraseña nueva</a></p><p>El enlace vence en ${ttlMinutes} minutos y solo funciona una vez.</p><p>${ignore}</p>`,
    });
    return true;
  } catch (error) {
    console.error("sendPasswordResetEmail failed", error);
    return false;
  }
}
