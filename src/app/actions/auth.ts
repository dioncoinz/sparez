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
  const { error } = await supabase.auth.signInWithPassword({ email: String(formData.get("email") || ""), password: String(formData.get("password") || "") });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login"); }
