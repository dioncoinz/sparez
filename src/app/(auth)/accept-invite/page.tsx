"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function acceptInvitation() {
    setPending(true);
    setError(undefined);
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (!tokenHash) {
      setError("This invitation is missing its security token. Ask an administrator for a new invitation.");
      setPending(false);
      return;
    }
    if (type !== "invite" && type !== "recovery") {
      setError("This invitation has an unsupported security token. Ask an administrator for a new invitation.");
      setPending(false);
      return;
    }

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (verifyError) {
      setError(verifyError.message);
      setPending(false);
      return;
    }

    router.replace("/set-password");
    router.refresh();
  }

  return <main className="flex min-h-screen items-center bg-canvas px-5 py-10 sm:px-10">
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-8 [&_span]:!text-ink"><Logo /></div>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-forest-600">You’ve been invited</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Join Sparez</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Confirm that you want to accept this invitation. You’ll create your password on the next screen.</p>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button type="button" onClick={acceptInvitation} disabled={pending} className="btn-primary mt-8 w-full"><UserCheck className="h-4 w-4" />{pending ? "Accepting…" : "Accept invitation"}</button>
    </section>
  </main>;
}
