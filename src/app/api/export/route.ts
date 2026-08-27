import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildOrganisationExport } from "@/lib/export-workbook";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { membership } = await requireAdmin();
  if (!membership.organisation) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  try {
    const result = await buildOrganisationExport(await createClient(), membership.organisation);
    return new NextResponse(result.bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create export." }, { status: 500 });
  }
}
