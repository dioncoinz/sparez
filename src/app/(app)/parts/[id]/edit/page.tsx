import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EditPartForm } from "@/components/edit-part-form";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getItem } from "@/lib/data";
export default async function EditPartPage({params}:{params:Promise<{id:string}>}){await requireAdmin();const{id}=await params;const item=await getItem(id);if(!item||item.is_archived)notFound();return <div className="mx-auto max-w-3xl"><Link href={`/parts/${id}`} className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-500"><ArrowLeft className="h-4 w-4"/>Back to part</Link><PageHeader eyebrow="Admin" title="Edit part details" description="Changes update the master record. Movement history is kept separately and cannot be edited here."/><EditPartForm item={item}/></div>}
