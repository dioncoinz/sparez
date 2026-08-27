import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SetPasswordForm } from "@/components/set-password-form";
import { createClient } from "@/lib/supabase/server";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=That invitation link has expired. Ask an administrator for a new invitation.");
  return <main className="flex min-h-screen items-center bg-canvas px-5 py-10 sm:px-10">
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-8 [&_span]:!text-ink"><Logo /></div>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-forest-600">Invitation accepted</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Create your password</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Set a password for {user.email} to finish joining Sparez.</p>
      <SetPasswordForm />
    </section>
  </main>;
}
