-- Demo organisation and records. Run after creating a demo auth user, replacing the UUID below.
-- This block safely does nothing until DEMO_USER_ID is replaced with a real auth.users UUID.
do $$
declare demo_user uuid := '00000000-0000-0000-0000-000000000000'; org uuid;
begin
  if exists(select 1 from auth.users where id = demo_user) then
    insert into public.organisations(name,slug) values('Valeron Demo','valeron-demo') on conflict(slug) do update set name=excluded.name returning id into org;
    insert into public.memberships(organisation_id,user_id,role) values(org,demo_user,'admin') on conflict(organisation_id,user_id) do update set role='admin', is_active=true;
    if not exists(select 1 from public.items where organisation_id=org) then
      insert into public.items(organisation_id,material_number,material_description,wo_number,location,quantity,condition,created_by) values
        (org,'10038472','BEARING HOUSING ASSEMBLY','45012345','North Laydown - Row 2',3,'Good',demo_user),
        (org,null,'CONVEYOR DRIVE PULLEY',null,'Main Laydown - Bay 7',1,'Requires Inspection',demo_user),
        (org,null,'GEARBOX ASSEMBLY','45016789','Workshop External Laydown',2,'New',demo_user);
    end if;
  end if;
end $$;
