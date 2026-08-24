import Link from "next/link";
import { AlertTriangle, ArrowRight, Box, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-forest-600">{eyebrow}</p>}<h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}</div>{action}
  </div>;
}
export function StatusPill({ removed }: { removed: boolean }) { return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", removed ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700")}>{removed ? "Fully Used / Removed" : "Available"}</span>; }
export function ConditionPill({ condition }: { condition: string }) { const inspect = condition === "Requires Inspection"; return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", inspect ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600")}>{inspect && <AlertTriangle className="mr-1 h-3.5 w-3.5" />}{condition}</span>; }
export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) { return <div className="card px-6 py-14 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-700"><Box className="h-6 w-6" /></div><h2 className="font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>{href && action && <Link href={href} className="btn-primary mt-6">{action}<ArrowRight className="h-4 w-4" /></Link>}</div>; }
export function PhotoPlaceholder({ className }: { className?: string }) { return <div className={cn("grid place-items-center bg-slate-100 text-slate-400", className)}><ImageIcon className="h-6 w-6" /></div>; }
export function SubmitButton({ children, pending, className }: { children: React.ReactNode; pending?: boolean; className?: string }) { return <button type="submit" disabled={pending} className={cn("btn-primary", className)}>{pending ? "Please wait…" : children}</button>; }
