"use client";

import { UserMinus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changeMemberRole, removeMember } from "@/app/actions/organizations";
import type { OrgRole } from "@/generated/prisma/enums";
import type { MemberDTO } from "@/lib/data/organizations";
import { ASSIGNABLE_ROLES, canChangeRole, canRemoveMember, ROLE_LABELS } from "@/lib/organizations/permissions";

import ConfirmDialog from "./ConfirmDialog";
import RoleBadge from "./RoleBadge";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface MemberListProps {
  organizationId: string;
  myUserId: string;
  myRole: OrgRole;
  members: MemberDTO[];
}

export default function MemberList({ organizationId, myUserId, myRole, members }: MemberListProps) {
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<MemberDTO | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  function handleRoleChange(member: MemberDTO, role: OrgRole) {
    startTransition(async () => {
      const result = await changeMemberRole(organizationId, member.userId, role);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos cambiar el rol.");
        return;
      }
      toast.success(`${member.firstName} ahora es ${ROLE_LABELS[role]}`);
    });
  }

  function handleRemove() {
    const member = removeTarget;
    if (!member) return;
    startTransition(async () => {
      const result = await removeMember(organizationId, member.userId);
      setRemoveOpen(false);
      if (!result.ok) {
        toast.error(result.error ?? "No pudimos quitar a esa persona.");
        return;
      }
      toast(`${member.firstName} salió de la organización`);
    });
  }

  return (
    <>
      <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <AnimatePresence initial={false}>
          {members.map((member) => {
            const isMe = member.userId === myUserId;
            const editableRole = !isMe && ASSIGNABLE_ROLES.some((r) => canChangeRole(myRole, member.role, r));
            const removable = !isMe && canRemoveMember(myRole, member.role);

            return (
              <motion.li
                key={member.userId}
                layout={!reduceMotion}
                exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-sm font-semibold text-slate-200"
                >
                  {member.firstName[0]}
                  {member.lastName[0]}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">
                    {member.firstName} {member.lastName}
                    {isMe && <span className="ml-2 text-xs font-normal text-slate-500">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    @{member.username} · <span className="tabular-nums">Nivel {member.level}</span>
                  </p>
                </div>

                {editableRole ? (
                  <select
                    aria-label={`Rol de ${member.firstName}`}
                    value={member.role}
                    disabled={pending}
                    onChange={(event) => handleRoleChange(member, event.target.value as OrgRole)}
                    className="h-9 rounded-lg border border-slate-800 bg-slate-950/60 px-2 text-sm text-slate-200 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={member.role} />
                )}

                {removable && (
                  <button
                    type="button"
                    aria-label={`Quitar a ${member.firstName} ${member.lastName}`}
                    onClick={() => {
                      setRemoveTarget(member);
                      setRemoveOpen(true);
                    }}
                    className="grid size-9 place-items-center rounded-lg text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-rose-500/10 hover:text-rose-300 active:scale-[0.95]"
                  >
                    <UserMinus size={18} aria-hidden />
                  </button>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={removeOpen}
        title="¿Quitar de la organización?"
        description={
          <>
            {removeTarget?.firstName} {removeTarget?.lastName} perderá el acceso. Conserva su XP y su nivel.
          </>
        }
        confirmLabel="Quitar"
        pending={pending}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={handleRemove}
      />
    </>
  );
}
