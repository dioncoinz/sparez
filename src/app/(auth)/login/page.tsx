import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSessionContext } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { LogIn, ShieldCheck } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  if (await getSessionContext()) redirect("/dashboard");
  const query = await searchParams;
  return <div className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="hidden flex-col justify-between overflow-hidden p-12 lg:flex"><Logo/><div className="max-w-2xl"><p className="mb-5 text-xs font-bold uppercase tracking-[.2em] text-safety-400">Industrial parts, made findable</p><h1 className="text-5xl font-black leading-[1.06] tracking-tight text-white xl:text-6xl">Turn a laydown yard into a searchable register.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-white/60">Photograph, catalogue, locate and reuse spare parts—right from the field.</p></div><div className="flex items-center gap-3 text-sm text-white/40"><ShieldCheck className="h-5 w-5 text-safety-400"/>Secure organisation workspaces · Auditable stock movements</div></section>
    <section className="flex min-h-screen items-center bg-canvas px-5 py-10 sm:px-10"><div className="mx-auto w-full max-w-md"><div className="mb-10 lg:hidden"><span className="[&_span]:!text-ink"><Logo /></span></div><p className="text-xs font-bold uppercase tracking-[.16em] text-forest-600">Welcome back</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Sign in to Sparez</h2><p className="mt-3 text-sm leading-6 text-slate-500">Access is by invitation from your organisation administrator.</p>
      {query.error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</div>}{query.message && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.message}</div>}
      <form action={login} className="mt-8 space-y-5"><div><label className="label" htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" /></div><div><label className="label" htmlFor="password">Password</label><input className="field" id="password" name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></div><button className="btn-primary w-full"><LogIn className="h-4 w-4"/>Sign in</button></form>
      <p className="mt-8 text-center text-xs leading-5 text-slate-400">Need access? Ask your organisation administrator to invite you.</p>
    </div></section>
  </div>;
}
