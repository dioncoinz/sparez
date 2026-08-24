import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { requireAdmin } from "@/lib/auth";
export const metadata={title:"Settings"};
export default async function SettingsPage(){const{membership}=await requireAdmin();return <div className="mx-auto max-w-2xl"><PageHeader eyebrow="Admin" title="Organisation settings" description="Manage the basic identity of your Sparez workspace."/><SettingsForm name={membership.organisation?.name||""} slug={membership.organisation?.slug||""}/></div>}
