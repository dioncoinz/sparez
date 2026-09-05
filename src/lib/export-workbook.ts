import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item, Movement, Organisation } from "@/lib/types";
import { availableQuantity, itemStatus, formatDateTime } from "@/lib/utils";

export function perthDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function buildOrganisationExport(supabase: SupabaseClient, organisation: Organisation) {
  const { data, error } = await supabase.from("items").select("*, creator:profiles!items_created_by_fkey(full_name,email), item_photos(*), item_movements(*), item_notes(*,author:profiles!item_notes_created_by_fkey(full_name,email))").eq("organisation_id", organisation.id).order("created_at", { ascending: true });
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
  const noteHistory = workbook.addWorksheet("Note History", { views: [{ state: "frozen", ySplit: 1 }] });
  noteHistory.columns = [{header:"Part ID",key:"item",width:38},{header:"Material Number",key:"material",width:20},{header:"Created (AWST)",key:"date",width:26},{header:"Author",key:"author",width:28},{header:"Note",key:"text",width:80},{header:"Section",key:"section",width:12}];
  sheet.columns = [
    { header: "WO Number", key: "wo", width: 14 }, { header: "Material Number", key: "material", width: 17 },
    { header: "Material Description", key: "description", width: 34 }, { header: "Location", key: "location", width: 30 },
    { header: "Condition", key: "condition", width: 22 }, { header: "Total Stocked Quantity", key: "original", width: 22 },
    { header: "Quantity Removed", key: "removed", width: 18 }, { header: "Quantity Available", key: "available", width: 19 },
    { header: "Status", key: "status", width: 22 }, { header: "Notes", key: "notes", width: 38 },
    { header: "Added By", key: "addedBy", width: 24 }, { header: "Date Added", key: "date", width: 20 },
    { header: "Primary Photo", key: "primary", width: 22 },
    ...Array.from({ length: 7 }, (_, index) => ({ header: `Additional Photo ${index + 1}`, key: `additional${index + 1}`, width: 22 })),
  ];

  for (const item of items) {
    const notes = [...(item.item_notes || [])].sort((a,b)=>b.created_at.localeCompare(a.created_at));
    for(const note of notes) {
      // Excel cells have a 32,767-character limit; even unusually long legacy notes remain exportable.
      for(let offset=0;offset<note.note_text.length;offset+=30000) noteHistory.addRow({item:item.id,material:item.material_number||"",date:note.is_legacy?"Legacy · date unknown":formatDateTime(note.created_at),author:note.author?.full_name||note.author?.email||"",text:note.note_text.slice(offset,offset+30000),section:Math.floor(offset/30000)+1});
    }
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
      notes: item.item_notes?.length ? [...item.item_notes].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(n=>[n.is_legacy ? "Legacy note (date unknown)" : formatDateTime(n.created_at),n.author?.full_name||n.author?.email||"",n.note_text].filter(Boolean).join(" · ")).join("\n\n") : item.notes || "", addedBy: item.creator?.full_name || item.creator?.email || "", date: new Date(item.created_at),
      primary: primary ? { text: "Open primary photo", hyperlink: primary } : "", ...additionalCells,
    });
    row.getCell("date").numFmt = "dd mmm yyyy hh:mm";
    const noteCell=row.getCell("notes");
    if(typeof noteCell.value==="string"&&noteCell.value.length>32767)noteCell.value=noteCell.value.slice(0,32000)+"\n\nFull history is on the Note History worksheet.";
    for (const key of ["primary", ...Array.from({ length: 7 }, (_, index) => `additional${index + 1}`)]) {
      const cell = row.getCell(key);
      if (cell.value) cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }

  sheet.autoFilter = { from: "A1", to: `T${Math.max(1, sheet.rowCount)}` };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } }; cell.alignment = { vertical: "middle" }; });
  sheet.eachRow((row, index) => { if (index > 1) { row.alignment = { vertical: "top", wrapText: true }; if (index % 2 === 0) row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2EC" } }; }); } });
  noteHistory.getRow(1).font={bold:true};
  noteHistory.eachRow(row=>{row.alignment={vertical:"top",wrapText:true};});
  noteHistory.autoFilter={from:"A1",to:`F${Math.max(1,noteHistory.rowCount)}`};

  const buffer = await workbook.xlsx.writeBuffer();
  return { bytes: new Uint8Array(buffer), filename: `${organisation.slug || "organisation"}-sparez-register-${perthDate()}.xlsx`, itemCount: items.length };
}
