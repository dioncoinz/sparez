"use client";

import { useActionState, useState } from "react";
import { MinusCircle, PackageCheck, X } from "lucide-react";
import { removeStock, type ActionState } from "@/app/actions/items";

export function RemovalSheet({ itemId, available }: { itemId: string; available: number | null }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} disabled={available === 0} className="btn-primary w-full sm:w-auto">
      <MinusCircle className="h-5 w-5" />{available === 0 ? "No stock available" : "Use / Remove Part"}
    </button>
    {open && <RemovalDialog itemId={itemId} available={available} close={() => setOpen(false)} />}
  </>;
}

function RemovalDialog({ itemId, available, close }: { itemId: string; available: number | null; close: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(removeStock.bind(null, itemId), {});
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="remove-title" className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between"><div><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-forest-50 text-forest-700"><PackageCheck className="h-5 w-5" /></span><h2 id="remove-title" className="text-xl font-bold">Use / Remove Part</h2><p className="mt-1 text-sm text-slate-500">This action is recorded in movement history.</p></div><button onClick={close} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
      {state.ok ? <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-center"><PackageCheck className="mx-auto h-7 w-7 text-emerald-700" /><p className="mt-2 font-bold text-emerald-800">Removal recorded</p><p className="mt-1 text-sm text-emerald-700">The available quantity and movement history have been updated.</p><button onClick={close} className="btn-primary mt-5 w-full">Done</button></div> :
      <form action={formAction} className="mt-6 space-y-5">
        {available !== null ? <div><label className="label" htmlFor="quantity">Quantity being removed</label><input className="field text-lg font-bold" type="number" inputMode="numeric" min="1" max={available} step="1" id="quantity" name="quantity" required defaultValue="1" /><p className="mt-2 text-sm font-semibold text-forest-700">Available: {available}</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">No original quantity was supplied. Confirming will mark the whole item as used / removed.</div>}
        <div><label className="label" htmlFor="removal-note">Removal note <span className="font-normal text-slate-400">(optional)</span></label><textarea id="removal-note" name="note" className="field min-h-24 py-3" placeholder="Reason, destination or work order" /></div>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">{pending ? "Recording…" : "Confirm Removal"}</button>
      </form>}
    </div>
  </div>;
}
