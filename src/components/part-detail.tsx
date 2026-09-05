"use client";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, Role } from "@/lib/types";
import { availableQuantity, formatDateTime, itemStatus, titleForItem } from "@/lib/utils";
import { addNote, archiveItemInline, reverseMovementInline } from "@/app/actions/items";
import { loadPart } from "@/app/actions/register";
import { PrimaryPhoto } from "./primary-photo";
import { ItemImage } from "./item-image";
import { ConditionPill, StatusPill } from "./ui";
import { EditPartForm } from "./edit-part-form";
import { RemovalSheet } from "./removal-sheet";
import { Dialog } from "./dialog";

export function PartDrawer({id,role,close,onUpdated}:{id:string;role:Role;close:()=>void;onUpdated?:(item:Item)=>void}) {
  const [result,setResult]=useState<{item:Item|null;error?:string}|null>(null);
  useEffect(()=>{let active=true;loadPart(id).then(r=>{if(active)setResult(r);}).catch(()=>{if(active)setResult({item:null,error:"Unable to load part. Close and try again."});});return()=>{active=false;};},[id]);
  return <Dialog title="Part details" close={close} sheet>{!result?<p role="status">Loading part…</p>:result.item?<PartDetail initialItem={result.item} role={role} onUpdated={onUpdated} onArchived={close}/>:<p role="alert">{result.error}</p>}</Dialog>;
}
export function PartDetail({initialItem,role,onUpdated,onArchived}:{initialItem:Item;role:Role;onUpdated?:(item:Item)=>void;onArchived?:()=>void}) {
  const [item,setItem]=useState(initialItem);
  const [editing,setEditing]=useState(false);
  const [confirmArchive,setConfirmArchive]=useState(false);
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const router=useRouter();
  const refresh=useCallback(async()=>{const result=await loadPart(initialItem.id);if(result.item){setItem(result.item);onUpdated?.(result.item);}else setError(result.error||"Unable to refresh part");},[initialItem.id,onUpdated]);
  const active=(item.item_movements||[]).filter(m=>m.status==="active");
  const removed=active.reduce((sum,m)=>sum+(m.quantity_removed||0),0);
  const available=availableQuantity(item.quantity,removed);
  const gone=itemStatus(item.quantity,removed,active.some(m=>m.movement_type==="manual_removal"))!=="Available";
  return <div className="space-y-6">
    <PrimaryPhoto src={item.item_photos?.[0]?.signed_url} alt={titleForItem(item)}/>
    {(item.item_photos?.length||0)>1&&<div className="grid grid-cols-4 gap-2">{item.item_photos!.slice(1).map(p=><a key={p.id} href={p.signed_url} target="_blank" rel="noreferrer" aria-label="Open additional photo"><ItemImage src={p.signed_url} alt="Additional part view" className="aspect-square rounded-lg"/></a>)}</div>}
    <div><div className="flex flex-wrap gap-2"><StatusPill removed={gone}/><ConditionPill condition={item.condition}/></div><h2 className="mt-3 break-words text-2xl font-bold">{titleForItem(item)}</h2></div>
    <dl className="grid grid-cols-2 gap-5 rounded-xl border border-slate-200 bg-white p-5">{[["Material number",item.material_number],["Work order",item.wo_number],["Location",item.location],["Added by",item.creator?.full_name||item.creator?.email],["Date added",formatDateTime(item.created_at)]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value||"Not recorded"}</dd></div>)}</dl>
    <div className="grid grid-cols-3 gap-3">{[["Total stocked",item.quantity],["Removed",removed],["Available",available]].map(([label,value])=><div key={String(label)} className="card p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-xl font-bold">{value??"Not set"}</p></div>)}</div>
    <div className="flex flex-wrap gap-2"><RemovalSheet itemId={item.id} available={gone?0:available} onSaved={refresh}/>{role==="admin"&&<><button className="btn-secondary" onClick={()=>setEditing(!editing)}>{editing?"Close editor":"Edit details"}</button><button className="btn-secondary text-red-700" onClick={()=>setConfirmArchive(true)}>Archive</button></>}</div>
    {editing&&<EditPartForm item={item} onSaved={refresh}/>}
    <Notes item={item} onSaved={refresh}/>
    <section className="card p-5"><h3 className="font-bold">Stock history</h3><p className="mt-1 text-xs text-slate-600">Additions, removals and reversals are retained.</p>
      {!item.item_movements?.length&&!item.item_stock_additions?.length&&<p className="mt-4 text-sm text-slate-500">No stock movements recorded.</p>}
      {item.item_stock_additions?.map(a=><div className="mt-4 border-t pt-4" key={a.id}><p className="text-sm font-bold">+{a.quantity_added} stock added</p><p className="mt-1 text-xs text-slate-600">{a.author?.full_name||a.author?.email||"Unknown"} · {formatDateTime(a.created_at)}</p><p className="mt-1 text-xs text-slate-500">From duplicate detection</p></div>)}
      {item.item_movements?.map(m=><div className="mt-4 border-t pt-4" key={m.id}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{m.movement_type==="manual_removal"?"Item marked removed":`${m.quantity_removed} removed`}</p><p className="mt-1 text-xs text-slate-600">{m.remover?.full_name||m.remover?.email||"Unknown"} · {formatDateTime(m.removed_at)}</p></div>{m.status==="reversed"?<span className="text-xs font-semibold">Reversed</span>:role==="admin"&&<button disabled={busy} className="btn-secondary min-h-11 px-3 text-xs" onClick={async()=>{setBusy(true);try{const result=await reverseMovementInline(item.id,m.id);if(result.error)setError(result.error);else await refresh();}finally{setBusy(false);}}}>Reverse</button>}</div>{m.note&&<p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.note}</p>}{m.reversed_at&&<p className="mt-2 text-xs text-slate-500">Reversed {formatDateTime(m.reversed_at)} by {m.reverser?.full_name||m.reverser?.email||"admin"}</p>}</div>)}
    </section>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {confirmArchive&&<Dialog title="Archive part" close={()=>setConfirmArchive(false)}><p>This part will leave the active register. Its notes, photos and history will be retained.</p><button className="btn-primary mt-5" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await archiveItemInline(item.id);if(result.error)setError(result.error);else {onUpdated?.({...item,is_archived:true});if(onArchived)onArchived();else router.push("/parts");}setConfirmArchive(false);}finally{setBusy(false);}}}>Confirm archive</button></Dialog>}
  </div>;
}
function Notes({item,onSaved}:{item:Item;onSaved:()=>void}) {
  const [state,action,pending]=useActionState(addNote.bind(null,item.id),{});
  const form=useRef<HTMLFormElement>(null);
  useEffect(()=>{if(state.ok){form.current?.reset();onSaved();}},[state,onSaved]);
  return <section className="card p-5"><h3 className="font-bold">Notes</h3><form ref={form} action={action} className="mt-4"><label htmlFor={`note-${item.id}`} className="label">Add a note</label><textarea id={`note-${item.id}`} name="note" required maxLength={5000} className="field min-h-24 py-3" placeholder="Observations, dimensions or handling details"/><p className="mt-2 text-xs text-slate-500">Timestamp and author are recorded automatically (AWST).</p><button disabled={pending} className="btn-primary mt-3">{pending?"Adding…":"Add note"}</button>{state.error&&<p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}{state.ok&&<p role="status" className="mt-3 text-sm text-emerald-700">Note added.</p>}</form><div className="mt-5 space-y-4">{item.item_notes?.map(n=><article key={n.id} className="border-t border-slate-200 pt-4"><p className="whitespace-pre-wrap break-words text-sm leading-6">{n.note_text}</p><p className="mt-2 text-xs text-slate-500">{n.is_legacy?"Legacy note · Original note date unknown":`${n.author?.full_name||n.author?.email||"Unknown"} · ${formatDateTime(n.created_at)}`}</p></article>)}{!item.item_notes?.length&&item.notes&&<article className="border-t pt-4"><p className="whitespace-pre-wrap break-words text-sm">{item.notes}</p><p className="mt-2 text-xs text-slate-500">Legacy note · Original note date unknown</p></article>}</div></section>;
}
