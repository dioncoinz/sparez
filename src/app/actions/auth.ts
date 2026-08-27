"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSparezAuthCookie } from "@/lib/supabase/cookies";

export async function login(formData: FormData) {
  const cookieStore = await cookies();
  cookieStore.getAll().filter(({ name }) => isSparezAuthCookie(name)).forEach(({ name }) => {
    cookieStore.set(name, "", { path: "/", maxAge: 0 });
  });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(formData.get("email") || ""), password: String(formData.get("password") || "") });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  const { data: membership, error: membershipError } = await supabase.from("memberships").select("id").eq("user_id", data.user.id).eq("is_active", true).limit(1).maybeSingle();
  if (membershipError || !membership) {
    await supabase.auth.signOut();
    const message = membershipError ? "Unable to verify organisation access. Please try again." : "Your account is valid but does not have active organisation access. Ask an administrator to add you in Sparez.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard");
}
export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login"); }

export async function setPassword(_previous: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("password_confirmation") || "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirmation) return { error: "The passwords do not match." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=That invitation link has expired. Ask an administrator for a new invitation.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
