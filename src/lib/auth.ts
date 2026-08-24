import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";

export const getSessionContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) return null;
  if (authError) throw new Error(`Unable to verify your session: ${authError.message}`);
  const { data: membership, error: membershipError } = await supabase.from("memberships").select("id, organisation_id, user_id, role, is_active, organisation:organisations(id,name,slug), profile:profiles!memberships_user_id_fkey(id,full_name,email)").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (membershipError) throw new Error(`Unable to load your organisation access: ${membershipError.message}`);
  return membership ? { user, membership: membership as unknown as Membership } : null;
});

export async function requireSession() { const ctx = await getSessionContext(); if (!ctx) redirect("/login"); return ctx; }
export async function requireAdmin() { const ctx = await requireSession(); if (ctx.membership.role !== "admin") redirect("/dashboard"); return ctx; }
