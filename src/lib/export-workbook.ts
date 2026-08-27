import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item, Movement, Organisation } from "@/lib/types";
import { availableQuantity, itemStatus } from "@/lib/utils";

export function perthDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function buildOrganisationExport(supabase: SupabaseClient, organisation: Organisation) {
  const { data, error } = await supabase.from("items").select("*, creator:profiles!items_created_by_fkey(full_name,email), item_photos(*), item_movements(*)").eq("organisation_id", organisation.id).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const items = (data || []) as unknown as Item[];
  const paths = items.flatMap((item) => item.item_photos || []).map((photo) => photo.storage_path);
  const signed = paths.length ? await supabase.storage.from("item-photos").createSignedUrls(paths, 60 * 60 * 24 * 7) : { data: [] };
  const urls = new Map((signed.data || []).map((entry, index) => [paths[index], entry.signedUrl]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sparez by Valeron";
  workbook.created = new Date();
  workbook.title = `${organisation.name} Sparez Register`;
  const sheet = workbook.addWorksheet("Parts Register", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "WO Number", key: "wo", width: 14 }, { header: "Material Number", key: "material", width: 17 },
    { header: "Material Description", key: "description", width: 34 }, { header: "Location", key: "location", width: 30 },
    { header: "Condition", key: "condition", width: 22 }, { header: "Original Quantity", key: "original", width: 17 },
    { header: "Quantity Removed", key: "removed", width: 18 }, { header: "Quantity Available", key: "available", width: 19 },
    { header: "Status", key: "status", width: 22 }, { header: "Notes", key: "notes", width: 38 },
    { header: "Added By", key: "addedBy", width: 24 }, { header: "Date Added", key: "date", width: 20 },
    { header: "Primary Photo", key: "primary", width: 22 },
    ...Array.from({ length: 7 }, (_, index) => ({ header: `Additional Photo ${index + 1}`, key: `additional${index + 1}`, width: 22 })),
  ];

  for (const item of items) {
    const active = ((item.item_movements || []) as Movement[]).filter((movement) => movement.status === "active");
    const removed = active.reduce((sum, movement) => sum + (movement.quantity_removed || 0), 0);
    const manuallyRemoved = active.some((movement) => movement.movement_type === "manual_removal");
    const photos = (item.item_photos || []).sort((a, b) => a.display_order - b.display_order);
    const primary = photos[0] ? urls.get(photos[0].storage_path) || "" : "";
    const additional = photos.slice(1).map((photo) => urls.get(photo.storage_path) || "").filter(Boolean);
    const additionalCells = Object.fromEntries(additional.map((url, index) => [`additional${index + 1}`, { text: `Open photo ${index + 2}`, hyperlink: url }]));
    const row = sheet.addRow({
      wo: item.wo_number || "", material: item.material_number || "", description: item.material_description || "", location: item.location || "",
      condition: item.condition, original: item.quantity ?? "", removed: item.quantity === null ? (manuallyRemoved ? "Item removed" : "") : removed,
      available: availableQuantity(item.quantity, removed) ?? "", status: item.is_archived ? "Archived" : itemStatus(item.quantity, removed, manuallyRemoved),
      notes: item.notes || "", addedBy: item.creator?.full_name || item.creator?.email || "", date: new Date(item.created_at),
      primary: primary ? { text: "Open primary photo", hyperlink: primary } : "", ...additionalCells,
    });
    row.getCell("date").numFmt = "dd mmm yyyy hh:mm";
    for (const key of ["primary", ...Array.from({ length: 7 }, (_, index) => `additional${index + 1}`)]) {
      const cell = row.getCell(key);
      if (cell.value) cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }

  sheet.autoFilter = { from: "A1", to: `T${Math.max(1, sheet.rowCount)}` };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF19332A" } }; cell.alignment = { vertical: "middle" }; });
  sheet.eachRow((row, index) => { if (index > 1) { row.alignment = { vertical: "top", wrapText: true }; if (index % 2 === 0) row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F5F1" } }; }); } });

  const buffer = await workbook.xlsx.writeBuffer();
  return { bytes: new Uint8Array(buffer), filename: `${organisation.slug || "organisation"}-sparez-register-${perthDate()}.xlsx`, itemCount: items.length };
}
