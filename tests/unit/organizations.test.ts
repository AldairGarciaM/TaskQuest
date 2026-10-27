import { describe, expect, it } from "vitest";

import {
  canChangeRole,
  canDeleteOrganization,
  canInvite,
  canLeave,
  canManageTasks,
  canRemoveMember,
  invitableRoles,
} from "@/lib/organizations/permissions";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  organizationSlug,
  slugify,
} from "@/lib/organizations/tokens";
import { invitationTokenSchema, inviteMemberSchema } from "@/lib/validations/organization";

describe("permissions", () => {
  it("lets owners invite admins and members, admins only members, members nobody", () => {
    expect(invitableRoles("OWNER")).toEqual(["ADMIN", "MEMBER"]);
    expect(invitableRoles("ADMIN")).toEqual(["MEMBER"]);
    expect(invitableRoles("MEMBER")).toEqual([]);
    expect(canInvite("OWNER", "OWNER")).toBe(false);
  });

  it("never lets anyone remove the owner", () => {
    expect(canRemoveMember("OWNER", "OWNER")).toBe(false);
    expect(canRemoveMember("OWNER", "ADMIN")).toBe(true);
    expect(canRemoveMember("ADMIN", "MEMBER")).toBe(true);
    expect(canRemoveMember("ADMIN", "ADMIN")).toBe(false);
    expect(canRemoveMember("MEMBER", "MEMBER")).toBe(false);
  });

  it("only lets the owner change roles between admin and member", () => {
    expect(canChangeRole("OWNER", "MEMBER", "ADMIN")).toBe(true);
    expect(canChangeRole("OWNER", "ADMIN", "MEMBER")).toBe(true);
    expect(canChangeRole("OWNER", "MEMBER", "OWNER")).toBe(false);
    expect(canChangeRole("OWNER", "MEMBER", "MEMBER")).toBe(false);
    expect(canChangeRole("ADMIN", "MEMBER", "ADMIN")).toBe(false);
  });

  it("lets owners and admins manage board tasks", () => {
    expect(canManageTasks("OWNER")).toBe(true);
    expect(canManageTasks("ADMIN")).toBe(true);
    expect(canManageTasks("MEMBER")).toBe(false);
  });

  it("keeps the owner in until the organization is deleted", () => {
    expect(canLeave("OWNER")).toBe(false);
    expect(canLeave("MEMBER")).toBe(true);
    expect(canDeleteOrganization("OWNER")).toBe(true);
    expect(canDeleteOrganization("ADMIN")).toBe(false);
  });
});

describe("tokens and slugs", () => {
  it("creates tokens the link schema accepts and hashes them deterministically", () => {
    const token = createInvitationToken();
    expect(invitationTokenSchema.safeParse(token).success).toBe(true);
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).not.toContain(token);
    expect(createInvitationToken()).not.toBe(token);
  });

  it("rejects malformed tokens", () => {
    expect(invitationTokenSchema.safeParse("short").success).toBe(false);
    expect(invitationTokenSchema.safeParse(`${"a".repeat(42)}/`).success).toBe(false);
  });

  it("expires invitations after 7 days", () => {
    const from = new Date("2026-10-27T12:00:00Z");
    expect(invitationExpiry(from).toISOString()).toBe("2026-11-03T12:00:00.000Z");
  });

  it("slugifies names without accents or symbols", () => {
    expect(slugify("  Diseño & Producción ")).toBe("diseno-produccion");
    expect(slugify("¡¡!!")).toBe("equipo");
    expect(slugify("a".repeat(60))).toHaveLength(40);
    expect(organizationSlug("Equipo Ñandú")).toMatch(/^equipo-nandu-[0-9a-f]{6}$/);
  });
});

describe("inviteMemberSchema", () => {
  it("normalizes the email and refuses the owner role", () => {
    expect(inviteMemberSchema.parse({ email: " Ana@Correo.COM ", role: "ADMIN" })).toEqual({
      email: "ana@correo.com",
      role: "ADMIN",
    });
    expect(inviteMemberSchema.safeParse({ email: "ana@correo.com", role: "OWNER" }).success).toBe(false);
  });
});
