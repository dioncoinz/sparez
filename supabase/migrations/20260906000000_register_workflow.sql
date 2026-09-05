-- Additive workflow upgrade. Apply before the corresponding application release.
-- Legacy items.notes stays intact. Backfill timestamps are explicitly marked legacy.
begin;
create extension if not exists pg_trgm with schema extensions;
do $$ begin
  if (select extnamespace::regnamespace::text from pg_extension where extname='pg_trgm') <> 'extensions' then
    raise exception 'pg_trgm already exists outside extensions. Review extension placement before applying this migration.';
  end if;
end $$;

create table public.item_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  note_text text not null check (length(btrim(note_text)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  is_legacy boolean not null default false
);
create index item_notes_item_created_idx on public.item_notes(organisation_id,item_id,created_at desc);
create index item_notes_text_idx on public.item_notes using gin(note_text extensions.gin_trgm_ops);
alter table public.item_notes enable row level security;
create policy "members view notes" on public.item_notes for select to authenticated using(public.is_org_member(organisation_id));
revoke all on public.item_notes from anon, authenticated;
grant select on public.item_notes to authenticated;
insert into public.item_notes(item_id,organisation_id,note_text,created_at,created_by,is_legacy)
select id,organisation_id,notes,created_at,created_by,true from public.items where nullif(btrim(notes),'') is not null;

create function public.capture_initial_note() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if nullif(btrim(new.notes),'') is not null then
    if length(new.notes)>5000 then raise exception 'Notes must be 5000 characters or fewer'; end if;
    insert into public.item_notes(item_id,organisation_id,note_text,created_by) values(new.id,new.organisation_id,btrim(new.notes),new.created_by);
  end if;
  return new;
end $$;
create trigger capture_initial_note after insert on public.items for each row execute function public.capture_initial_note();

create function public.add_item_note(p_item_id uuid,p_note text) returns public.item_notes
language plpgsql security definer set search_path=public as $$
declare target public.items; result public.item_notes;
begin
  select * into target from public.items where id=p_item_id and not is_archived for update;
  if target.id is null or not public.is_org_member(target.organisation_id) then raise exception 'Part not found'; end if;
  if p_note is null or length(btrim(p_note)) not between 1 and 5000 then raise exception 'Enter a note of 1–5000 characters'; end if;
  insert into public.item_notes(item_id,organisation_id,note_text,created_by) values(target.id,target.organisation_id,btrim(p_note),auth.uid()) returning * into result;
  return result;
end $$;

create table public.item_stock_additions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  quantity_added integer not null check(quantity_added>0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  source text not null check(source='duplicate_detection')
);
create index item_stock_additions_item_idx on public.item_stock_additions(organisation_id,item_id,created_at desc);
alter table public.item_stock_additions enable row level security;
create policy "members view stock additions" on public.item_stock_additions for select to authenticated using(public.is_org_member(organisation_id));
revoke all on public.item_stock_additions from anon,authenticated;
grant select on public.item_stock_additions to authenticated;

create function public.add_item_stock(p_item_id uuid,p_quantity integer) returns public.item_stock_additions
language plpgsql security definer set search_path=public as $$
declare target public.items; result public.item_stock_additions;
begin
  select * into target from public.items where id=p_item_id and not is_archived for update;
  if target.id is null or not public.is_org_member(target.organisation_id) then raise exception 'Part not found'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'Enter a positive whole quantity'; end if;
  if target.quantity is null then raise exception 'This part has no recorded quantity. Ask an administrator to quantify it first.'; end if;
  update public.items set quantity=quantity+p_quantity where id=target.id;
  insert into public.item_stock_additions(item_id,organisation_id,quantity_added,created_by,source)
  values(target.id,target.organisation_id,p_quantity,auth.uid(),'duplicate_detection') returning * into result;
  return result;
end $$;

create function public.protect_note_history() returns trigger language plpgsql as $$
begin
  if new.notes is distinct from old.notes then raise exception 'Use Add note to preserve note history'; end if;
  if new.quantity is distinct from old.quantity then
    if exists(select 1 from public.item_movements where item_id=old.id and status='active' and movement_type='manual_removal') then raise exception 'Reverse the manual removal before changing quantity'; end if;
    if exists(select 1 from public.item_movements where item_id=old.id and status='active' and movement_type='quantity_removal') and
      (new.quantity is null or new.quantity < (select sum(quantity_removed) from public.item_movements where item_id=old.id and status='active')) then
      raise exception 'Quantity cannot be less than recorded removals';
    end if;
  end if;
  return new;
end $$;
create trigger protect_note_history before update on public.items for each row execute function public.protect_note_history();

create function public.normalized_description(value text) returns text language sql immutable parallel safe set search_path=public as $$
  select btrim(regexp_replace(lower(coalesce(value,'')), '[^[:alnum:]]+', ' ', 'g'))
$$;
create index items_material_normalized_idx on public.items(organisation_id,lower(btrim(material_number))) where not is_archived;
create index items_description_trgm_idx on public.items using gin(public.normalized_description(material_description) extensions.gin_trgm_ops) where not is_archived;
create index items_location_idx on public.items(organisation_id,location) where not is_archived;
create index items_creator_idx on public.items(organisation_id,created_by) where not is_archived;
create index items_text_filters_idx on public.items using gin(material_number extensions.gin_trgm_ops,material_description extensions.gin_trgm_ops,wo_number extensions.gin_trgm_ops,location extensions.gin_trgm_ops) where not is_archived;

create function public.find_item_duplicates(p_organisation_id uuid,p_material_number text,p_description text)
returns jsonb language sql stable security invoker set search_path=public,extensions as $$
  select coalesce(jsonb_agg(candidate order by exact_match desc,score desc),'[]'::jsonb) from (
    select to_jsonb(i) || jsonb_build_object(
      'reason',case when lower(btrim(i.material_number))=lower(btrim(p_material_number)) then 'Same material number' else 'Similar description' end,
      'item_photos',(select coalesce(jsonb_agg(p order by p.display_order),'[]'::jsonb) from public.item_photos p where p.item_id=i.id and p.organisation_id=p_organisation_id),
      'available_quantity',case when i.quantity is null then null else greatest(0,i.quantity-coalesce((select sum(m.quantity_removed) from public.item_movements m where m.item_id=i.id and m.status='active'),0)) end,
      'similarity_label',case when similarity(public.normalized_description(i.material_description),public.normalized_description(p_description))>=.85 then 'Very close description' else 'Close description' end
    ) candidate,
    coalesce(lower(btrim(i.material_number))=lower(btrim(p_material_number)),false) exact_match,
    similarity(public.normalized_description(i.material_description),public.normalized_description(p_description)) score
    from public.items i where i.organisation_id=p_organisation_id and public.is_org_member(p_organisation_id) and not i.is_archived and (
      (nullif(btrim(p_material_number),'') is not null and lower(btrim(i.material_number))=lower(btrim(p_material_number))) or
      (length(public.normalized_description(p_description))>=8 and public.normalized_description(i.material_description) % public.normalized_description(p_description)
        and similarity(public.normalized_description(i.material_description),public.normalized_description(p_description))>=.65)
    ) order by exact_match desc,score desc,i.id limit 10
  ) matches
$$;

-- Retain the proven photo transaction internally; require the checked entry point.
alter function public.create_item(uuid,uuid,text,text,text,text,integer,public.item_condition,text,text[]) rename to create_item_unchecked;
revoke all on function public.create_item_unchecked(uuid,uuid,text,text,text,text,integer,public.item_condition,text,text[]) from public,anon,authenticated;
drop policy "members create items" on public.items;
revoke insert on public.items from authenticated;
create function public.create_item(
  p_id uuid,p_organisation_id uuid,p_wo_number text,p_material_number text,p_material_description text,
  p_location text,p_quantity integer,p_condition public.item_condition,p_notes text,p_photo_paths text[] default '{}',p_confirm_duplicate boolean default false
) returns public.items language plpgsql security definer set search_path=public as $$
declare matches jsonb;
begin
  if not public.is_org_member(p_organisation_id) then raise exception 'Permission denied'; end if;
  if length(coalesce(p_wo_number,''))>500 or length(coalesce(p_material_number,''))>500 or length(coalesce(p_location,''))>500 or length(coalesce(p_material_description,''))>1000 or length(coalesce(p_notes,''))>5000 then raise exception 'Part details exceed the maximum length'; end if;
  -- Serialize final checks and creation per organisation, including description matches.
  perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text,0));
  matches:=public.find_item_duplicates(p_organisation_id,p_material_number,p_material_description);
  if jsonb_array_length(matches)>0 and not coalesce(p_confirm_duplicate,false) then raise exception 'DUPLICATES_FOUND' using errcode='P0001'; end if;
  return public.create_item_unchecked(p_id,p_organisation_id,p_wo_number,p_material_number,p_material_description,p_location,p_quantity,p_condition,p_notes,p_photo_paths);
end $$;

-- Literal substring patterns: %, _ and backslash are data, never query syntax.
create function public.contains_pattern(value text) returns text language sql immutable parallel safe as $$
  select '%' || replace(replace(replace(coalesce(value,''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
$$;

create function public.search_items(p_organisation_id uuid,p_filters jsonb default '{}',p_page integer default 1,p_sort text default 'created_at',p_direction text default 'desc')
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare sort_column text; result jsonb;
begin
  if not public.is_org_member(p_organisation_id) then raise exception 'Permission denied'; end if;
  if p_page<1 or p_page>100000 or p_direction not in ('asc','desc') then raise exception 'Invalid pagination'; end if;
  sort_column:=case when p_sort in ('material_number','material_description','wo_number','location','condition','available_quantity','created_at','creator_name','status','latest_note') then p_sort else 'created_at' end;
  execute format($query$
    with candidates as (
      select i.*,p.full_name creator_name,
        case when i.quantity is null then null else greatest(0,i.quantity-coalesce(m.removed,0)) end available_quantity,
        case when coalesce(m.manual,false) or i.quantity-coalesce(m.removed,0)=0 then 'removed' else 'available' end status,
        n.note_text latest_note,n.created_at latest_note_at,n.is_legacy latest_note_legacy
      from public.items i left join public.profiles p on p.id=i.created_by
      left join lateral(select sum(quantity_removed) removed,bool_or(movement_type='manual_removal') manual from public.item_movements where item_id=i.id and organisation_id=$1 and status='active') m on true
      left join lateral(select note_text,created_at,is_legacy from public.item_notes where item_id=i.id and organisation_id=$1 order by created_at desc,id desc limit 1) n on true
      where i.organisation_id=$1 and not i.is_archived
      and (coalesce($2->>'q','')='' or i.material_number ilike public.contains_pattern($2->>'q') or i.material_description ilike public.contains_pattern($2->>'q') or i.wo_number ilike public.contains_pattern($2->>'q') or i.location ilike public.contains_pattern($2->>'q') or exists(select 1 from public.item_notes z where z.item_id=i.id and z.organisation_id=$1 and z.note_text ilike public.contains_pattern($2->>'q')))
      and (coalesce($2->>'material','')='' or i.material_number ilike public.contains_pattern($2->>'material'))
      and (coalesce($2->>'description','')='' or i.material_description ilike public.contains_pattern($2->>'description'))
      and (coalesce($2->>'wo','')='' or i.wo_number ilike public.contains_pattern($2->>'wo'))
      and (coalesce($2->>'location','')='' or i.location=$2->>'location')
      and (coalesce($2->>'condition','')='' or i.condition::text=$2->>'condition')
      and (coalesce($2->>'creator','')='' or i.created_by::text=$2->>'creator')
      and (coalesce($2->>'notes','')='' or exists(select 1 from public.item_notes z where z.item_id=i.id and z.organisation_id=$1 and z.note_text ilike public.contains_pattern($2->>'notes')))
      and (coalesce($2->>'from','')='' or i.created_at >= (($2->>'from')::date::timestamp at time zone 'Australia/Perth'))
      and (coalesce($2->>'to','')='' or i.created_at < ((($2->>'to')::date+1)::timestamp at time zone 'Australia/Perth'))
    ), filtered as (
      select * from candidates where (coalesce($2->>'status','')='' or status=$2->>'status')
      and (coalesce($2->>'min','')='' or available_quantity>=($2->>'min')::integer)
      and (coalesce($2->>'max','')='' or available_quantity<=($2->>'max')::integer)
    ), page as (select * from filtered order by %I %s nulls last,id limit 50 offset ($3-1)*50)
    select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('item_photos',(select coalesce(jsonb_agg(p order by display_order),'[]'::jsonb) from public.item_photos p where p.item_id=page.id and p.organisation_id=$1)) order by %I %s nulls last,id) from page),'[]'::jsonb))
  $query$,sort_column,p_direction,sort_column,p_direction) into result using p_organisation_id,p_filters,p_page;
  return result;
end $$;

create function public.item_filter_options(p_organisation_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'locations',(select coalesce(jsonb_agg(location order by location),'[]'::jsonb) from (select distinct location from public.items where organisation_id=p_organisation_id and public.is_org_member(p_organisation_id) and not is_archived and location is not null) l),
    'creators',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.full_name,p.email,'Unknown')) order by p.full_name),'[]'::jsonb) from public.profiles p where exists(select 1 from public.items i where i.created_by=p.id and i.organisation_id=p_organisation_id and public.is_org_member(p_organisation_id) and not i.is_archived))
  )
$$;

revoke all on function public.capture_initial_note(),public.protect_note_history() from public,anon,authenticated;
revoke all on function public.add_item_note(uuid,text),public.add_item_stock(uuid,integer),public.find_item_duplicates(uuid,text,text),public.create_item(uuid,uuid,text,text,text,text,integer,public.item_condition,text,text[],boolean),public.search_items(uuid,jsonb,integer,text,text),public.item_filter_options(uuid) from public,anon;
grant execute on function public.add_item_note(uuid,text),public.add_item_stock(uuid,integer),public.find_item_duplicates(uuid,text,text),public.create_item(uuid,uuid,text,text,text,text,integer,public.item_condition,text,text[],boolean),public.search_items(uuid,jsonb,integer,text,text),public.item_filter_options(uuid) to authenticated;
commit;
