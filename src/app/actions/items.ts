"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemSchema } from "@/lib/validation";
import { z } from "zod";

export type ActionState={ok?:boolean;error?:string};
function refresh(id:string){revalidatePath(`/parts/${id}`);revalidatePath("/parts");revalidatePath("/dashboard");}
export async function removeStock(itemId:string,_prev:ActionState,formData:FormData):Promise<ActionState>{
  await requireSession();
  const raw=String(formData.get("quantity")||"");const quantity=raw?Number(raw):null;const note=String(formData.get("note")||"").trim();
  if(quantity!==null&&(!Number.isSafeInteger(quantity)||quantity<=0)||note.length>1000)return {error:"Enter a positive whole quantity and a note of at most 1000 characters."};
  const supabase=await createClient();const {error}=await supabase.rpc("remove_item_stock",{p_item_id:itemId,p_quantity:quantity,p_note:note});
  if(error)return {error:error.message};refresh(itemId);return {ok:true};
}
export async function reverseMovementInline(itemId:string,movementId:string):Promise<ActionState>{
  const {membership}=await requireAdmin();const supabase=await createClient();
  const {data}=await supabase.from("item_movements").select("id").eq("id",movementId).eq("item_id",itemId).eq("organisation_id",membership.organisation_id).maybeSingle();
  if(!data)return {error:"Movement not found"};
  const {error}=await supabase.rpc("reverse_item_movement",{p_movement_id:movementId,p_note:""});
  if(error)return {error:error.message};refresh(itemId);return {ok:true};
}
export async function updateItem(itemId:string,_prev:ActionState,formData:FormData):Promise<ActionState>{
  const {membership}=await requireAdmin();
  const parsed=itemSchema.omit({notes:true}).safeParse(Object.fromEntries(formData.entries()));
  if(!parsed.success)return {error:parsed.error.issues[0]?.message};
  const d=parsed.data;const supabase=await createClient();
  if(!d.wo_number&&!d.material_number&&!d.material_description&&!d.location){const {count}=await supabase.from("item_photos").select("id",{count:"exact",head:true}).eq("item_id",itemId).eq("organisation_id",membership.organisation_id);if(!count)return {error:"Keep an identifying detail or an existing photo."};}
  const {data,error}=await supabase.from("items").update({...d,updated_by:membership.user_id}).eq("id",itemId).eq("organisation_id",membership.organisation_id).eq("updated_at",String(formData.get("updated_at")||"")).select("id");
  if(error)return {error:error.message};if(!data?.length)return {error:"This part changed while you were editing. Close and reopen the editor to load the latest values."};
  refresh(itemId);return {ok:true};
}
export async function addNote(itemId:string,_prev:ActionState,formData:FormData):Promise<ActionState>{
  await requireSession();const note=z.string().trim().min(1,"Enter a note").max(5000).safeParse(formData.get("note"));
  if(!note.success)return {error:note.error.issues[0].message};
  const supabase=await createClient();const {error}=await supabase.rpc("add_item_note",{p_item_id:itemId,p_note:note.data});
  if(error)return {error:error.message};refresh(itemId);return {ok:true};
}
export async function addStock(itemId:string,quantity:number):Promise<ActionState>{
  await requireSession();if(!Number.isSafeInteger(quantity)||quantity<1||quantity>2147483647)return {error:"Enter a positive whole quantity"};
  const supabase=await createClient();const {error}=await supabase.rpc("add_item_stock",{p_item_id:itemId,p_quantity:quantity});
  if(error)return {error:error.message};refresh(itemId);return {ok:true};
}
export async function archiveItemInline(itemId:string):Promise<ActionState>{
  const {membership}=await requireAdmin();const supabase=await createClient();const {error}=await supabase.from("items").update({is_archived:true}).eq("id",itemId).eq("organisation_id",membership.organisation_id);
  if(error)return {error:error.message};refresh(itemId);return {ok:true};
}
export async function archiveItem(itemId:string){const result=await archiveItemInline(itemId);if(result.error)redirect(`/parts/${itemId}?error=${encodeURIComponent(result.error)}`);redirect("/parts");}
