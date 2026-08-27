import { NextResponse } from "next/server";
import type { Organisation } from "@/lib/types";
import { buildOrganisationExport, perthDate } from "@/lib/export-workbook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_RECIPIENT = "philippe.isard@greatland.com.au";

async function exportOrganisation() {
  const supabase = createAdminClient();
  const configuredId = process.env.DAILY_EXPORT_ORGANISATION_ID;
  if (configuredId) {
    const { data, error } = await supabase.from("organisations").select("id,name,slug").eq("id", configuredId).single();
    if (error || !data) throw new Error(error?.message || "Configured export organisation was not found.");
    return { supabase, organisation: data as Organisation };
  }

  const { data, error } = await supabase.from("organisations").select("id,name,slug").order("created_at").limit(2);
  if (error) throw new Error(error.message);
  if (data.length !== 1) throw new Error("Set DAILY_EXPORT_ORGANISATION_ID when the project contains more than one organisation.");
  return { supabase, organisation: data[0] as Organisation };
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return NextResponse.json({ error: "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured." }, { status: 500 });

  try {
    const { supabase, organisation } = await exportOrganisation();
    const result = await buildOrganisationExport(supabase, organisation);
    const date = perthDate();
    const recipient = process.env.DAILY_EXPORT_EMAIL || DEFAULT_RECIPIENT;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `sparez-daily-export-${organisation.id}-${date}` },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `${organisation.name} Sparez register — ${date}`,
        html: `<p>Attached is the daily ${organisation.name} Sparez register export for ${date}.</p><p>${result.itemCount} part${result.itemCount === 1 ? "" : "s"} included. Photo links in the workbook remain valid for seven days.</p>`,
        attachments: [{ filename: result.filename, content: Buffer.from(result.bytes).toString("base64") }],
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message || `Resend returned HTTP ${response.status}.`);
    return NextResponse.json({ ok: true, emailId: payload.id, recipient, filename: result.filename });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send daily export." }, { status: 500 });
  }
}
