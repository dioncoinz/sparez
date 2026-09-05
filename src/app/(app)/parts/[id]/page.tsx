import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getItem } from "@/lib/data";
import { PartDetail } from "@/components/part-detail";
export default async function ItemDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{created?:string}>}){
  const {id}=await params;const query=await searchParams;const {membership}=await requireSession();const item=await getItem(id);if(!item||item.is_archived)notFound();
  return <div className="mx-auto max-w-3xl"><Link href="/parts" className="btn-secondary mb-5">← Parts register</Link>{query.created&&<p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">Part saved to the register.</p>}<PartDetail key={item.id} initialItem={item} role={membership.role}/></div>;
}
