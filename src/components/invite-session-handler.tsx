"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function InviteSessionHandler() {
  const router = useRouter();

  useEffect(() => {
    async function recoverInviteSession() {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const hasAuthResponse = Boolean(
        query.get("code") || query.get("token_hash") || query.get("error_description") ||
        fragment.get("access_token") || fragment.get("error_description")
      );
      if (!hasAuthResponse) return;

      const callbackError = query.get("error_description") || fragment.get("error_description");
      if (callbackError) {
        window.history.replaceState({}, "", `/login?error=${encodeURIComponent(callbackError)}`);
        router.refresh();
        return;
      }

      const supabase = createClient();
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const type = query.get("type");
      let authError: Error | null = null;

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        authError = error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        authError = error;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (authError || sessionError || !session) {
        const message = authError?.message || sessionError?.message || "The invitation link is invalid or has expired.";
        window.history.replaceState({}, "", `/login?error=${encodeURIComponent(message)}`);
        router.refresh();
        return;
      }

      router.replace("/set-password");
      router.refresh();
    }

    recoverInviteSession();
  }, [router]);

  return null;
}
