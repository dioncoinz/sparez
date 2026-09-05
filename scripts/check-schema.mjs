// Read-only metadata probes. Never prints keys or requests client records.
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const linkedRef=readFileSync('supabase/.temp/project-ref','utf8').trim();
if(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]!==linkedRef)throw new Error('Linked Supabase project differs from app configuration');
console.log('Linked project matches the app configuration.');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const org='00000000-0000-0000-0000-000000000000';
for(const table of ['items','item_notes','item_stock_additions']){
  const {error}=await client.from(table).select('id').limit(0);
  console.log(JSON.stringify({table,code:error?.code||'OK',message:error?.message||'Present'}));
}
for(const [name,args] of [['search_items',{p_organisation_id:org}],['item_filter_options',{p_organisation_id:org}],['find_item_duplicates',{p_organisation_id:org,p_material_number:'',p_description:''}]]){
  const {error}=await client.rpc(name,args);
  console.log(JSON.stringify({function:name,code:error?.code||'OK',message:error?.message||'Present'}));
}
