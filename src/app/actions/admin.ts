"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "./items";

async function invitationOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured && (process.env.NODE_ENV !== "production" || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured))) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;
  const referer = requestHeaders.get("referer");
  if (referer) return new URL(referer).origin;
  return configured || "http://localhost:3000";
}

export async function inviteUser(_prev:ActionState,formData:FormData):Promise<ActionState>{const{membership}=await requireAdmin();const email=String(formData.get("email")||"").trim().toLowerCase();const role=String(formData.get("role"))==="admin"?"admin":"user";if(!/^\S+@\S+\.\S+$/.test(email))return{error:"Enter a valid email address."};try{const admin=createAdminClient();const redirectTo=`${await invitationOrigin()}/auth/callback?next=${encodeURIComponent("/set-password")}`;let userId:string|undefined;const{data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{invited_to_organisation:membership.organisation_id}});if(error){if(!error.message.toLowerCase().includes("already"))return{error:error.message};const{data:list}=await admin.auth.admin.listUsers({page:1,perPage:1000});userId=list.users.find(u=>u.email?.toLowerCase()===email)?.id;}else userId=data.user.id;if(!userId)return{error:"This account exists but could not be linked automatically. Contact support."};await admin.from("profiles").upsert({id:userId,email},{onConflict:"id"});const{error:memberError}=await admin.from("memberships").upsert({organisation_id:membership.organisation_id,user_id:userId,role,is_active:true,invited_by:membership.user_id},{onConflict:"organisation_id,user_id"});if(memberError)return{error:memberError.message};revalidatePath("/users");return{ok:true};}catch(e){return{error:e instanceof Error?e.message:"Unable to send invitation."}}}
export async function setMemberAccess(userId:string,_prev:ActionState,formData:FormData):Promise<ActionState>{const{membership}=await requireAdmin();if(userId===membership.user_id)return{error:"You cannot change your own access here."};const role=String(formData.get("role"))==="admin"?"admin":"user";const active=formData.get("is_active")==="on";const supabase=await createClient();const{error}=await supabase.from("memberships").update({role,is_active:active}).eq("organisation_id",membership.organisation_id).eq("user_id",userId);if(error)return{error:error.message};revalidatePath("/users");return{ok:true}}
export async function removeMember(userId:string,_prev:ActionState):Promise<ActionState>{void _prev;const{membership}=await requireAdmin();if(userId===membership.user_id)return{error:"You cannot remove yourself from the organisation."};const admin=createAdminClient();const{error}=await admin.from("memberships").delete().eq("organisation_id",membership.organisation_id).eq("user_id",userId);if(error)return{error:error.message};revalidatePath("/users");return{ok:true}}
export async function updateOrganisation(_prev:ActionState,formData:FormData):Promise<ActionState>{const{membership}=await requireAdmin();const name=String(formData.get("name")||"").trim();if(!name||name.length>120)return{error:"Organisation name must be between 1 and 120 characters."};const supabase=await createClient();const{error}=await supabase.from("organisations").update({name}).eq("id",membership.organisation_id);if(error)return{error:error.message};revalidatePath("/settings");revalidatePath("/dashboard");return{ok:true}}
