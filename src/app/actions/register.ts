"use server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getItem, signPhotos } from "@/lib/data";
import { registerSchema } from "@/lib/register-state";
import type { Item, DuplicateItem } from "@/lib/types";
import { z } from "zod";

export async function loadRegister(queryString:string):Promise<{items:Item[];total:number;error?:string}> {
  const { membership }=await requireSession();
  const parsed=registerSchema.safeParse(Object.fromEntries(new URLSearchParams(queryString)));
  if(!parsed.success)return {items:[],total:0,error:parsed.error.issues[0].message};
  const {page,sort,direction,...filters}=parsed.data;
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("search_items",{p_organisation_id:membership.organisation_id,p_filters:filters,p_page:page,p_sort:sort,p_direction:direction});
  if(error)return {items:[],total:0,error:error.message};
  return {items:await signPhotos((data?.items||[]) as Item[]),total:Number(data?.total||0)};
}
export async function loadPart(id:string) {
  if(!z.string().uuid().safeParse(id).success)return {error:"Invalid part reference",item:null};
  try {const item=await getItem(id);return {item:item&&!item.is_archived?item:null,error:item&&!item.is_archived?undefined:"Part not found"};}
  catch(e){return {item:null,error:e instanceof Error?e.message:"Unable to load part"};}
}
export async function findDuplicates(material:string,description:string):Promise<{items:DuplicateItem[];error?:string}> {
  const {membership}=await requireSession();
  if(material.length>500||description.length>1000)return {items:[],error:"Check the material number and description lengths"};
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("find_item_duplicates",{p_organisation_id:membership.organisation_id,p_material_number:material.trim(),p_description:description.trim()});
  if(error)return {items:[],error:error.message};
  return {items:await signPhotos((data||[]) as DuplicateItem[])};
}
