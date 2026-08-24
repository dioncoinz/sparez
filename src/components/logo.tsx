import Link from "next/link";
import { Layers3 } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/dashboard" className="flex items-center gap-3" aria-label="Sparez home"><span className="grid h-9 w-9 place-items-center rounded-xl bg-safety-400 text-forest-900"><Layers3 className="h-5 w-5" strokeWidth={2.5} /></span>{!compact && <span><span className="block text-lg font-black tracking-tight text-white">sparez</span><span className="block text-[9px] font-bold uppercase tracking-[.2em] text-white/50">by Valeron</span></span>}</Link>;
}
