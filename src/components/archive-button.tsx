"use client";
import { Archive } from "lucide-react";
import { archiveItem } from "@/app/actions/items";
export function ArchiveButton({itemId}:{itemId:string}){return <form action={archiveItem.bind(null,itemId)} onSubmit={e=>{if(!window.confirm("Archive this part? It will leave the active register but its history will be retained."))e.preventDefault()}}><button className="btn-secondary w-full text-red-700 sm:w-auto"><Archive className="h-4 w-4"/>Archive</button></form>}
