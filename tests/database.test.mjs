import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Only the Supabase platform schemas are stubbed. Both real app migrations run unchanged.
test('migrations, legacy preservation, role/tenant isolation and workflow transactions', async t=>{
  const db=new PGlite({extensions:{pg_trgm,pgcrypto}});
  const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
  const admin='20000000-0000-4000-8000-000000000001',user='20000000-0000-4000-8000-000000000002',outsider='20000000-0000-4000-8000-000000000003';
  const part='30000000-0000-4000-8000-000000000001',foreign='30000000-0000-4000-8000-000000000002';
  async function as(id){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
  async function scalar(sql,params=[]){const {rows}=await db.query(sql,params);return Object.values(rows[0])[0];}
  async function search(filters={},page=1,sort='created_at',direction='desc'){return scalar('select public.search_items($1,$2,$3,$4,$5)',[org,JSON.stringify(filters),page,sort,direction]);}
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      grant usage on schema public,auth,storage,extensions to authenticated;
      alter default privileges in schema public grant all on tables to authenticated;
    `);
    await db.exec(await readFile('supabase/migrations/20260824000000_initial_sparez.sql','utf8'));
    await db.exec(`insert into auth.users(id,email) values('${admin}','admin@example.test'),('${user}','user@example.test'),('${outsider}','other@example.test');
      insert into public.organisations(id,name,slug) values('${org}','Local test','local-test'),('${other}','Other tenant','other-test');
      insert into public.memberships(organisation_id,user_id,role) values('${org}','${admin}','admin'),('${org}','${user}','user'),('${other}','${outsider}','admin');
      insert into public.items(id,organisation_id,material_number,material_description,location,quantity,created_by,notes) values
      ('${part}','${org}',' MAT-001 ','Hydraulic pump assembly','North yard',10,'${admin}','Legacy 100%_ note (keep), carefully'),
      ('${foreign}','${other}','MAT-001','Hydraulic pump assembly','Secret location',900,'${outsider}','Secret note');
    `);
    await db.exec(await readFile('supabase/migrations/20260906000000_register_workflow.sql','utf8'));
    await as(user);
    await t.test('legacy notes are retained verbatim and timestamp marked legacy',async()=>{
      const notes=await db.query('select * from public.item_notes');assert.equal(notes.rows.length,1);assert.equal(notes.rows[0].note_text,'Legacy 100%_ note (keep), carefully');assert.equal(notes.rows[0].is_legacy,true);
      assert.equal(await scalar('select notes from public.items where id=$1',[part]),notes.rows[0].note_text);
    });
    await t.test('notes are append-only, tenant scoped and validate input',async()=>{
      await scalar('select public.add_item_note($1,$2)',[part,'Fresh INSPECTION finding']);
      assert.equal((await db.query('select * from public.item_notes')).rows.length,2);
      await assert.rejects(()=>scalar('select public.add_item_note($1,$2)',[foreign,'Cross tenant']),/not found/);
      await assert.rejects(()=>scalar('select public.add_item_note($1,$2)',[part,'  ']),/1–5000/);
      await assert.rejects(()=>scalar('select public.add_item_note($1,$2)',[part,'x'.repeat(5001)]),/1–5000/);
      await assert.rejects(()=>db.exec("update public.item_notes set note_text='overwrite'"),/permission denied/);
      await assert.rejects(()=>db.exec('delete from public.item_notes'),/permission denied/);
    });
    await t.test('search includes all notes and treats special characters literally',async()=>{
      assert.equal((await search({q:'inspection'})).total,1);
      assert.equal((await search({q:'100%_'})).total,1);
      assert.equal((await search({q:'(keep),'})).total,1);
      assert.equal((await search({q:'secret'})).total,0);
      assert.equal((await search({q:"' OR true --"})).total,0);
      assert.equal((await search({q:'inspection',material:'mat-',description:'pump',location:'North yard',condition:'Good',status:'available',min:'10',max:'10',creator:admin})).total,1);
      assert.equal((await search({q:'inspection',min:'11'})).total,0);
      for(const sort of ['material_number','material_description','wo_number','location','condition','available_quantity','status','created_at','creator_name','latest_note'])assert.equal((await search({},1,sort,'asc')).total,1);
    });
    await t.test('duplicate detection normalizes exact matches and never exposes another tenant',async()=>{
      const matches=await scalar('select public.find_item_duplicates($1,$2,$3)',[org,'mat-001','']);assert.equal(matches.length,1);assert.equal(matches[0].id,part);assert.equal(matches[0].reason,'Same material number');
      assert.equal((await scalar('select public.find_item_duplicates($1,$2,$3)',[other,'mat-001',''])).length,0);
      assert.equal((await scalar('select public.find_item_duplicates($1,$2,$3)',[org,'','HYDRAULIC, pump assembly'])).length,1);
    });
    await t.test('stock increments and audit insert succeed together for standard users',async()=>{
      await Promise.all([scalar('select public.add_item_stock($1,$2)',[part,2]),scalar('select public.add_item_stock($1,$2)',[part,3])]);
      assert.equal(await scalar('select quantity from public.items where id=$1',[part]),15);
      const audit=await db.query('select * from public.item_stock_additions');assert.equal(audit.rows.length,2);assert.ok(audit.rows.every(a=>a.created_by===user&&a.source==='duplicate_detection'));
      await assert.rejects(()=>scalar('select public.add_item_stock($1,$2)',[foreign,2]),/not found/);
      await assert.rejects(()=>scalar('select public.add_item_stock($1,$2)',[part,0]),/positive/);
      await assert.rejects(()=>scalar('select public.add_item_stock($1,$2)',[part,2147483647]),/out of range/);
      assert.equal(await scalar('select quantity from public.items where id=$1',[part]),15);
      assert.equal(await scalar('select count(*)::int from public.item_stock_additions'),2);
    });
    await t.test('audit insertion failure rolls back the quantity update',async()=>{
      await db.exec("reset role;alter table public.item_stock_additions add constraint test_reject_addition check(quantity_added<>7)");
      await as(user);
      await assert.rejects(()=>scalar('select public.add_item_stock($1,$2)',[part,7]),/test_reject_addition/);
      assert.equal(await scalar('select quantity from public.items where id=$1',[part]),15);
      assert.equal(await scalar('select count(*)::int from public.item_stock_additions'),2);
      await db.exec('reset role;alter table public.item_stock_additions drop constraint test_reject_addition');await as(user);
    });
    await t.test('existing removal and admin reversal remain available',async()=>{
      const movement=await scalar('select to_jsonb(public.remove_item_stock($1,$2,$3))',[part,4,'Used for WO']);
      assert.equal((await search()).items[0].available_quantity,11);
      await assert.rejects(()=>scalar('select public.reverse_item_movement($1,$2)',[movement.id,'']),/permission denied/);
      await as(admin);await scalar('select public.reverse_item_movement($1,$2)',[movement.id,'']);assert.equal((await search()).items[0].available_quantity,15);
      await assert.rejects(()=>db.query('update public.items set notes=$1 where id=$2',['overwrite',part]),/preserve note history/);
    });
    await t.test('creation requires a duplicate decision and cannot bypass checked RPC',async()=>{
      await as(user);
      const args=['30000000-0000-4000-8000-000000000003',org,'WO-1','mat-001','Hydraulic pump assembly','North yard',1,'Good','Initial timestamped note',[],false];
      const sql='select public.create_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)';
      await assert.rejects(()=>scalar(sql,args),/DUPLICATES_FOUND/);
      args[10]=true;await scalar(sql,args);assert.equal((await search()).total,2);
      await assert.rejects(()=>db.query('insert into public.items(organisation_id,created_by,material_number) values($1,$2,$3)',[org,user,'Bypass']),/permission denied/);
      await assert.rejects(()=>scalar('select public.create_item_unchecked($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',args.slice(0,10)),/permission denied/);
      const note=await scalar('select note_text from public.item_notes where item_id=$1',[args[0]]);assert.equal(note,'Initial timestamped note');
    });
    await t.test('server pagination remains deterministic with combined filters',async()=>{
      await db.exec('reset role');
      await db.query(`insert into public.items(organisation_id,created_by,material_number,location,quantity,created_at) select $1,$2,'PAGE-'||lpad(n::text,3,'0'),'South yard',n,'2026-09-05T23:00:00Z'::timestamptz from generate_series(1,55) n`,[org,admin]);
      await as(user);
      const filters={material:'PAGE-',location:'South yard',from:'2026-09-06',to:'2026-09-06',min:'1',max:'55'};
      const first=await search(filters,1,'material_number','asc'),second=await search(filters,2,'material_number','asc');assert.equal(first.total,55);assert.equal(first.items.length,50);assert.equal(second.items.length,5);assert.equal(second.items[0].material_number,'PAGE-051');
      assert.equal((await search({...filters,to:'2026-09-05'})).total,0);
      await assert.rejects(()=>scalar('select public.search_items($1)',[other]),/Permission denied/);
    });
    await t.test('all filters combine with note search and active-removal status',async()=>{
      const target='30000000-0000-4000-8000-000000000003';
      await scalar('select public.remove_item_stock($1,$2,$3)',[target,1,'used']);
      const filters={q:'timestamped',wo:'WO-1',material:'mat-001',description:'pump',notes:'initial',location:'North yard',creator:user,condition:'Good',status:'removed',min:'0',max:'0'};
      assert.equal((await search(filters)).total,1);
      for(const [key,value] of Object.entries({wo:'not-a-wo',material:'missing',description:'missing',notes:'missing',location:'other',creator:admin,condition:'New',status:'available',min:'1'}))assert.equal((await search({...filters,[key]:value})).total,0,key);
    });
    await t.test('admins can promote and demote colleagues only in their own organisation',async()=>{
      await as(user);
      let result=await db.query("update public.memberships set role='admin' where user_id=$1 returning id",[user]);
      assert.equal(result.rows.length,0,'Standard users cannot promote themselves');
      await as(admin);
      result=await db.query("update public.memberships set role='admin' where organisation_id=$1 and user_id=$2 returning id",[org,user]);
      assert.equal(result.rows.length,1);
      await as(user);assert.equal(await scalar('select public.is_org_admin($1)',[org]),true);
      result=await db.query("update public.memberships set role='user' where user_id=$1 returning id",[outsider]);
      assert.equal(result.rows.length,0,'Admins cannot alter another tenant');
      await as(admin);
      await db.query("update public.memberships set role='user' where organisation_id=$1 and user_id=$2",[org,user]);
      await as(user);assert.equal(await scalar('select public.is_org_admin($1)',[org]),false);
    });
    await t.test('standard users cannot edit master data and inactive members lose access',async()=>{
      const result=await db.query('update public.items set material_number=$1 where id=$2 returning id',['forbidden',part]);assert.equal(result.rows.length,0);
      await db.exec(`reset role;update public.memberships set is_active=false where user_id='${user}'`);await as(user);
      assert.equal(await scalar('select count(*)::int from public.items'),0);
      assert.equal(await scalar('select count(*)::int from public.item_notes'),0);
      assert.equal(await scalar('select count(*)::int from public.item_stock_additions'),0);
      await assert.rejects(()=>scalar('select public.add_item_stock($1,$2)',[part,1]),/not found/);
    });
  }finally{await db.close();}
});
