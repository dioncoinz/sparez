import { InviteForm } from "@/components/invite-form";
import { MemberRow } from "@/components/member-row";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";
export const metadata={title:"Users"};
export default async function UsersPage(){const{membership}=await requireAdmin();const supabase=await createClient();const{data}=await supabase.from("memberships").select("*,profile:profiles!memberships_user_id_fkey(id,full_name,email)").eq("organisation_id",membership.organisation_id).order("created_at");const members=(data||[]) as unknown as Membership[];return <><PageHeader eyebrow="Admin" title="Users" description="Invite people and control access to this organisation."/><InviteForm/><section className="card mt-6 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">Organisation access</h2><p className="mt-1 text-xs text-slate-500">{members.filter(m=>m.is_active).length} active member{members.filter(m=>m.is_active).length===1?"":"s"}</p></div><div className="divide-y divide-slate-100">{members.map(m=><MemberRow key={m.id} member={m} isSelf={m.user_id===membership.user_id}/>)}</div></section></>}
