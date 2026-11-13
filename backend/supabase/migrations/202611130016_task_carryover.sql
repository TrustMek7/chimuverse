-- Daily tasks keep a record instead of disappearing silently:
-- * a task that is not finished is carried to another day with a reason (it keeps its progress);
--   if nobody moved it and its day ended, the scheduler carries it to the current day by itself;
-- * either member can edit a task that is not finished yet;
-- * finished tasks (100 % verified) leave the daily list and stay in the history, with the
--   moment they were completed.
-- Every change lands in task_events, which is read-only for clients.
alter table public.tasks add column completed_at timestamptz;
update public.tasks t set completed_at=coalesce((
  select max(v.created_at) from public.task_verifications v join public.task_progress p on p.id=v.progress_id
  where p.task_id=t.id and v.verified_percent=100),t.created_at)
where t.status='done';
create function private.stamp_task_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='done' and old.status<>'done' then new.completed_at:=now();
 elsif new.status<>'done' then new.completed_at:=null;end if;
 return new;
end $$;
create trigger stamp_task_completion before update on public.tasks for each row execute function private.stamp_task_completion();

create table public.task_events(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks on delete cascade,
 actor_id uuid references public.profiles, -- null: moved automatically by the scheduler
 kind text not null check(kind in ('postpone','edit','carry')),
 check(kind='carry' or actor_id is not null),
 from_date date,
 to_date date,
 reason text not null default '' check(length(reason)<=500),
 changes jsonb not null default '{}',
 created_at timestamptz not null default now());
create index task_events_task on public.task_events(task_id,created_at);
alter table public.task_events enable row level security;
create policy read_task_events on public.task_events for select to authenticated
 using(exists(select 1 from public.tasks t where t.id=task_id and public.is_member(t.space_id)));
grant select on public.task_events to authenticated;

create function public.postpone_task(p_task_id uuid,p_to date,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks;r text:=trim(coalesce(p_reason,''));
begin
 select * into t from public.tasks where id=p_task_id for update;
 if t.id is null or not public.is_member(t.space_id) then raise exception 'Tarea no disponible';end if;
 if t.status='done' then raise exception 'La tarea ya está completada';end if;
 if p_to is null or p_to<=t.due_on then raise exception 'Elige un día posterior a la fecha actual de la tarea';end if;
 if p_to>t.due_on+365 then raise exception 'Elige un día dentro del próximo año';end if;
 if length(r)<5 then raise exception 'Cuenta el motivo en al menos 5 caracteres';end if;
 if length(r)>500 then raise exception 'El motivo admite hasta 500 caracteres';end if;
 update public.tasks set due_on=p_to where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,from_date,to_date,reason) values(t.id,auth.uid(),'postpone',t.due_on,p_to,r);
 insert into public.notifications(recipient_id,kind,title,path,dedupe_key)
 select m.user_id,'task_postponed','Pasó a otro día: '||t.title,'/dia/quests/'||t.id,'postpone:'||t.id||':'||p_to||':'||m.user_id
 from public.space_members m where m.space_id=t.space_id and m.user_id<>auth.uid()
 on conflict(dedupe_key) do nothing;
end $$;

create function public.edit_task(p_task_id uuid,p_title text,p_description text,p_assignee_id uuid,p_due_on date) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks;c jsonb:='{}';v_title text:=trim(coalesce(p_title,''));v_descr text:=coalesce(p_description,'');
begin
 select * into t from public.tasks where id=p_task_id for update;
 if t.id is null or not public.is_member(t.space_id) then raise exception 'Tarea no disponible';end if;
 if t.status='done' then raise exception 'Una tarea completada ya es parte del historial';end if;
 if length(v_title) not between 3 and 80 then raise exception 'El título debe tener entre 3 y 80 caracteres';end if;
 if length(v_descr)>2000 then raise exception 'La descripción admite hasta 2000 caracteres';end if;
 if p_due_on is null then raise exception 'Elige una fecha';end if;
 if p_assignee_id is not null and not exists(select 1 from public.space_members where space_id=t.space_id and user_id=p_assignee_id) then raise exception 'Esa persona no forma parte del espacio';end if;
 if v_title<>t.title then c:=c||jsonb_build_object('title',jsonb_build_array(t.title,v_title));end if;
 if v_descr<>t.description then c:=c||jsonb_build_object('description',true);end if;
 if p_assignee_id is distinct from t.assignee_id then c:=c||jsonb_build_object('assignee_id',jsonb_build_array(t.assignee_id,p_assignee_id));end if;
 if p_due_on<>t.due_on then c:=c||jsonb_build_object('due_on',jsonb_build_array(t.due_on,p_due_on));end if;
 if c='{}'::jsonb then return;end if;
 update public.tasks set title=v_title,description=v_descr,assignee_id=p_assignee_id,due_on=p_due_on where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,from_date,to_date,changes)
 values(t.id,auth.uid(),'edit',t.due_on,case when p_due_on<>t.due_on then p_due_on end,c);
 insert into public.notifications(recipient_id,kind,title,path)
 select m.user_id,'task_edited','Se editó una tarea: '||v_title,'/dia/quests/'||t.id
 from public.space_members m where m.space_id=t.space_id and m.user_id<>auth.uid();
end $$;
-- Run by the scheduler: an unfinished task whose day already ended (in every member's time
-- zone) moves to the current day by itself, so nothing is lost on a day nobody opens the app.
-- Only finished tasks reach the history.
create function public.carry_over_tasks() returns int language plpgsql security definer set search_path='' as $$
declare r record;n int:=0;
begin
 for r in
  select t.id,t.due_on,x.today from public.tasks t
  join (select m.space_id,min((now() at time zone coalesce(p.timezone,'America/Lima'))::date) today
        from public.space_members m join public.profiles p on p.id=m.user_id group by m.space_id) x on x.space_id=t.space_id
  where t.status<>'done' and t.due_on<x.today
  for update of t
 loop
  update public.tasks set due_on=r.today where id=r.id;
  insert into public.task_events(task_id,actor_id,kind,from_date,to_date,reason)
  values(r.id,null,'carry',r.due_on,r.today,'No se completó ni se movió ese día; pasó sola al siguiente.');
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.carry_over_tasks() from public,anon,authenticated;
grant execute on function public.carry_over_tasks() to service_role;
revoke all on function public.postpone_task(uuid,date,text),public.edit_task(uuid,text,text,uuid,date) from public,anon;
grant execute on function public.postpone_task(uuid,date,text),public.edit_task(uuid,text,text,uuid,date) to authenticated;
do $$begin alter publication supabase_realtime add table public.task_events; exception when duplicate_object or undefined_object then null;end $$;
notify pgrst,'reload schema';
