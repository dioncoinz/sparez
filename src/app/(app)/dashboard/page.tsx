import Link from "next/link";
import { ArrowRight, Boxes, MapPin, PackageCheck, Plus, Search, ShieldAlert } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { ItemImage } from "@/components/item-image";
import { requireSession } from "@/lib/auth";
import { signPhotos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { formatDate, formatDateTime, timeGreeting, titleForItem } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  const { membership } = await requireSession(); const supabase = await createClient();
  const { data } = await supabase.from("items").select("*, item_photos(*)").eq("organisation_id", membership.organisation_id).eq("is_archived", false).order("created_at", { ascending: false });
  const items = (data || []) as Item[];
  const recentResult=await supabase.rpc("search_items",{p_organisation_id:membership.organisation_id,p_page:1});
  const recent=await signPhotos(((recentResult.data?.items||[]) as Item[]).slice(0,6));
  const removals = await supabase.from("item_movements").select("item_id, quantity_removed, movement_type, status").eq("organisation_id", membership.organisation_id);
  const active = (removals.data || []).filter((m) => m.status === "active");
  const removedByItem = new Map<string, number>(); active.forEach((m) => removedByItem.set(m.item_id, (removedByItem.get(m.item_id) || 0) + (m.quantity_removed || 0)));
  const availableTotal = items.reduce((sum, item) => sum + (item.quantity === null ? 0 : Math.max(0, item.quantity - (removedByItem.get(item.id) || 0))), 0);
  const cards = [
    { label: "Total Parts", value: items.length, note: "Active catalogue records", icon: Boxes },
    { label: "Quantity Available", value: availableTotal, note: "Across quantified parts", icon: PackageCheck },
    { label: "Locations", value: new Set(items.map((i) => i.location?.trim().toLowerCase()).filter(Boolean)).size, note: "Unique laydown locations", icon: MapPin },
    { label: "Requires Inspection", value: items.filter((i) => i.condition === "Requires Inspection").length, note: "Awaiting condition review", icon: ShieldAlert },
  ];
  return <><PageHeader eyebrow="Overview" title={`Good ${timeGreeting()}`} description={`Here’s what’s happening across ${membership.organisation?.name}.`} action={<Link href="/parts/new" className="btn-primary w-full sm:w-auto"><Plus className="h-5 w-5"/>Add Part</Link>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(({ label, value, note, icon: Icon }) => <div className="card p-4 sm:p-5" key={label}><div className="flex items-start justify-between"><p className="text-xs font-semibold leading-5 text-slate-500 sm:text-sm">{label}</p><span className="hidden h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-700 sm:grid"><Icon className="h-4 w-4"/></span></div><p className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{value.toLocaleString()}</p><p className="mt-1 hidden text-xs text-slate-400 sm:block">{note}</p></div>)}</div>
    {recentResult.error&&<p role="alert" className="mt-5 text-sm text-red-700">Unable to load recent notes: {recentResult.error.message}</p>}<section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-bold">Recently added</h2><p className="mt-1 text-sm text-slate-500">Latest parts catalogued by your team</p></div><Link href="/parts" className="hidden items-center gap-1 text-sm font-bold text-forest-700 sm:flex">View register <ArrowRight className="h-4 w-4"/></Link></div>
      {!items.length ? <EmptyState title="Your catalogue is ready" description="Add the first spare part to begin building a searchable register." href="/parts/new" action="Add first part"/> : <div className="card overflow-hidden"><div className="divide-y divide-slate-100">{recent.map((item) => { const photo = item.item_photos?.sort((a,b)=>a.display_order-b.display_order)[0]; return <Link href={`/parts/${item.id}`} key={item.id} className="flex items-center gap-3 p-3 transition hover:bg-slate-50 sm:gap-4 sm:p-4"><ItemImage src={photo?.signed_url} alt="" className="h-14 w-14 shrink-0 rounded-xl sm:h-16 sm:w-16"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{titleForItem(item)}</p><p className="mt-1 truncate text-xs text-slate-500">{item.material_number ? `${item.material_number} · ` : ""}{item.location || "Location not recorded"}</p>{item.latest_note&&<div className="mt-2"><p className="line-clamp-2 break-words text-xs leading-5 text-slate-700">{item.latest_note}</p>{item.latest_note_at&&!item.latest_note_legacy&&<p className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(item.latest_note_at)}</p>}</div>}</div><div className="shrink-0 text-right"><p className="text-xs font-medium text-slate-400">{formatDate(item.created_at)}</p><ArrowRight className="ml-auto mt-2 h-4 w-4 text-slate-300"/></div></Link>; })}</div></div>}
    </section>
    <Link href="/parts" className="btn-secondary mt-4 w-full sm:hidden"><Search className="h-4 w-4"/>Search all parts</Link>
  </>;
}
