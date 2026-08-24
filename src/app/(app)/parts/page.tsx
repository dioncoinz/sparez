import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PartsRegister } from "@/components/parts-register";
import { requireSession } from "@/lib/auth";
import { signPhotos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

export const metadata = { title: "Parts Register" };
export default async function PartsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { membership } = await requireSession(); const { q = "" } = await searchParams; const supabase = await createClient();
  let query = supabase.from("items").select("*, item_photos(*)").eq("organisation_id", membership.organisation_id).eq("is_archived", false).order("created_at", { ascending: false }).limit(250);
  const safe = q.trim().replace(/[%_,().]/g, " ").slice(0, 100); if (safe) query = query.or(`wo_number.ilike.%${safe}%,material_number.ilike.%${safe}%,material_description.ilike.%${safe}%,location.ilike.%${safe}%`);
  const { data } = await query; const items = await signPhotos((data || []) as Item[]); items.forEach(i => i.item_photos?.sort((a,b)=>a.display_order-b.display_order));
  const { data: moves } = await supabase.from("item_movements").select("item_id,quantity_removed,movement_type,status").eq("organisation_id", membership.organisation_id).eq("status", "active");
  const removed: Record<string,number>={}; const manual=new Set<string>(); (moves||[]).forEach(m=>{ if(m.movement_type==="manual_removal") manual.add(m.item_id); else removed[m.item_id]=(removed[m.item_id]||0)+(m.quantity_removed||0); });
  return <><PageHeader eyebrow="Catalogue" title="Parts register" description={`${items.length}${q ? " matching" : " active"} part${items.length===1?"":"s"} in ${membership.organisation?.name}.`} action={<Link href="/parts/new" className="btn-primary w-full sm:w-auto"><Plus className="h-4 w-4"/>Add Part</Link>}/>
    <form className="mb-5 flex gap-2" action="/parts"><div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input name="q" defaultValue={q} className="field pl-12 pr-11" placeholder="Search number, description or location…" aria-label="Search parts"/>{q && <Link href="/parts" aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4"/></Link>}</div><button className="btn-secondary hidden sm:inline-flex">Search</button></form>
    <PartsRegister items={items} removed={removed} manualRemoved={manual}/>
  </>;
}
