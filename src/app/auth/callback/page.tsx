"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/set-password";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    async function completeInvitation() {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const callbackError = query.get("error_description") || fragment.get("error_description");
      if (callbackError) {
        if (active) setError(callbackError);
        return;
      }

      const supabase = createClient();
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const type = query.get("type");

      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        if (verifyError) {
          if (active) setError(verifyError.message);
          return;
        }
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }

      // For the default invite template Supabase returns tokens in the URL
      // fragment. createBrowserClient consumes those tokens and persists the
      // session in cookies during initialization.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        if (active) setError(sessionError?.message || "The invitation link is invalid or has expired.");
        return;
      }

      router.replace(safeNextPath(query.get("next")));
      router.refresh();
    }

    completeInvitation();
    return () => { active = false; };
  }, [router]);

  return <main className="flex min-h-screen items-center bg-canvas px-5 py-10 sm:px-10">
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="mb-8 flex justify-center [&_span]:!text-ink"><Logo /></div>
      {error ? <>
        <h1 className="text-2xl font-bold tracking-tight">Unable to accept invitation</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error}</p>
        <Link href="/login" className="btn-secondary mt-6 w-full">Return to sign in</Link>
      </> : <>
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-forest-700" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Accepting your invitation</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Please wait while we securely set up your account.</p>
      </>}
    </section>
  </main>;
}
