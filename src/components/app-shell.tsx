import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { NavLinks, type NavIcon } from "./nav-links";
import { signOut } from "@/app/actions/auth";
import type { Membership } from "@/lib/types";
import { initials } from "@/lib/utils";

const nav: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/parts", label: "Parts", icon: "parts" },
  { href: "/parts/new", label: "Add Part", icon: "add" },
];
const adminNav: { href: string; label: string; icon: NavIcon }[] = [{ href: "/export", label: "Export", icon: "export" }, { href: "/users", label: "Users", icon: "users" }, { href: "/settings", label: "Settings", icon: "settings" }];

export function AppShell({ membership, children }: { membership: Membership; children: React.ReactNode }) {
  const items = membership.role === "admin" ? [...nav, ...adminNav] : nav;
  const name = membership.profile?.full_name || membership.profile?.email || "Sparez user";
  return <div className="min-h-screen bg-canvas pb-32 lg:pb-0">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-forest-900 px-4 py-5 lg:flex">
      <div className="px-2"><Logo /></div><NavLinks items={items} variant="desktop" />
      <div className="mt-auto border-t border-white/10 pt-4"><div className="flex items-center gap-3 px-2 py-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">{initials(name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{name}</p><p className="truncate text-xs capitalize text-white/50">{membership.role} · {membership.organisation?.name}</p></div></div><form action={signOut}><button className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button></form></div>
    </aside>
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden"><Logo compact /><div className="text-center"><p className="text-sm font-bold text-ink">Sparez</p><p className="max-w-48 truncate text-[11px] text-slate-500">{membership.organisation?.name}</p></div><details className="group relative"><summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 text-slate-600 [&::-webkit-details-marker]:hidden"><Menu className="h-5 w-5 group-open:hidden"/><X className="hidden h-5 w-5 group-open:block"/></summary><div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><p className="truncate px-3 py-2 text-xs text-slate-500">{name}</p><form action={signOut}><button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" /> Sign out</button></form></div></details></header>
    <main className="lg:ml-64"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,.06)] lg:hidden">
      <NavLinks items={nav} variant="mobile" />
    </nav>
  </div>;
}
