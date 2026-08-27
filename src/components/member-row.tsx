"use client";

import { useActionState } from "react";
import { Check, Trash2 } from "lucide-react";
import { removeMember, setMemberAccess } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/items";
import type { Membership } from "@/lib/types";
import { initials } from "@/lib/utils";

export function MemberRow({ member, isSelf }: { member: Membership; isSelf: boolean }) {
  const [accessState, accessAction, accessPending] = useActionState<ActionState, FormData>(setMemberAccess.bind(null, member.user_id), {});
  const [removeState, removeAction, removePending] = useActionState<ActionState, FormData>(removeMember.bind(null, member.user_id), {});
  const name = member.profile?.full_name || member.profile?.email || "Invited user";

  return <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-50 text-xs font-bold text-forest-700">{initials(name)}</span>
      <div className="min-w-0"><p className="truncate text-sm font-bold">{name}{isSelf && <span className="ml-2 text-xs font-medium text-slate-400">You</span>}</p><p className="truncate text-xs text-slate-500">{member.profile?.email || "Invitation pending"}</p></div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <form action={accessAction} className="flex items-center gap-2">
        <select name="role" defaultValue={member.role} disabled={isSelf} className="field min-h-10 w-28 px-3 text-sm"><option value="user">User</option><option value="admin">Admin</option></select>
        <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"><input type="checkbox" name="is_active" defaultChecked={member.is_active} disabled={isSelf} className="h-4 w-4 accent-forest-700" />Active</label>
        <button disabled={accessPending || isSelf} className="grid h-10 w-10 place-items-center rounded-xl bg-forest-800 text-white disabled:opacity-30" aria-label="Save access"><Check className="h-4 w-4" /></button>
      </form>
      {!isSelf && <form action={removeAction} onSubmit={(event) => { if (!window.confirm(`Remove ${name} from this organisation?`)) event.preventDefault(); }}>
        <button disabled={removePending} className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50" aria-label={`Remove ${name}`} title="Remove user"><Trash2 className="h-4 w-4" /></button>
      </form>}
    </div>
    {(accessState.error || removeState.error) && <p className="text-xs text-red-600">{accessState.error || removeState.error}</p>}
  </div>;
}
