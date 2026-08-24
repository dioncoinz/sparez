"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemSchema } from "@/lib/validation";

export type ActionState={ok?:boolean;error?:string};
export async function removeStock(itemId:string,_prev:ActionState,formData:FormData):Promise<ActionState>{
  await requireSession(); const supabase=await createClient(); const raw=String(formData.get("quantity")||""); const quantity=raw?Number(raw):null; const note=String(formData.get("note")||""); const {error}=await supabase.rpc("remove_item_stock",{p_item_id:itemId,p_quantity:quantity,p_note:note}); if(error)return{error:error.message}; revalidatePath(`/parts/${itemId}`);revalidatePath("/dashboard");revalidatePath("/parts");return{ok:true};
}
export async function reverseMovement(itemId:string,movementId:string,formData:FormData){await requireAdmin();const supabase=await createClient();const{error}=await supabase.rpc("reverse_item_movement",{p_movement_id:movementId,p_note:String(formData.get("note")||"")});if(error)redirect(`/parts/${itemId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/parts/${itemId}`);revalidatePath("/dashboard");revalidatePath("/parts");redirect(`/parts/${itemId}?reversed=1`)}
export async function updateItem(itemId:string,_prev:ActionState,formData:FormData):Promise<ActionState>{const{membership}=await requireAdmin();const parsed=itemSchema.safeParse(Object.fromEntries(formData.entries()));if(!parsed.success)return{error:parsed.error.issues[0]?.message};const d=parsed.data;if(!d.wo_number&&!d.material_number&&!d.material_description&&!d.location)return{error:"Keep at least one identifying text field. Existing photos cannot be the only identifier when editing."};const supabase=await createClient();const{error}=await supabase.from("items").update({...d,updated_by:membership.user_id}).eq("id",itemId).eq("organisation_id",membership.organisation_id);if(error)return{error:error.message};revalidatePath(`/parts/${itemId}`);revalidatePath("/parts");return{ok:true}}
export async function archiveItem(itemId:string){const{membership}=await requireAdmin();const supabase=await createClient();const{error}=await supabase.from("items").update({is_archived:true}).eq("id",itemId).eq("organisation_id",membership.organisation_id);if(error)redirect(`/parts/${itemId}?error=${encodeURIComponent(error.message)}`);revalidatePath("/parts");revalidatePath("/dashboard");redirect("/parts")}
