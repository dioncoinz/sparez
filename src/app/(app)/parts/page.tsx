import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { RegisterWorkspace } from "@/components/register-workspace";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export const metadata={title:"Parts register"};
export default async function PartsPage(){
  const {membership}=await requireSession();const supabase=await createClient();
  const {data,error}=await supabase.rpc("item_filter_options",{p_organisation_id:membership.organisation_id});
  return <><PageHeader eyebrow="Catalogue" title="Parts register" description={membership.organisation?.name} action={<Link href="/parts/new" className="btn-primary">Add Part</Link>}/>{error&&<p role="alert" className="mb-4 text-red-700">Unable to load filter options: {error.message}</p>}<Suspense fallback={<p>Loading register…</p>}><RegisterWorkspace role={membership.role} options={data||{locations:[],creators:[]}}/></Suspense></>;
}
