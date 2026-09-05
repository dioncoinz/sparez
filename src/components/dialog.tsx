"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native modal dialogs provide a top layer, focus trap and nested Escape handling. */
export function Dialog({ title, close, children, sheet = false }: { title: string; close: () => void; children: React.ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; trigger?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); e.stopPropagation(); close(); }} onKeyDown={e=>{
    if(e.key!=="Tab")return;
    e.stopPropagation();
    const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el=>el.getClientRects().length>0&&el.closest('dialog')===e.currentTarget);
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }} onClick={e => { if (e.target === e.currentTarget) close(); }} className={cn("fixed max-h-[100dvh] w-full max-w-2xl overflow-y-auto bg-canvas p-0 shadow-2xl", sheet ? "inset-y-0 left-auto right-0 m-0 h-dvh max-w-full md:w-[min(760px,85vw)]" : "m-auto rounded-xl max-sm:rounded-none")}>
    <div className="min-h-full" onClick={e => e.stopPropagation()}><header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3"><h2 className="font-bold">{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={close} className="btn-secondary h-11 min-h-11 px-3"><X size={20}/></button></header><div className="p-4 sm:p-6">{children}</div></div>
  </dialog>;
}
