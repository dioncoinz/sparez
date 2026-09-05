import { z } from "zod";

const text = z.string().trim().max(100).default("");
const optionalNumber = z.string().regex(/^\d{0,9}$/).default("");
const date = z.string().refine(v=>!v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v),"Enter a valid date").default("");
export const registerSchema = z.object({
  q:text, material:text, description:text, wo:text, location:z.string().max(500).default(""), notes:text,
  condition:z.enum(["","New","Good","Requires Inspection"]).default(""),
  status:z.enum(["","available","removed"]).default(""), creator:z.union([z.string().uuid(),z.literal("")]).default(""),
  min:optionalNumber,max:optionalNumber,from:date,to:date,
  page:z.coerce.number().int().min(1).max(100000).default(1),
  sort:z.enum(["material_number","material_description","wo_number","location","condition","available_quantity","created_at","creator_name","status","latest_note"]).default("created_at"),
  direction:z.enum(["asc","desc"]).default("desc"),
}).refine(v=>!v.min||!v.max||Number(v.min)<=Number(v.max),"Minimum quantity must not exceed maximum")
  .refine(v=>!v.from||!v.to||v.from<=v.to,"Start date must not follow end date");
export type RegisterState = z.infer<typeof registerSchema>;
export function registerQuery(value:string) {const p=new URLSearchParams(value);p.delete("part");return p.toString();}
