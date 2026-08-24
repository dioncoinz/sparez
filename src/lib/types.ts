export type Role = "admin" | "user";
export type Condition = "New" | "Good" | "Requires Inspection";

export interface Organisation { id: string; name: string; slug: string; }
export interface Profile { id: string; full_name: string | null; email: string | null; }
export interface Membership { id: string; organisation_id: string; user_id: string; role: Role; is_active: boolean; organisation?: Organisation; profile?: Profile; }
export interface ItemPhoto { id: string; item_id: string; storage_path: string; display_order: number; is_primary: boolean; signed_url?: string; }
export interface Movement { id: string; item_id: string; quantity_removed: number | null; movement_type: "quantity_removal" | "manual_removal"; note: string | null; removed_at: string; status: "active" | "reversed"; reversed_at: string | null; remover?: Profile; reverser?: Profile; }
export interface Item {
  id: string; organisation_id: string; wo_number: string | null; material_number: string | null;
  material_description: string | null; location: string | null; quantity: number | null; condition: Condition;
  notes: string | null; is_archived: boolean; created_at: string; updated_at: string; created_by: string;
  creator?: Profile; item_photos?: ItemPhoto[]; item_movements?: Movement[];
}
