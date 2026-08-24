"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Gauge, Plus, Settings, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = { dashboard: Gauge, parts: Boxes, add: Plus, export: Upload, users: Users, settings: Settings };
export type NavIcon = keyof typeof icons;

export function NavLinks({ items, variant }: { items: { href: string; label: string; icon: NavIcon }[]; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  if (variant === "mobile") return <>{items.map(({ href, label, icon }) => { const Icon = icons[icon]; const active = href === "/parts" ? pathname === href : pathname.startsWith(href); const add = href === "/parts/new"; return <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold", active ? "text-forest-700" : "text-slate-500", add && "mx-auto -mt-6 h-16 w-20 bg-forest-800 text-white shadow-lg") }><Icon className="h-5 w-5"/><span>{label}</span></Link>; })}</>;
  return <div className="mt-9 space-y-1">{items.map(({ href, label, icon }) => { const Icon = icons[icon]; const active = href === "/parts" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white")}><Icon className="h-[18px] w-[18px]" />{label}</Link>; })}</div>;
}
