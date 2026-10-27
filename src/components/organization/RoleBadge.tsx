import { Crown, Shield, User } from "lucide-react";

import type { OrgRole } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/organizations/permissions";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<OrgRole, { icon: typeof Crown; className: string }> = {
  OWNER: { icon: Crown, className: "border-yellow-300/30 bg-yellow-300/10 text-yellow-200" },
  ADMIN: { icon: Shield, className: "border-violet-400/30 bg-violet-500/10 text-violet-200" },
  MEMBER: { icon: User, className: "border-slate-700 bg-slate-800/60 text-slate-300" },
};

export default function RoleBadge({ role, className }: { role: OrgRole; className?: string }) {
  const { icon: Icon, className: roleClass } = ROLE_STYLES[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        roleClass,
        className,
      )}
    >
      <Icon size={12} aria-hidden />
      {ROLE_LABELS[role]}
    </span>
  );
}
