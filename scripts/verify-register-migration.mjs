// Read-only rollout verification. Output contains counts/status only, never client records or keys.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0],readFileSync('supabase/.temp/project-ref','utf8').trim(),'Linked project must match application configuration');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const selection='id, creator:profiles!items_created_by_fkey(id), item_photos(id), item_notes(id,author:profiles!item_notes_created_by_fkey(id)), item_stock_additions(id,author:profiles!item_stock_additions_created_by_fkey(id)), item_movements(id,remover:profiles!item_movements_removed_by_fkey(id),reverser:profiles!item_movements_reversed_by_fkey(id))';
const {error:relationshipError}=await client.from('items').select(selection).limit(0);
assert.equal(relationshipError,null,relationshipError?.message);
console.log('Part-detail and export relationships resolve in the live API schema.');
let checked=0;
for(let offset=0;;offset+=500){
  const {data,error}=await client.from('items').select('id,notes,item_notes(note_text,is_legacy)').not('notes','is',null).order('id').range(offset,offset+499);
  assert.equal(error,null,error?.message);
  for(const item of data){if(!item.notes.trim())continue;assert.ok(item.item_notes.some(note=>note.is_legacy&&note.note_text===item.notes),'Every nonempty legacy note must have an exact preserved history entry');checked++;}
  if(data.length<500)break;
}
console.log(`Verified ${checked} legacy notes preserved exactly; original fields remain intact.`);
for(const table of ['items','item_notes','item_stock_additions']){
  const {error,count}=await client.from(table).select('id',{count:'exact',head:true});
  assert.equal(error,null,error?.message);console.log(`${table}: ${count} records, schema available.`);
}
