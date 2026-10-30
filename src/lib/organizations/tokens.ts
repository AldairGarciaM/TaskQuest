import { createHash, randomBytes } from "node:crypto";

import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from "./join-code";

export const INVITATION_TTL_DAYS = 7;

/** Random token for an invitation link. Only its hash is stored. */
export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(from = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function invitationUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/invitaciones/${token}`;
}

/** Random join code (31^8 ≈ 8.5e11 combinations), stored without the separator. */
export function createJoinCode(): string {
  // 256 % 31 != 0, so reject the bytes that would bias the first letters.
  const limit = 256 - (256 % JOIN_CODE_ALPHABET.length);
  let code = "";
  while (code.length < JOIN_CODE_LENGTH) {
    for (const byte of randomBytes(JOIN_CODE_LENGTH)) {
      if (byte < limit && code.length < JOIN_CODE_LENGTH) code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
    }
  }
  return code;
}

/** Lowercase, accent-free, hyphenated slug base (max 40 chars) for an organization name. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base || "equipo";
}

/** Slug with a short random suffix so two teams with the same name don't collide. */
export function organizationSlug(name: string): string {
  return `${slugify(name)}-${randomBytes(3).toString("hex")}`;
}
