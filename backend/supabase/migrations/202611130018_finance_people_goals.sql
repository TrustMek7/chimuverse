-- Whose money it is, and what we are saving for.
-- * Every movement says whose it is: details.person = a member's id, or '' for "de los dos"
--   (the common pot). Incomes belong to someone, expenses were paid by someone, savings were
--   put by someone. Fixed movements carry it too. Older movements without it count as their author's.
-- * Savings goals: a target amount (optional date), for one of us or for both. Savings movements
--   (one-off or fixed) can be assigned to a goal, which shows its progress.
create table public.savings_goals(
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.spaces,
 created_by uuid not null default auth.uid() references public.profiles,
 title text not null check(length(trim(title)) between 1 and 120),
 target numeric(14,2) not null check(target>0 and target<100000000000),
 target_on date,
 person uuid references public.profiles, -- null: a goal for both of us
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
alter table public.savings_goals enable row level security;
create policy read_goals on public.savings_goals for select to authenticated using(public.is_member(space_id));
grant select on public.savings_goals to authenticated;

alter table public.finance_recurring add column person uuid references public.profiles;
alter table public.finance_recurring add column goal_id uuid references public.savings_goals;

-- Finance details must point inside the space: a member (or '' for both) and a goal of the space.
create function private.validate_finance_details() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='transaction' then
  if new.details ? 'person' and coalesce(new.details->>'person','')<>'' and not exists(
   select 1 from public.space_members where space_id=new.space_id and user_id::text=new.details->>'person') then
   raise exception 'Esa persona no forma parte del espacio';end if;
  if coalesce(new.details->>'goal_id','')<>'' then
   if new.details->>'direction'<>'saving' then raise exception 'Solo un ahorro puede ir a una meta';end if;
   if not exists(select 1 from public.savings_goals where space_id=new.space_id and id::text=new.details->>'goal_id' and deleted_at is null) then
    raise exception 'Meta de ahorro no disponible';end if;
  end if;
 end if;
 return new;
end $$;
create trigger validate_finance_details before insert or update on public.entries for each row execute function private.validate_finance_details();

create function public.save_savings_goal(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;gid uuid;v_title text:=trim(coalesce(p_data->>'title',''));v_target numeric:=(p_data->>'target')::numeric;
 v_on date:=nullif(p_data->>'target_on','')::date;v_person uuid:=nullif(p_data->>'person','')::uuid;
begin
 select space_id into sid from public.space_members where user_id=auth.uid();
 if sid is null then raise exception 'Sin acceso';end if;
 if length(v_title) not between 1 and 120 then raise exception 'Ponle un nombre a la meta';end if;
 if v_target is null or v_target<=0 then raise exception 'La meta debe ser mayor que cero';end if;
 if v_person is not null and not exists(select 1 from public.space_members where space_id=sid and user_id=v_person) then raise exception 'Esa persona no forma parte del espacio';end if;
 if p_id is null then
  insert into public.savings_goals(space_id,title,target,target_on,person) values(sid,v_title,v_target,v_on,v_person) returning id into gid;
 else
  update public.savings_goals set title=v_title,target=v_target,target_on=v_on,person=v_person,updated_at=now()
  where id=p_id and space_id=sid and deleted_at is null returning id into gid;
  if gid is null then raise exception 'Meta no disponible';end if;
 end if;
 return gid;
end $$;
-- Removing a goal keeps its savings; they simply stop pointing to it, and fixed savings stop feeding it.
create function public.delete_savings_goal(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.savings_goals set deleted_at=now(),updated_at=now() where id=p_id and deleted_at is null and public.is_member(space_id);
 if not found then raise exception 'Meta no disponible';end if;
 update public.finance_recurring set goal_id=null where goal_id=p_id;
 update public.entries set details=details-'goal_id' where kind='transaction' and details->>'goal_id'=p_id::text;
end $$;

-- Fixed movements: person and goal are part of the rule and of every movement it registers.
create or replace function private.generate_recurring(p_rule uuid default null) returns int language plpgsql security definer set search_path='' as $$
declare r public.finance_recurring;n int:=0;today date;
begin
 for r in select * from public.finance_recurring where (p_rule is null or id=p_rule) and active and deleted_at is null for update loop
  today:=private.space_today(r.space_id);
  while r.next_on<=today and (r.end_on is null or r.next_on<=r.end_on) loop
   insert into public.entries(space_id,owner_id,kind,title,visibility,status,occurred_on,amount,details)
   values(r.space_id,r.created_by,'transaction',r.title,'shared','done',r.next_on,r.amount,
    jsonb_strip_nulls(jsonb_build_object('direction',r.direction,'category',r.category,'recurring_id',r.id,
     'person',coalesce(r.person::text,''),'goal_id',case when r.direction='saving' then r.goal_id end)))
   on conflict do nothing;
   if found then n:=n+1;end if;
   r.generated:=r.generated+1;
   r.next_on:=private.recurring_date(r.start_on,r.frequency,r.generated);
  end loop;
  update public.finance_recurring set generated=r.generated,next_on=r.next_on where id=r.id;
 end loop;
 return n;
end $$;
-- save_recurring now also takes whose it is (person: a member's id, or '' for both) and, for
-- savings, the goal it feeds. Omitted keys keep the rule's current values (pause/resume).
create or replace function public.save_recurring(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.finance_recurring;sid uuid;rid uuid;today date;last_on date;
 v_direction text;v_frequency text;v_start date;v_person uuid;v_goal uuid;
 v_title text:=trim(coalesce(p_data->>'title',''));v_amount numeric:=(p_data->>'amount')::numeric;
 v_category text:=trim(coalesce(p_data->>'category',''));v_end date:=nullif(p_data->>'end_on','')::date;
 v_active boolean:=coalesce((p_data->>'active')::boolean,true);
begin
 select space_id into sid from public.space_members where user_id=auth.uid();
 if sid is null then raise exception 'Sin acceso';end if;
 if length(v_title) not between 1 and 160 then raise exception 'Ponle un nombre (hasta 160 caracteres)';end if;
 if v_amount is null or v_amount<=0 then raise exception 'El importe debe ser mayor que cero';end if;
 if p_id is not null then
  select * into r from public.finance_recurring where id=p_id and space_id=sid and deleted_at is null for update;
  if r.id is null then raise exception 'Movimiento fijo no disponible';end if;
 end if;
 v_direction:=coalesce(p_data->>'direction',r.direction);
 v_frequency:=coalesce(p_data->>'frequency',r.frequency);
 v_start:=coalesce((p_data->>'start_on')::date,r.start_on);
 v_person:=case when p_data ? 'person' then nullif(p_data->>'person','')::uuid when p_id is null then auth.uid() else r.person end;
 v_goal:=case when p_data ? 'goal_id' then nullif(p_data->>'goal_id','')::uuid else r.goal_id end;
 if v_direction is distinct from 'saving' then v_goal:=null;end if;
 if v_direction is null or v_direction not in ('income','expense','saving') then raise exception 'Elige si es ingreso, gasto o ahorro';end if;
 if v_frequency is null or v_frequency not in ('weekly','biweekly','monthly','yearly') then raise exception 'Elige cada cuánto se repite';end if;
 if v_start is null then raise exception 'Elige la primera fecha';end if;
 if v_start<private.space_today(sid)-366 then raise exception 'La primera fecha puede ser como mucho de hace un año';end if;
 if v_end is not null and v_end<v_start then raise exception 'El final no puede ser antes de la primera fecha';end if;
 if v_person is not null and not exists(select 1 from public.space_members where space_id=sid and user_id=v_person) then raise exception 'Esa persona no forma parte del espacio';end if;
 if v_goal is not null and not exists(select 1 from public.savings_goals where id=v_goal and space_id=sid and deleted_at is null) then raise exception 'Meta de ahorro no disponible';end if;
 if p_id is null then
  insert into public.finance_recurring(space_id,title,amount,direction,category,frequency,start_on,end_on,next_on,person,goal_id)
  values(sid,v_title,v_amount,v_direction,v_category,v_frequency,v_start,v_end,v_start,v_person,v_goal)
  returning id into rid;
 else
  -- A new frequency or first date re-anchors the schedule after the last movement it registered.
  if v_frequency<>r.frequency or v_start<>r.start_on then
   select max(occurred_on) into last_on from public.entries where details->>'recurring_id'=r.id::text and deleted_at is null;
   r.start_on:=v_start;r.frequency:=v_frequency;r.generated:=0;r.next_on:=v_start;
   while last_on is not null and r.next_on<=last_on loop r.generated:=r.generated+1;r.next_on:=private.recurring_date(r.start_on,r.frequency,r.generated);end loop;
  end if;
  -- Optionally fix the movements already registered (everything but their dates).
  if coalesce((p_data->>'apply_past')::boolean,false) then
   update public.entries set title=v_title,amount=v_amount,
    details=jsonb_strip_nulls((details-'goal_id')||jsonb_build_object('direction',v_direction,'category',v_category,
     'person',coalesce(v_person::text,''),'goal_id',v_goal,'edited_by',auth.uid()))
   where details->>'recurring_id'=r.id::text and kind='transaction' and space_id=sid;
  end if;
  -- Resuming skips the dates missed while paused instead of filling them in.
  if v_active and not r.active then
   today:=private.space_today(sid);
   while r.next_on<today loop r.generated:=r.generated+1;r.next_on:=private.recurring_date(r.start_on,r.frequency,r.generated);end loop;
  end if;
  update public.finance_recurring set title=v_title,amount=v_amount,category=v_category,end_on=v_end,active=v_active,
   direction=v_direction,frequency=r.frequency,start_on=r.start_on,generated=r.generated,next_on=r.next_on,
   person=v_person,goal_id=v_goal,updated_at=now() where id=r.id;
  rid:=r.id;
 end if;
 perform private.generate_recurring(rid);
 return rid;
end $$;
revoke all on function public.save_savings_goal(uuid,jsonb),public.delete_savings_goal(uuid) from public,anon;
grant execute on function public.save_savings_goal(uuid,jsonb),public.delete_savings_goal(uuid) to authenticated;
do $$begin alter publication supabase_realtime add table public.savings_goals; exception when duplicate_object or undefined_object then null;end $$;
notify pgrst,'reload schema';
