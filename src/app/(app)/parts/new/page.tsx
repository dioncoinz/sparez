import { PageHeader } from "@/components/ui";
import { PartForm } from "@/components/part-form";
import { requireSession } from "@/lib/auth";
export const metadata={title:"Add Part"};
export default async function AddPartPage(){const {membership}=await requireSession();return <div className="mx-auto max-w-3xl"><PageHeader eyebrow="Field capture" title="Add part" description="Photograph the part, add what you know, and keep moving. Only one identifying detail is required."/><PartForm organisationId={membership.organisation_id}/></div>}
