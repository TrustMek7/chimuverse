-- Daily tasks keep a record instead of disappearing silently:
-- * a task that is not finished is carried to another day with a reason (it keeps its progress);
--   if nobody moved it and its day ended, the scheduler carries it to the current day by itself;
-- * either member can edit a task; its day only changes through "carry to another day"
--   (with a reason), except to fix the date of a task created today that has no progress yet;
-- * a task that no longer makes sense is discarded with a reason (recoverable), never deleted;
-- * the verified progress can be adjusted (or reset) with a reason by whoever reviews the task,
--   never by the person it is assigned to;
-- * finished tasks (100 % verified) leave the daily list and stay in the history, with the
--   moment they were completed.
-- Every change lands in task_events, which is read-only for clients.
alter table public.tasks drop constraint tasks_status_check;
alter table public.tasks add constraint tasks_status_check check(status in ('pending','review','progress','done','rejected','in_talk','discarded'));
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
-- Discarded and finished tasks take no new reports.
create function private.guard_task_report() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.tasks where id=new.task_id and status in ('done','discarded')) then
  raise exception 'Esta tarea ya no admite reportes';end if;
 return new;
end $$;
create trigger guard_task_report before insert on public.task_progress for each row execute function private.guard_task_report();

create table public.task_events(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks on delete cascade,
 actor_id uuid references public.profiles, -- null: moved automatically by the scheduler
 kind text not null check(kind in ('postpone','edit','carry','discard','restore','progress')),
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

-- Shared checks: the task exists in the caller's space and is still open.
create function private.open_task(p_task_id uuid) returns public.tasks language plpgsql security definer set search_path='' as $$
declare t public.tasks;
begin
 select * into t from public.tasks where id=p_task_id for update;
 if t.id is null or not public.is_member(t.space_id) then raise exception 'Tarea no disponible';end if;
 if t.status='done' then raise exception 'La tarea ya está completada y es parte del historial';end if;
 if t.status='discarded' then raise exception 'La tarea está descartada; recupérala primero';end if;
 return t;
end $$;
create function private.task_reason(p_reason text) returns text language plpgsql immutable set search_path='' as $$
declare r text:=trim(coalesce(p_reason,''));
begin
 if length(r)<5 then raise exception 'Cuenta el motivo en al menos 5 caracteres';end if;
 if length(r)>500 then raise exception 'El motivo admite hasta 500 caracteres';end if;
 return r;
end $$;
create function private.tell_partner(t public.tasks,p_kind text,p_title text) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(recipient_id,kind,title,path)
 select m.user_id,p_kind,p_title,'/dia/quests/'||t.id from public.space_members m where m.space_id=t.space_id and m.user_id<>auth.uid()
$$;
-- A task's day can be fixed freely only on the day it was created, before any progress or move.
create function public.task_date_editable(p_task_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t join public.profiles p on p.id=auth.uid()
  where t.id=p_task_id and public.is_member(t.space_id) and t.reported_percent=0 and t.verified_percent=0
  and (t.created_at at time zone coalesce(p.timezone,'America/Lima'))::date=(now() at time zone coalesce(p.timezone,'America/Lima'))::date
  and not exists(select 1 from public.task_events e where e.task_id=t.id and e.kind in ('postpone','carry')))
$$;

create function public.postpone_task(p_task_id uuid,p_to date,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks:=private.open_task(p_task_id);r text:=private.task_reason(p_reason);
begin
 if p_to is null or p_to<=t.due_on then raise exception 'Elige un día posterior a la fecha actual de la tarea';end if;
 if p_to>t.due_on+365 then raise exception 'Elige un día dentro del próximo año';end if;
 update public.tasks set due_on=p_to where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,from_date,to_date,reason) values(t.id,auth.uid(),'postpone',t.due_on,p_to,r);
 perform private.tell_partner(t,'task_postponed','Pasó a otro día: '||t.title);
end $$;

create function public.edit_task(p_task_id uuid,p_title text,p_description text,p_assignee_id uuid,p_due_on date) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks:=private.open_task(p_task_id);c jsonb:='{}';v_title text:=trim(coalesce(p_title,''));v_descr text:=coalesce(p_description,'');
begin
 if length(v_title) not between 3 and 80 then raise exception 'El título debe tener entre 3 y 80 caracteres';end if;
 if length(v_descr)>2000 then raise exception 'La descripción admite hasta 2000 caracteres';end if;
 if p_due_on is null then raise exception 'Elige una fecha';end if;
 if p_due_on<>t.due_on and not public.task_date_editable(t.id) then raise exception 'Para cambiar el día usa «Pasar a otro día» y cuenta el motivo';end if;
 if p_assignee_id is not null and not exists(select 1 from public.space_members where space_id=t.space_id and user_id=p_assignee_id) then raise exception 'Esa persona no forma parte del espacio';end if;
 if v_title<>t.title then c:=c||jsonb_build_object('title',jsonb_build_array(t.title,v_title));end if;
 if v_descr<>t.description then c:=c||jsonb_build_object('description',true);end if;
 if p_assignee_id is distinct from t.assignee_id then c:=c||jsonb_build_object('assignee_id',jsonb_build_array(t.assignee_id,p_assignee_id));end if;
 if p_due_on<>t.due_on then c:=c||jsonb_build_object('due_on',jsonb_build_array(t.due_on,p_due_on));end if;
 if c='{}'::jsonb then return;end if;
 update public.tasks set title=v_title,description=v_descr,assignee_id=p_assignee_id,due_on=p_due_on where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,from_date,to_date,changes)
 values(t.id,auth.uid(),'edit',t.due_on,case when p_due_on<>t.due_on then p_due_on end,c);
 perform private.tell_partner(t,'task_edited','Se editó una tarea: '||v_title);
end $$;

create function public.discard_task(p_task_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks:=private.open_task(p_task_id);r text:=private.task_reason(p_reason);
begin
 update public.task_progress set state='superseded' where task_id=t.id and state='pending';
 update public.tasks set status='discarded' where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,reason,changes) values(t.id,auth.uid(),'discard',r,jsonb_build_object('status',t.status));
 perform private.tell_partner(t,'task_discarded','Se descartó una tarea: '||t.title);
end $$;

create function public.restore_task(p_task_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks;today date;
begin
 select * into t from public.tasks where id=p_task_id for update;
 if t.id is null or not public.is_member(t.space_id) then raise exception 'Tarea no disponible';end if;
 if t.status<>'discarded' then raise exception 'Solo se recuperan tareas descartadas';end if;
 select (now() at time zone coalesce(timezone,'America/Lima'))::date into today from public.profiles where id=auth.uid();
 update public.tasks set status=case when verified_percent>0 then 'progress' else 'pending' end,
  reported_percent=verified_percent,due_on=greatest(due_on,today) where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,from_date,to_date) values(t.id,auth.uid(),'restore',t.due_on,greatest(t.due_on,today));
 perform private.tell_partner(t,'task_restored','Se recuperó una tarea: '||t.title);
end $$;

-- Whoever reviews the task adjusts its verified progress; the assignee cannot grade themself.
-- 100 % is reached only through a report and its confirmed approval.
create function public.adjust_task_progress(p_task_id uuid,p_percent int,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks:=private.open_task(p_task_id);r text:=private.task_reason(p_reason);pending boolean;
begin
 if t.assignee_id=auth.uid() then raise exception 'El avance de tus tareas lo ajusta tu pareja';end if;
 if p_percent is null or p_percent<0 or p_percent>99 then raise exception 'El avance ajustado va de 0 a 99 %%; el 100 %% se aprueba desde un reporte';end if;
 if p_percent=t.verified_percent then raise exception 'El avance ya es % %%',p_percent;end if;
 pending:=exists(select 1 from public.task_progress where task_id=t.id and state='pending');
 update public.tasks set verified_percent=p_percent,
  reported_percent=case when pending then greatest(reported_percent,p_percent) else p_percent end,
  status=case when pending then 'review' when p_percent=0 then 'pending' else 'progress' end
 where id=t.id;
 insert into public.task_events(task_id,actor_id,kind,reason,changes)
 values(t.id,auth.uid(),'progress',r,jsonb_build_object('verified_percent',jsonb_build_array(t.verified_percent,p_percent)));
 perform private.tell_partner(t,'task_progress_adjusted','Se ajustó el avance: '||t.title);
end $$;

-- Run by the scheduler: an unfinished task whose day already ended (in every member's time
-- zone) moves to the current day by itself, so nothing is lost on a day nobody opens the app.
-- Only finished tasks reach the history; discarded ones stay where they were.
create function public.carry_over_tasks() returns int language plpgsql security definer set search_path='' as $$
declare r record;n int:=0;
begin
 for r in
  select t.id,t.due_on,x.today from public.tasks t
  join (select m.space_id,min((now() at time zone coalesce(p.timezone,'America/Lima'))::date) today
        from public.space_members m join public.profiles p on p.id=m.user_id group by m.space_id) x on x.space_id=t.space_id
  where t.status not in ('done','discarded') and t.due_on<x.today
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
revoke all on function private.open_task(uuid),private.tell_partner(public.tasks,text,text) from public,anon,authenticated;
revoke all on function public.postpone_task(uuid,date,text),public.edit_task(uuid,text,text,uuid,date),public.discard_task(uuid,text),public.restore_task(uuid),public.adjust_task_progress(uuid,int,text),public.task_date_editable(uuid) from public,anon;
grant execute on function public.postpone_task(uuid,date,text),public.edit_task(uuid,text,text,uuid,date),public.discard_task(uuid,text),public.restore_task(uuid),public.adjust_task_progress(uuid,int,text),public.task_date_editable(uuid) to authenticated;
do $$begin alter publication supabase_realtime add table public.task_events; exception when duplicate_object or undefined_object then null;end $$;
notify pgrst,'reload schema';
