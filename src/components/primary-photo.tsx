"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { Dialog } from "./dialog";
import { ItemImage } from "./item-image";

export function PrimaryPhoto({ src, alt }: { src?: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return <>{src ? <button type="button" onClick={() => setOpen(true)} aria-label="Open primary photo and zoom" className="block w-full rounded-xl text-left"><ItemImage src={src} alt={alt} sizes="(max-width:768px) 100vw, 700px" className="aspect-[4/3] w-full rounded-xl"/><span className="mt-2 block text-xs font-semibold text-forest-700">Open photo · Zoom and inspect</span></button> : <div><ItemImage alt="" className="aspect-[4/3] w-full rounded-xl"/><p className="mt-2 text-sm text-slate-500">No photo recorded.</p></div>}{open && src && <PhotoZoom src={src} alt={alt} close={() => setOpen(false)}/>}</>;
}
function PhotoZoom({src, alt, close}: {src:string;alt:string;close:()=>void}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({x:0,y:0});
  const pointers = useRef(new Map<number,{x:number;y:number}>());
  const distance = useRef<number | null>(null);
  function zoom(next:number) { setScale(Math.max(1,Math.min(5,next))); if(next<=1)setOffset({x:0,y:0}); }
  return <Dialog title="Primary photo" close={close}><div className="mb-3 flex flex-wrap gap-2"><button className="btn-secondary" onClick={()=>zoom(scale-.5)} disabled={scale<=1} aria-label="Zoom out">−</button><button className="btn-secondary" onClick={()=>zoom(scale+.5)} disabled={scale>=5} aria-label="Zoom in">+</button><button className="btn-secondary" onClick={()=>{zoom(1);setOffset({x:0,y:0});}}>Reset</button><output className="self-center text-sm">{Math.round(scale*100)}%</output></div><p className="mb-3 text-xs text-slate-600">Drag to pan when zoomed. Pinch on touch screens. Escape closes.</p><div className="relative h-[60dvh] touch-none overflow-hidden rounded-xl bg-white" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});}} onPointerMove={e=>{const old=pointers.current.get(e.pointerId);if(!old)return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...pointers.current.values()];if(pts.length===2){const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(distance.current)zoom(scale*d/distance.current);distance.current=d;}else if(scale>1){const maxX=e.currentTarget.clientWidth*(scale-1)/2;const maxY=e.currentTarget.clientHeight*(scale-1)/2;setOffset(p=>({x:Math.max(-maxX,Math.min(maxX,p.x+e.clientX-old.x)),y:Math.max(-maxY,Math.min(maxY,p.y+e.clientY-old.y))}));}}} onPointerUp={e=>{pointers.current.delete(e.pointerId);distance.current=null;}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);distance.current=null;}}><Image src={src} alt={alt} fill unoptimized draggable={false} className="select-none object-contain" style={{transform:`translate(${offset.x}px, ${offset.y}px) scale(${scale})`}}/></div></Dialog>;
}
