-- Sparez tenant-aware catalogue, audit and storage foundation.
create extension if not exists pgcrypto;

create type public.membership_role as enum ('admin', 'user');
create type public.item_condition as enum ('New', 'Good', 'Requires Inspection');
create type public.movement_type as enum ('quantity_removal', 'manual_removal');
create type public.movement_status as enum ('active', 'reversed');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'user',
  is_active boolean not null default true,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  wo_number text,
  material_number text,
  material_description text,
  location text,
  quantity integer check (quantity is null or quantity >= 0),
  condition public.item_condition not null default 'Good',
  notes text,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete cascade,
  storage_path text not null unique,
  display_order integer not null default 0 check (display_order >= 0),
  is_primary boolean not null default false,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index one_primary_photo_per_item on public.item_photos(item_id) where is_primary;

create table public.item_movements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  movement_type public.movement_type not null,
  quantity_removed integer check (quantity_removed is null or quantity_removed > 0),
  note text,
  removed_by uuid not null references public.profiles(id),
  removed_at timestamptz not null default now(),
  status public.movement_status not null default 'active',
  reversed_by uuid references public.profiles(id),
  reversed_at timestamptz,
  reversal_note text,
  constraint movement_quantity_shape check (
    (movement_type = 'quantity_removal' and quantity_removed is not null) or
    (movement_type = 'manual_removal' and quantity_removed is null)
  ),
  constraint reversal_shape check (
    (status = 'active' and reversed_by is null and reversed_at is null) or
    (status = 'reversed' and reversed_by is not null and reversed_at is not null)
  )
);

create index items_org_created_idx on public.items(organisation_id, created_at desc) where not is_archived;
create index items_search_idx on public.items using gin (to_tsvector('simple', coalesce(wo_number,'') || ' ' || coalesce(material_number,'') || ' ' || coalesce(material_description,'') || ' ' || coalesce(location,'')));
create index item_photos_item_idx on public.item_photos(item_id, display_order);
create index item_movements_item_idx on public.item_movements(item_id, removed_at desc);
create index memberships_user_idx on public.memberships(user_id) where is_active;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger organisations_updated before update on public.organisations for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger memberships_updated before update on public.memberships for each row execute function public.set_updated_at();
create trigger items_updated before update on public.items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute function public.handle_new_user();

-- Security-definer helpers avoid recursive membership RLS checks.
create or replace function public.is_org_member(org_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships where organisation_id = org_id and user_id = auth.uid() and is_active)
$$;
create or replace function public.is_org_admin(org_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships where organisation_id = org_id and user_id = auth.uid() and is_active and role = 'admin')
$$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_member(uuid), public.is_org_admin(uuid) to authenticated;

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.item_movements enable row level security;

create policy "members view organisations" on public.organisations for select to authenticated using (public.is_org_member(id));
create policy "admins update organisations" on public.organisations for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy "users view own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "members view colleague profiles" on public.profiles for select to authenticated using (
  exists(select 1 from public.memberships mine join public.memberships theirs on mine.organisation_id = theirs.organisation_id where mine.user_id = auth.uid() and mine.is_active and theirs.user_id = profiles.id)
);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "members view memberships" on public.memberships for select to authenticated using (public.is_org_member(organisation_id));
create policy "admins update memberships" on public.memberships for update to authenticated using (public.is_org_admin(organisation_id)) with check (public.is_org_admin(organisation_id));

create policy "members view items" on public.items for select to authenticated using (public.is_org_member(organisation_id));
create policy "members create items" on public.items for insert to authenticated with check (
  public.is_org_member(organisation_id) and created_by = auth.uid() and (
    nullif(btrim(coalesce(wo_number, '')), '') is not null or nullif(btrim(coalesce(material_number, '')), '') is not null or
    nullif(btrim(coalesce(material_description, '')), '') is not null or nullif(btrim(coalesce(location, '')), '') is not null
  )
);
create policy "admins update items" on public.items for update to authenticated using (public.is_org_admin(organisation_id)) with check (public.is_org_admin(organisation_id));
create policy "members view photos" on public.item_photos for select to authenticated using (public.is_org_member(organisation_id));
create policy "members create photos" on public.item_photos for insert to authenticated with check (
  public.is_org_member(organisation_id) and uploaded_by = auth.uid() and exists(select 1 from public.items where id = item_id and organisation_id = item_photos.organisation_id)
);
create policy "members view movements" on public.item_movements for select to authenticated using (public.is_org_member(organisation_id));

create or replace function public.create_item(
  p_id uuid, p_organisation_id uuid, p_wo_number text, p_material_number text, p_material_description text,
  p_location text, p_quantity integer, p_condition public.item_condition, p_notes text, p_photo_paths text[] default '{}'
) returns public.items language plpgsql security definer set search_path = public, storage as $$
declare result public.items; photo_path text; ordinal integer := 0;
begin
  if not public.is_org_member(p_organisation_id) then raise exception 'Permission denied'; end if;
  if p_quantity is not null and p_quantity < 0 then raise exception 'Quantity cannot be negative'; end if;
  if nullif(btrim(coalesce(p_wo_number,'')),'') is null and nullif(btrim(coalesce(p_material_number,'')),'') is null and
     nullif(btrim(coalesce(p_material_description,'')),'') is null and nullif(btrim(coalesce(p_location,'')),'') is null and
     coalesce(array_length(p_photo_paths,1),0) = 0 then raise exception 'Add identifying information or at least one photo'; end if;
  insert into public.items(id,organisation_id,wo_number,material_number,material_description,location,quantity,condition,notes,created_by)
  values(p_id,p_organisation_id,nullif(btrim(p_wo_number),''),nullif(btrim(p_material_number),''),nullif(btrim(p_material_description),''),nullif(btrim(p_location),''),p_quantity,p_condition,nullif(btrim(p_notes),''),auth.uid()) returning * into result;
  foreach photo_path in array p_photo_paths loop
    if photo_path not like p_organisation_id::text || '/items/' || p_id::text || '/%' or not exists(select 1 from storage.objects where bucket_id='item-photos' and name=photo_path) then
      raise exception 'Invalid photo path';
    end if;
    insert into public.item_photos(organisation_id,item_id,storage_path,display_order,is_primary,uploaded_by)
    values(p_organisation_id,p_id,photo_path,ordinal,ordinal=0,auth.uid()); ordinal := ordinal + 1;
  end loop;
  return result;
end $$;

create or replace function public.remove_item_stock(p_item_id uuid, p_quantity integer default null, p_note text default null)
returns public.item_movements language plpgsql security definer set search_path = public as $$
declare target public.items; removed_total integer; result public.item_movements;
begin
  select * into target from public.items where id = p_item_id and not is_archived for update;
  if target.id is null or not public.is_org_member(target.organisation_id) then raise exception 'Item not found'; end if;
  select coalesce(sum(quantity_removed), 0) into removed_total from public.item_movements where item_id = target.id and status = 'active' and movement_type = 'quantity_removal';
  if target.quantity is null then
    if p_quantity is not null then raise exception 'Quantity must be omitted for an unquantified item'; end if;
    if exists(select 1 from public.item_movements where item_id = target.id and status = 'active' and movement_type = 'manual_removal') then raise exception 'Item is already removed'; end if;
    insert into public.item_movements(organisation_id,item_id,movement_type,quantity_removed,note,removed_by) values(target.organisation_id,target.id,'manual_removal',null,nullif(btrim(p_note),''),auth.uid()) returning * into result;
  else
    if p_quantity is null or p_quantity <= 0 then raise exception 'Removal quantity must be greater than zero'; end if;
    if p_quantity > target.quantity - removed_total then raise exception 'Removal quantity exceeds available stock'; end if;
    insert into public.item_movements(organisation_id,item_id,movement_type,quantity_removed,note,removed_by) values(target.organisation_id,target.id,'quantity_removal',p_quantity,nullif(btrim(p_note),''),auth.uid()) returning * into result;
  end if;
  return result;
end $$;

create or replace function public.reverse_item_movement(p_movement_id uuid, p_note text default null)
returns public.item_movements language plpgsql security definer set search_path = public as $$
declare result public.item_movements;
begin
  select * into result from public.item_movements where id = p_movement_id for update;
  if result.id is null or not public.is_org_admin(result.organisation_id) then raise exception 'Movement not found or permission denied'; end if;
  if result.status = 'reversed' then raise exception 'Movement has already been reversed'; end if;
  update public.item_movements set status='reversed', reversed_by=auth.uid(), reversed_at=now(), reversal_note=nullif(btrim(p_note),'') where id=p_movement_id returning * into result;
  return result;
end $$;
revoke all on function public.create_item(uuid,uuid,text,text,text,text,integer,public.item_condition,text,text[]), public.remove_item_stock(uuid,integer,text), public.reverse_item_movement(uuid,text) from public;
grant execute on function public.create_item(uuid,uuid,text,text,text,text,integer,public.item_condition,text,text[]), public.remove_item_stock(uuid,integer,text), public.reverse_item_movement(uuid,text) to authenticated;

-- Private bucket. Signed URLs are produced by the app for authorised members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "members upload organisation photos" on storage.objects for insert to authenticated with check (
  bucket_id='item-photos' and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy "members read organisation photos" on storage.objects for select to authenticated using (
  bucket_id='item-photos' and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy "uploader or admin deletes photos" on storage.objects for delete to authenticated using (
  bucket_id='item-photos' and public.is_org_member(((storage.foldername(name))[1])::uuid) and
  (owner_id = auth.uid()::text or public.is_org_admin(((storage.foldername(name))[1])::uuid))
);

-- Prevent changing tenant/ownership fields through permitted updates.
create or replace function public.protect_item_identity() returns trigger language plpgsql as $$
begin
  if new.organisation_id <> old.organisation_id or new.created_by <> old.created_by or new.created_at <> old.created_at then raise exception 'Item identity fields cannot be changed'; end if;
  new.updated_by = auth.uid(); return new;
end $$;
create trigger protect_item_identity before update on public.items for each row execute function public.protect_item_identity();
