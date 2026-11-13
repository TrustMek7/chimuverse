-- Our finances belong to both of us:
-- * either member edits or trashes any movement or budget (other content stays author-only);
-- * fixed income, expenses and savings (salary, rent, subscriptions…) are rules that create
--   each movement on its own date, weekly, every two weeks, monthly or yearly.
--   Editing a rule changes only what it creates from now on; past movements stay as they were
--   (and can be edited one by one, e.g. a bill that came higher this month).

-- Shared editing of finance entries. Other kinds keep the author-only path.
create or replace function public.save_entry(p_data jsonb,p_content text default '',p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.entries;
begin
 if p_id is not null then
  select * into e from public.entries where id=p_id for update;
  if e.id is not null and e.kind in ('transaction','budget') and e.owner_id<>auth.uid() then
   if not public.is_member(e.space_id) or e.deleted_at is not null then raise exception 'No puedes editar esta entrada';end if;
   if coalesce(p_data->>'kind',e.kind)<>e.kind then raise exception 'No se puede cambiar el tipo';end if;
   update public.entries set title=p_data->>'title',occurred_on=coalesce((p_data->>'occurred_on')::date,e.occurred_on),
    amount=(p_data->>'amount')::numeric,details=coalesce(p_data->'details','{}')||jsonb_build_object('edited_by',auth.uid())
   where id=e.id;
   insert into public.entry_bodies values(e.id,coalesce(p_content,'')) on conflict(entry_id) do update set content=excluded.content;
   return e.id;
  end if;
 end if;
 return private.save_entry_base(p_data||jsonb_build_object('visibility',case when p_data->>'visibility'='capsule' then 'capsule' else 'shared' end),p_content,p_id);
end $$;

create or replace function public.trash_item(p_table text,p_id uuid,p_restore boolean default false) returns void language plpgsql security definer set search_path='' as $$begin
 if p_table='entries' then update public.entries set deleted_at=case when p_restore then null else now() end where id=p_id and (owner_id=auth.uid() or kind in ('transaction','budget')) and public.is_member(space_id);
 elsif p_table='photos' then update public.photos set deleted_at=case when p_restore then null else now() end where id=p_id and uploaded_by=auth.uid() and public.is_member(space_id);
 elsif p_table='calendar_events' then update public.calendar_events set deleted_at=case when p_restore then null else now() end where id=p_id and owner_id=auth.uid() and public.is_member(space_id);
 else raise exception 'Colección inválida';end if;
 if not found then raise exception 'Sin acceso';end if;end $$;

create table public.finance_recurring(
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.spaces,
 created_by uuid not null default auth.uid() references public.profiles,
 title text not null check(length(trim(title)) between 1 and 160),
 amount numeric(14,2) not null check(amount>0 and amount<100000000000),
 direction text not null check(direction in ('income','expense','saving')),
 category text not null default '' check(length(category)<=60),
 frequency text not null check(frequency in ('weekly','biweekly','monthly','yearly')),
 start_on date not null,
 end_on date check(end_on is null or end_on>=start_on),
 generated int not null default 0,
 next_on date not null,
 active boolean not null default true,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
alter table public.finance_recurring enable row level security;
create policy read_recurring on public.finance_recurring for select to authenticated using(public.is_member(space_id));
grant select on public.finance_recurring to authenticated;
-- One movement per rule and date, whoever or whatever creates it.
create unique index entries_recurring_once on public.entries((details->>'recurring_id'),occurred_on) where details ? 'recurring_id';

-- The k-th date of a rule, counted from its start so month ends never drift (31 → 28 → 31).
create function private.recurring_date(p_start date,p_frequency text,k int) returns date language sql immutable set search_path='' as $$
 select case p_frequency
  when 'weekly' then p_start+7*k
  when 'biweekly' then p_start+14*k
  when 'monthly' then (p_start+make_interval(months=>k))::date
  else (p_start+make_interval(years=>k))::date end
$$;
create function private.space_today(p_space uuid) returns date language sql stable set search_path='' as $$
 select coalesce(min((now() at time zone coalesce(p.timezone,'America/Lima'))::date),current_date)
 from public.space_members m join public.profiles p on p.id=m.user_id where m.space_id=p_space
$$;
-- Creates every movement that is due (catching up missed days), for one rule or all of them.
create function private.generate_recurring(p_rule uuid default null) returns int language plpgsql security definer set search_path='' as $$
declare r public.finance_recurring;n int:=0;today date;
begin
 for r in select * from public.finance_recurring where (p_rule is null or id=p_rule) and active and deleted_at is null for update loop
  today:=private.space_today(r.space_id);
  while r.next_on<=today and (r.end_on is null or r.next_on<=r.end_on) loop
   insert into public.entries(space_id,owner_id,kind,title,visibility,status,occurred_on,amount,details)
   values(r.space_id,r.created_by,'transaction',r.title,'shared','done',r.next_on,r.amount,
    jsonb_build_object('direction',r.direction,'category',r.category,'recurring_id',r.id))
   on conflict do nothing;
   if found then n:=n+1;end if;
   r.generated:=r.generated+1;
   r.next_on:=private.recurring_date(r.start_on,r.frequency,r.generated);
  end loop;
  update public.finance_recurring set generated=r.generated,next_on=r.next_on where id=r.id;
 end loop;
 return n;
end $$;
create function public.generate_recurring() returns int language sql security definer set search_path='' as $$select private.generate_recurring(null)$$;

-- Create a rule (it fills in every date from its start up to today) or edit one.
-- After creation only the title, amount, category, end date and pause can change; to change
-- the frequency, the type or the first date, create a new rule.
create function public.save_recurring(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.finance_recurring;sid uuid;rid uuid;today date;
 v_title text:=trim(coalesce(p_data->>'title',''));v_amount numeric:=(p_data->>'amount')::numeric;
 v_category text:=trim(coalesce(p_data->>'category',''));v_end date:=nullif(p_data->>'end_on','')::date;
 v_active boolean:=coalesce((p_data->>'active')::boolean,true);
begin
 select space_id into sid from public.space_members where user_id=auth.uid();
 if sid is null then raise exception 'Sin acceso';end if;
 if length(v_title) not between 1 and 160 then raise exception 'Ponle un nombre (hasta 160 caracteres)';end if;
 if v_amount is null or v_amount<=0 then raise exception 'El importe debe ser mayor que cero';end if;
 if p_id is null then
  if coalesce(p_data->>'direction','') not in ('income','expense','saving') then raise exception 'Elige si es ingreso, gasto o ahorro';end if;
  if coalesce(p_data->>'frequency','') not in ('weekly','biweekly','monthly','yearly') then raise exception 'Elige cada cuánto se repite';end if;
  if (p_data->>'start_on') is null then raise exception 'Elige la primera fecha';end if;
  if (p_data->>'start_on')::date<private.space_today(sid)-366 then raise exception 'La primera fecha puede ser como mucho de hace un año';end if;
  insert into public.finance_recurring(space_id,title,amount,direction,category,frequency,start_on,end_on,next_on)
  values(sid,v_title,v_amount,p_data->>'direction',v_category,p_data->>'frequency',(p_data->>'start_on')::date,v_end,(p_data->>'start_on')::date)
  returning id into rid;
 else
  select * into r from public.finance_recurring where id=p_id and space_id=sid and deleted_at is null for update;
  if r.id is null then raise exception 'Movimiento fijo no disponible';end if;
  if v_end is not null and v_end<r.start_on then raise exception 'El final no puede ser antes de la primera fecha';end if;
  -- Resuming skips the dates missed while paused instead of filling them in.
  if v_active and not r.active then
   today:=private.space_today(sid);
   while r.next_on<today loop r.generated:=r.generated+1;r.next_on:=private.recurring_date(r.start_on,r.frequency,r.generated);end loop;
  end if;
  update public.finance_recurring set title=v_title,amount=v_amount,category=v_category,end_on=v_end,active=v_active,
   generated=r.generated,next_on=r.next_on,updated_at=now() where id=r.id;
  rid:=r.id;
 end if;
 perform private.generate_recurring(rid);
 return rid;
end $$;
-- Removing a rule stops future movements; the ones already created stay.
create function public.delete_recurring(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.finance_recurring set deleted_at=now(),active=false,updated_at=now()
 where id=p_id and deleted_at is null and public.is_member(space_id);
 if not found then raise exception 'Movimiento fijo no disponible';end if;
end $$;
revoke all on function private.generate_recurring(uuid) from public,anon,authenticated;
revoke all on function public.generate_recurring() from public,anon,authenticated;
grant execute on function public.generate_recurring() to service_role;
revoke all on function public.save_recurring(uuid,jsonb),public.delete_recurring(uuid) from public,anon;
grant execute on function public.save_recurring(uuid,jsonb),public.delete_recurring(uuid) to authenticated;
do $$begin alter publication supabase_realtime add table public.finance_recurring; exception when duplicate_object or undefined_object then null;end $$;
notify pgrst,'reload schema';
