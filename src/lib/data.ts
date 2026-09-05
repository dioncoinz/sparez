import { createClient } from "@/lib/supabase/server";
import type { Item, ItemPhoto } from "./types";
import { requireSession } from "./auth";

export async function signPhotos<T extends { item_photos?: ItemPhoto[] }>(records: T[]): Promise<T[]> {
  const paths = records.flatMap((r) => r.item_photos || []).map((p) => p.storage_path);
  if (!paths.length) return records;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("item-photos").createSignedUrls(paths, 3600);
  const urlMap = new Map((data || []).map((entry, i) => [paths[i], entry.signedUrl]));
  return records.map((record) => ({ ...record, item_photos: (record.item_photos || []).map((photo) => ({ ...photo, signed_url: urlMap.get(photo.storage_path) })) }));
}

export async function getItem(id: string): Promise<Item | null> {
  const { membership } = await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").select("*, creator:profiles!items_created_by_fkey(id,full_name,email), item_photos(*), item_notes(*,author:profiles!item_notes_created_by_fkey(id,full_name,email)), item_stock_additions(*,author:profiles!item_stock_additions_created_by_fkey(id,full_name,email)), item_movements(*, remover:profiles!item_movements_removed_by_fkey(id,full_name,email), reverser:profiles!item_movements_reversed_by_fkey(id,full_name,email))").eq("id", id).eq("organisation_id",membership.organisation_id).maybeSingle();
  if(error) throw new Error(error.message);
  if (!data) return null;
  const [signed] = await signPhotos([data as unknown as Item]);
  signed.item_photos?.sort((a, b) => a.display_order - b.display_order);
  signed.item_movements?.sort((a, b) => new Date(b.removed_at).getTime() - new Date(a.removed_at).getTime());
  signed.item_notes?.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  signed.item_stock_additions?.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return signed;
}
