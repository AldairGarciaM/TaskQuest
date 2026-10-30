import { beforeEach, describe, expect, it, vi } from "vitest";

import { acceptInvitation, acceptInvitationWithSignup } from "@/app/actions/invitations";
import {
  changeMemberRole,
  createOrganization,
  deleteOrganization,
  disableJoinCode,
  inviteMember,
  joinOrganizationByCode,
  leaveOrganization,
  regenerateJoinCode,
  removeMember,
  revokeInvitation,
} from "@/app/actions/organizations";
import type { OrgRole } from "@/generated/prisma/enums";
import { MAX_OWNED_ORGANIZATIONS } from "@/lib/organizations/permissions";
import { getOrganizationForMember } from "@/lib/data/organizations";
import { INVITE_USER_LIMIT, JOIN_CODE_USER_LIMIT } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

import { createSignedInUser, createUser, signInAs, signOut } from "./helpers";

beforeEach(() => {
  // Without SMTP the invitation link is logged; keep the test output clean.
  vi.spyOn(console, "info").mockImplementation(() => {});
});

type TestUser = Awaited<ReturnType<typeof createUser>>;

async function newOrganization(name = "Equipo Alfa") {
  const result = await createOrganization({ name });
  if (!result.ok) throw new Error("createOrganization failed");
  return prisma.organization.findUniqueOrThrow({ where: { slug: result.slug } });
}

async function addMember(organizationId: string, user: TestUser, role: OrgRole) {
  await prisma.membership.create({ data: { organizationId, userId: user.id, role } });
}

const roleOf = (organizationId: string, userId: string) =>
  prisma.membership
    .findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { role: true } })
    .then((m) => m?.role ?? null);

/** Invites as the signed-in user and returns the link token. */
async function invite(organizationId: string, email: string, role: "ADMIN" | "MEMBER" = "MEMBER") {
  const result = await inviteMember(organizationId, { email, role });
  if (!result.ok) throw new Error(`inviteMember failed: ${JSON.stringify(result)}`);
  return result.url.split("/invitaciones/")[1];
}

describe("createOrganization", () => {
  it("creates the organization with the creator as owner", async () => {
    const owner = await createSignedInUser();
    const result = await createOrganization({ name: "  Diseño Ágil  " });

    expect(result.ok).toBe(true);
    const organization = await prisma.organization.findFirstOrThrow();
    expect(organization.name).toBe("Diseño Ágil");
    expect(organization.slug).toMatch(/^diseno-agil-[0-9a-f]{6}$/);
    expect(await roleOf(organization.id, owner.id)).toBe("OWNER");
  });

  it("validates the name", async () => {
    await createSignedInUser();
    const result = await createOrganization({ name: "x" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(Array) } });
  });

  it("caps how many organizations one person owns", async () => {
    const owner = await createSignedInUser();
    for (let i = 0; i < MAX_OWNED_ORGANIZATIONS; i++) {
      const organization = await prisma.organization.create({ data: { name: `O${i}`, slug: `o-${i}` } });
      await addMember(organization.id, owner, "OWNER");
    }
    expect((await createOrganization({ name: "Una más" })).ok).toBe(false);
  });

  it("requires a session", async () => {
    await expect(createOrganization({ name: "Equipo" })).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("inviteMember", () => {
  it("stores only the token hash and returns a working link", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const result = await inviteMember(organization.id, { email: "Nueva@Correo.com", role: "MEMBER" });

    expect(result).toMatchObject({ ok: true, emailed: false });
    const token = result.ok ? result.url.split("/invitaciones/")[1] : "";
    const stored = await prisma.invitation.findFirstOrThrow();
    expect(stored.email).toBe("nueva@correo.com");
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);
  });

  it("replaces a pending invitation for the same email", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const first = await invite(organization.id, "ana@correo.com");
    await invite(organization.id, "ana@correo.com");

    expect(await prisma.invitation.count()).toBe(1);
    signInAs(await createUser({ email: "ana@correo.com" }));
    expect((await acceptInvitation(first)).ok).toBe(false);
  });

  it("refuses to invite someone who is already a member", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const member = await createUser({ email: "ya@correo.com" });
    await addMember(organization.id, member, "MEMBER");

    const result = await inviteMember(organization.id, { email: "ya@correo.com", role: "MEMBER" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(Array) } });
  });

  it("lets admins invite members but not admins, and members invite nobody", async () => {
    const owner = await createSignedInUser();
    const organization = await newOrganization();
    const admin = await createUser();
    const member = await createUser();
    await addMember(organization.id, admin, "ADMIN");
    await addMember(organization.id, member, "MEMBER");

    signInAs(admin);
    expect((await inviteMember(organization.id, { email: "a@correo.com", role: "MEMBER" })).ok).toBe(true);
    expect((await inviteMember(organization.id, { email: "b@correo.com", role: "ADMIN" })).ok).toBe(false);

    signInAs(member);
    expect((await inviteMember(organization.id, { email: "c@correo.com", role: "MEMBER" })).ok).toBe(false);

    signInAs(owner);
    expect((await inviteMember(organization.id, { email: "d@correo.com", role: "ADMIN" })).ok).toBe(true);
    expect(await prisma.invitation.count()).toBe(2);
  });

  it("refuses outsiders and the owner role", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    expect((await inviteMember(organization.id, { email: "a@correo.com", role: "OWNER" })).ok).toBe(false);

    signInAs(await createUser());
    expect(await inviteMember(organization.id, { email: "a@correo.com", role: "MEMBER" })).toMatchObject({
      ok: false,
      error: "No encontramos esa organización.",
    });
  });

  it("caps how many invitations one person sends per hour, across organizations", async () => {
    await createSignedInUser();
    const alfa = await newOrganization("Alfa");
    const beta = await newOrganization("Beta");
    for (let i = 0; i < INVITE_USER_LIMIT.limit; i++) {
      await invite(i % 2 ? alfa.id : beta.id, `persona${i}@correo.com`);
    }

    const blocked = await inviteMember(alfa.id, { email: "una-mas@correo.com", role: "MEMBER" });
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.error).toMatch(/límite de 20 invitaciones por hora.*\d+ min/);
    expect(await prisma.invitation.count()).toBe(INVITE_USER_LIMIT.limit);

    // Someone else in the same organization has their own allowance.
    const admin = await createUser();
    await addMember(alfa.id, admin, "ADMIN");
    signInAs(admin);
    expect((await inviteMember(alfa.id, { email: "una-mas@correo.com", role: "MEMBER" })).ok).toBe(true);
  });

  it("doesn't count invitations refused before sending", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    await inviteMember(organization.id, { email: "a@correo.com", role: "OWNER" });
    await inviteMember(organization.id, { email: "no-es-correo", role: "MEMBER" });
    expect(await prisma.rateLimit.count()).toBe(0);
  });
});

describe("revokeInvitation", () => {
  it("deletes a pending invitation so its link stops working", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");
    const { id } = await prisma.invitation.findFirstOrThrow();

    expect((await revokeInvitation(id)).ok).toBe(true);
    signInAs(await createUser({ email: "ana@correo.com" }));
    expect((await acceptInvitation(token)).ok).toBe(false);
  });

  it("doesn't let an admin revoke an admin invitation", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    await invite(organization.id, "jefa@correo.com", "ADMIN");
    const { id } = await prisma.invitation.findFirstOrThrow();
    const admin = await createUser();
    await addMember(organization.id, admin, "ADMIN");

    signInAs(admin);
    expect((await revokeInvitation(id)).ok).toBe(false);
    expect(await prisma.invitation.count()).toBe(1);
  });
});

describe("acceptInvitation", () => {
  it("joins with the invited role and can't be reused", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com", "ADMIN");

    const ana = await createUser({ email: "ana@correo.com" });
    signInAs(ana);
    expect(await acceptInvitation(token)).toEqual({ ok: true, slug: organization.slug });
    expect(await roleOf(organization.id, ana.id)).toBe("ADMIN");
    expect((await prisma.invitation.findFirstOrThrow()).acceptedAt).not.toBeNull();

    expect((await acceptInvitation(token)).ok).toBe(false);
  });

  it("rejects an account with a different email", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");

    const other = await createUser();
    // Even if the session claimed the invited email, the database email is what counts.
    signInAs({ ...other, email: "ana@correo.com" });
    expect(await acceptInvitation(token)).toMatchObject({ ok: false });
    expect(await roleOf(organization.id, other.id)).toBeNull();
  });

  it("rejects expired invitations", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");
    await prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    signInAs(await createUser({ email: "ana@correo.com" }));
    expect((await acceptInvitation(token)).ok).toBe(false);
  });

  it("lets only one of two parallel accepts through", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");

    signInAs(await createUser({ email: "ana@correo.com" }));
    const results = await Promise.all([acceptInvitation(token), acceptInvitation(token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.membership.count({ where: { organizationId: organization.id } })).toBe(2);
  });

  it("rejects garbage tokens", async () => {
    await createSignedInUser();
    expect((await acceptInvitation("../../etc/passwd")).ok).toBe(false);
  });
});

describe("acceptInvitationWithSignup", () => {
  const profile = { firstName: "Ana", lastName: "Torres", username: "ana.t", password: "Secreta123" };

  it("creates the account with the invited email and joins without a session", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");
    signOut();

    const result = await acceptInvitationWithSignup(token, { ...profile, email: "otro@correo.com" });
    expect(result).toEqual({ ok: true, email: "ana@correo.com", slug: organization.slug });

    const ana = await prisma.user.findUniqueOrThrow({ where: { email: "ana@correo.com" } });
    expect(ana.username).toBe("ana.t");
    expect(ana.passwordHash).not.toBe(profile.password);
    expect(await roleOf(organization.id, ana.id)).toBe("MEMBER");
    expect((await acceptInvitationWithSignup(token, { ...profile, username: "ana.2" })).ok).toBe(false);
  });

  it("asks existing accounts to sign in instead", async () => {
    await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");
    await createUser({ email: "ana@correo.com" });
    signOut();

    expect(await acceptInvitationWithSignup(token, profile)).toMatchObject({ ok: false, error: expect.any(String) });
    expect((await prisma.invitation.findFirstOrThrow()).acceptedAt).toBeNull();
  });

  it("reports a taken username on the field", async () => {
    const owner = await createSignedInUser();
    const organization = await newOrganization();
    const token = await invite(organization.id, "ana@correo.com");
    signOut();

    const result = await acceptInvitationWithSignup(token, { ...profile, username: owner.username });
    expect(result).toMatchObject({ ok: false, fieldErrors: { username: expect.any(Array) } });
  });
});

describe("member management", () => {
  async function setup() {
    const owner = await createSignedInUser();
    const organization = await newOrganization();
    const admin = await createUser();
    const member = await createUser();
    await addMember(organization.id, admin, "ADMIN");
    await addMember(organization.id, member, "MEMBER");
    return { owner, admin, member, organization };
  }

  it("lets the owner promote and demote, and nobody else", async () => {
    const { admin, member, organization } = await setup();

    expect((await changeMemberRole(organization.id, member.id, "ADMIN")).ok).toBe(true);
    expect(await roleOf(organization.id, member.id)).toBe("ADMIN");
    expect((await changeMemberRole(organization.id, member.id, "OWNER")).ok).toBe(false);

    signInAs(admin);
    expect((await changeMemberRole(organization.id, member.id, "MEMBER")).ok).toBe(false);
    expect(await roleOf(organization.id, member.id)).toBe("ADMIN");
  });

  it("follows the removal rules", async () => {
    const { owner, admin, member, organization } = await setup();

    signInAs(member);
    expect((await removeMember(organization.id, admin.id)).ok).toBe(false);

    signInAs(admin);
    expect((await removeMember(organization.id, owner.id)).ok).toBe(false);
    expect((await removeMember(organization.id, member.id)).ok).toBe(true);
    expect(await roleOf(organization.id, member.id)).toBeNull();

    signInAs(owner);
    expect((await removeMember(organization.id, admin.id)).ok).toBe(true);
    expect((await removeMember(organization.id, owner.id)).ok).toBe(false);
  });

  it("lets members leave but not the owner", async () => {
    const { owner, member, organization } = await setup();

    signInAs(member);
    expect((await leaveOrganization(organization.id)).ok).toBe(true);
    expect(await roleOf(organization.id, member.id)).toBeNull();

    signInAs(owner);
    expect((await leaveOrganization(organization.id)).ok).toBe(false);
  });

  it("only the owner deletes, and personal XP survives", async () => {
    const { owner, admin, organization } = await setup();
    await prisma.user.update({ where: { id: admin.id }, data: { xp: 120 } });

    signInAs(admin);
    expect((await deleteOrganization(organization.id)).ok).toBe(false);

    signInAs(owner);
    expect((await deleteOrganization(organization.id)).ok).toBe(true);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).xp).toBe(120);
  });
});

describe("join codes", () => {
  async function withCode() {
    const owner = await createSignedInUser();
    const organization = await newOrganization();
    const result = await regenerateJoinCode(organization.id);
    if (!result.ok) throw new Error("regenerateJoinCode failed");
    return { owner, organization, code: result.code };
  }

  it("starts off, and owners and admins turn it on, replace it and turn it off", async () => {
    const owner = await createSignedInUser();
    const organization = await newOrganization();
    expect(organization.joinCode).toBeNull();

    const first = await regenerateJoinCode(organization.id);
    expect(first).toMatchObject({ ok: true, code: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/) });

    const admin = await createUser();
    await addMember(organization.id, admin, "ADMIN");
    signInAs(admin);
    const second = await regenerateJoinCode(organization.id);
    expect(second.ok && first.ok && second.code !== first.code).toBe(true);

    signInAs(owner);
    expect(await disableJoinCode(organization.id)).toEqual({ ok: true });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).joinCode).toBeNull();
  });

  it("refuses members and outsiders", async () => {
    const { organization } = await withCode();
    const member = await createUser();
    await addMember(organization.id, member, "MEMBER");

    signInAs(member);
    expect(await regenerateJoinCode(organization.id)).toEqual({ ok: false, error: "No tienes permiso para hacer eso." });
    expect(await disableJoinCode(organization.id)).toEqual({ ok: false, error: "No tienes permiso para hacer eso." });
    signInAs(await createUser());
    expect(await regenerateJoinCode(organization.id)).toEqual({ ok: false, error: "No encontramos esa organización." });
  });

  it("shows the code only to owners and admins", async () => {
    const { owner, organization, code } = await withCode();
    const member = await createUser();
    await addMember(organization.id, member, "MEMBER");

    expect((await getOrganizationForMember(organization.slug, owner.id))?.joinCode).toBe(code);
    expect((await getOrganizationForMember(organization.slug, member.id))?.joinCode).toBeNull();
  });

  it("joins as a member, typed in any case and without the hyphen", async () => {
    const { organization, code } = await withCode();
    const joiner = await createSignedInUser();

    const result = await joinOrganizationByCode({ code: code.replace("-", " ").toLowerCase() });
    expect(result).toEqual({ ok: true, slug: organization.slug, name: organization.name, alreadyMember: false });
    expect(await roleOf(organization.id, joiner.id)).toBe("MEMBER");
  });

  it("keeps the role of someone who is already in", async () => {
    const { owner, organization, code } = await withCode();
    signInAs(owner);

    expect(await joinOrganizationByCode({ code })).toMatchObject({ ok: true, alreadyMember: true });
    expect(await roleOf(organization.id, owner.id)).toBe("OWNER");
  });

  it("stops working once replaced or turned off", async () => {
    const { owner, organization, code } = await withCode();
    await regenerateJoinCode(organization.id);
    const joiner = await createSignedInUser();
    expect(await joinOrganizationByCode({ code })).toEqual({
      ok: false,
      fieldErrors: { code: ["No encontramos una organización con ese código"] },
    });

    signInAs(owner);
    const current = await regenerateJoinCode(organization.id);
    await disableJoinCode(organization.id);
    signInAs(joiner);
    expect((await joinOrganizationByCode({ code: current.ok ? current.code : "" })).ok).toBe(false);
    expect(await roleOf(organization.id, joiner.id)).toBeNull();
  });

  it("locks after too many wrong codes, even with the right one", async () => {
    const { code } = await withCode();
    await createSignedInUser();
    for (let i = 0; i < JOIN_CODE_USER_LIMIT.limit; i++) {
      expect(await joinOrganizationByCode({ code: "ZZZZ-ZZZZ" })).toMatchObject({ ok: false, fieldErrors: expect.anything() });
    }
    expect(await joinOrganizationByCode({ code })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Demasiados códigos incorrectos/),
    });
  });

  it("validates the code and requires a session", async () => {
    await createSignedInUser();
    expect(await joinOrganizationByCode({ code: "nope" })).toMatchObject({ ok: false, fieldErrors: { code: [expect.any(String)] } });
    signOut();
    await expect(joinOrganizationByCode({ code: "ABCD-2345" })).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
