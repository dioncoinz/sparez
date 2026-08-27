"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { setPassword } from "@/app/actions/auth";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, {});
  return <form action={action} className="mt-8 space-y-5">
    <div><label className="label" htmlFor="password">Create password</label><input className="field" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
    <div><label className="label" htmlFor="password_confirmation">Confirm password</label><input className="field" id="password_confirmation" name="password_confirmation" type="password" minLength={8} autoComplete="new-password" required /></div>
    {state.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
    <button disabled={pending} className="btn-primary w-full"><KeyRound className="h-4 w-4" />{pending ? "Saving…" : "Set password and continue"}</button>
  </form>;
}
