-- All browser-facing authorization is enforced here, independently of React.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.allowed_emails(email text primary key check(email = lower(trim(email))));
create table public.spaces(id uuid primary key default gen_random_uuid(), name text not null default 'Chimuverse', created_at timestamptz not null default now());
insert into public.spaces(id) values ('c1111111-1111-4111-8111-111111111111');
create table public.profiles(id uuid primary key references auth.users on delete cascade, display_name text not null check(length(display_name) between 1 and 80), timezone text not null default 'America/Lima', preferences jsonb not null default '{}', created_at timestamptz not null default now());
create table public.space_members(space_id uuid not null references public.spaces, user_id uuid not null references public.profiles, primary key(space_id,user_id), unique(user_id));

create function public.is_member(sid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.space_members where space_id=sid and user_id=auth.uid())$$;
create function public.same_space(uid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.space_members a join public.space_members b using(space_id) where a.user_id=auth.uid() and b.user_id=uid)$$;
create function private.admit_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.allowed_emails where email=lower(new.email)) then
  perform pg_advisory_xact_lock(1761313);
  if (select count(*) from public.space_members)>=2 then raise exception 'Este espacio ya tiene dos miembros'; end if;
  insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)));
  insert into public.space_members values('c1111111-1111-4111-8111-111111111111',new.id);
 end if;
 return new;
end $$;
create trigger admit_user after insert on auth.users for each row execute function private.admit_user();
create function private.limit_members() returns trigger language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(1761313);
 if (select count(*) from public.space_members where space_id=new.space_id)>=2 then raise exception 'Máximo dos miembros';end if;
 return new;end $$;
create trigger limit_members before insert on public.space_members for each row execute function private.limit_members();

create table public.tasks(id uuid primary key default gen_random_uuid(),space_id uuid not null references public.spaces,created_by uuid not null default auth.uid() references public.profiles,assignee_id uuid references public.profiles,title text not null check(length(trim(title)) between 3 and 80),description text not null default '' check(length(description)<=2000),due_on date not null default current_date,status text not null default 'pending' check(status in ('pending','review','progress','done','rejected','in_talk')),reported_percent int not null default 0 check(reported_percent between 0 and 100),verified_percent int not null default 0 check(verified_percent between 0 and 100),rejections int not null default 0,created_at timestamptz not null default now());
create table public.task_progress(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks,reported_by uuid not null references public.profiles,reported_percent int not null check(reported_percent between 1 and 100),note text not null default '' check(length(note)<=280),state text not null default 'pending' check(state in ('pending','superseded','approved','rejected')),created_at timestamptz not null default now());
create unique index task_one_pending on public.task_progress(task_id) where state='pending';
create table public.task_verifications(id uuid primary key default gen_random_uuid(),progress_id uuid not null unique references public.task_progress,verifier_id uuid not null references public.profiles,decision text not null check(decision in ('approve','partial','reject')),verified_percent int not null check(verified_percent between 0 and 100),reason text not null default '',created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles,kind text not null,title text not null,path text not null default '/',dedupe_key text unique,read_at timestamptz,created_at timestamptz not null default now());

create function public.report_task_progress(p_task_id uuid,p_percent int,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare t public.tasks; pid uuid;
begin
 select * into t from public.tasks where id=p_task_id for update;
 if t.id is null or not public.is_member(t.space_id) then raise exception 'Sin acceso a la tarea';end if;
 if t.assignee_id is not null and t.assignee_id<>auth.uid() then raise exception 'Solo la persona responsable puede reportar';end if;
 if p_percent<=t.verified_percent or p_percent>100 or p_percent is null then raise exception 'El avance debe superar lo verificado y ser como máximo 100';end if;
 if length(p_note)>280 then raise exception 'La nota admite 280 caracteres';end if;
 update public.task_progress set state='superseded' where task_id=t.id and state='pending';
 insert into public.task_progress(task_id,reported_by,reported_percent,note) values(t.id,auth.uid(),p_percent,coalesce(p_note,'')) returning id into pid;
 update public.tasks set reported_percent=p_percent,status='review' where id=t.id;
 insert into public.notifications(recipient_id,kind,title,path,dedupe_key) select user_id,'task_report','Te toca verificar: '||t.title,'/dia/quests/'||t.id,'report:'||pid||':'||user_id from public.space_members where space_id=t.space_id and user_id<>auth.uid();
 return pid;
end $$;
create function public.verify_task_progress(p_progress_id uuid,p_decision text,p_verified_percent int default null,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
declare p public.task_progress;t public.tasks;v int;
begin
 select t0.* into t from public.tasks t0 join public.task_progress p0 on p0.task_id=t0.id where p0.id=p_progress_id for update of t0;
 select * into p from public.task_progress where id=p_progress_id for update;
 if t.id is null or not public.is_member(t.space_id) then raise exception 'Sin acceso al reporte';end if;
 if p.reported_by=auth.uid() then raise exception 'No puedes verificar tu propio reporte';end if;
 if p.state<>'pending' then raise exception 'Este reporte ya fue resuelto o reemplazado';end if;
 if p_decision not in ('approve','partial','reject') or p_decision is null then raise exception 'Decisión inválida';end if;
 if p_decision='reject' and length(trim(coalesce(p_reason,'')))<10 then raise exception 'Explica el motivo en al menos 10 caracteres';end if;
 v:=case when p_decision='approve' then p.reported_percent when p_decision='reject' then t.verified_percent else p_verified_percent end;
 if v is null or v<t.verified_percent or v>p.reported_percent or (p_decision='partial' and v>=p.reported_percent) then raise exception 'El avance verificado debe estar entre el anterior y lo reportado';end if;
 insert into public.task_verifications(progress_id,verifier_id,decision,verified_percent,reason) values(p.id,auth.uid(),p_decision,v,coalesce(p_reason,''));
 update public.task_progress set state=case when p_decision='reject' then 'rejected' else 'approved' end where id=p.id;
 update public.tasks set verified_percent=v,rejections=case when p_decision='reject' then rejections+1 else 0 end,status=case when p_decision='reject' then case when rejections>=1 then 'in_talk' else 'rejected' end when v=100 then 'done' else 'progress' end where id=t.id;
 insert into public.notifications(recipient_id,kind,title,path,dedupe_key) values(p.reported_by,'task_verification',case when p_decision='reject' then 'Revisa el reporte: ' else 'Avance verificado: ' end||t.title,'/dia/quests/'||t.id,'verify:'||p.id);
end $$;

create table public.questions(id uuid primary key default gen_random_uuid(),space_id uuid references public.spaces,created_by uuid default auth.uid() references public.profiles,category text not null,title text not null check(length(title) between 3 and 240),created_at timestamptz not null default now());
insert into public.questions(category,title) values ('Pequeñas cosas','¿Qué pequeño gesto te hace sentir en casa?'),('Sueños','¿Qué lugar te gustaría descubrir conmigo?'),('Nosotros','¿Cuál es tu recuerdo favorito de este año?'),('Gustos','¿Qué canción siempre te pone de buen humor?'),('Cuidado','¿Cómo prefieres que te acompañe en un día difícil?'),('Futuro','¿Qué tradición te gustaría construir juntos?');
create table public.answers(id uuid primary key default gen_random_uuid(),space_id uuid not null references public.spaces,question_id uuid not null references public.questions,respondent_id uuid not null default auth.uid() references public.profiles,answer text not null check(length(trim(answer)) between 1 and 2000),created_at timestamptz not null default now(),unique(question_id,respondent_id));

-- Flexible collection records share visibility, history and validation; money is numeric, not JSON.
create table public.entries(id uuid primary key default gen_random_uuid(),space_id uuid not null references public.spaces,owner_id uuid not null default auth.uid() references public.profiles,kind text not null check(kind in ('journal','mood','date','goal','watch','wish','track','transaction','budget','trip')),title text not null check(length(trim(title)) between 1 and 160),visibility text not null default 'private' check(visibility in ('private','shared','capsule')),status text not null default 'pending' check(status in ('pending','progress','done','archived')),occurred_on date not null default current_date,unlock_at timestamptz,amount numeric(14,2),progress int not null default 0 check(progress between 0 and 100),details jsonb not null default '{}',deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(visibility<>'capsule' or (kind='journal' and unlock_at is not null)),check(kind not in ('transaction','budget') or amount>0));
create table public.entry_bodies(entry_id uuid primary key references public.entries on delete cascade,content text not null default '' check(length(content)<=30000));
create function public.can_read_entry(eid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.entries e where e.id=eid and public.is_member(e.space_id) and (e.owner_id=auth.uid() or e.visibility in ('shared','capsule')) and (e.visibility<>'capsule' or e.unlock_at<=now()))$$;
create function private.guard_entry() returns trigger language plpgsql set search_path='' as $$begin
 if old.visibility='capsule' and old.unlock_at>now() then raise exception 'La cápsula está sellada hasta su apertura';end if;
 if new.owner_id<>old.owner_id or new.space_id<>old.space_id or new.kind<>old.kind or new.created_at<>old.created_at then raise exception 'No se puede cambiar la autoría ni el tipo';end if;
 new.updated_at=now();return new;end $$;
create trigger guard_entry before update on public.entries for each row execute function private.guard_entry();
create function public.save_entry(p_data jsonb,p_content text default '',p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;sid uuid;v text;k text;
begin
 select space_id into sid from public.space_members where user_id=auth.uid();
 if sid is null then raise exception 'Sin acceso';end if;
 v:=coalesce(p_data->>'visibility','private');k:=p_data->>'kind';
 if v='capsule' and ((p_data->>'unlock_at')::timestamptz is null or (p_data->>'unlock_at')::timestamptz<=now()) then raise exception 'La apertura debe ser futura';end if;
 if p_id is null then
 insert into public.entries(space_id,kind,title,visibility,status,occurred_on,unlock_at,amount,progress,details) values(sid,k,p_data->>'title',v,coalesce(p_data->>'status','pending'),coalesce((p_data->>'occurred_on')::date,current_date),(p_data->>'unlock_at')::timestamptz,(p_data->>'amount')::numeric,coalesce((p_data->>'progress')::int,0),coalesce(p_data->'details','{}')) returning id into eid;
 else
 perform 1 from public.entries where id=p_id and owner_id=auth.uid() and space_id=sid for update;
 if not found then raise exception 'No puedes editar esta entrada';end if;
 update public.entries set title=p_data->>'title',visibility=v,status=coalesce(p_data->>'status','pending'),occurred_on=coalesce((p_data->>'occurred_on')::date,current_date),unlock_at=(p_data->>'unlock_at')::timestamptz,amount=(p_data->>'amount')::numeric,progress=coalesce((p_data->>'progress')::int,0),details=coalesce(p_data->'details','{}') where id=p_id returning id into eid;
 end if;
 insert into public.entry_bodies values(eid,coalesce(p_content,'')) on conflict(entry_id) do update set content=excluded.content;
 if v='shared' and p_id is null then insert into public.notifications(recipient_id,kind,title,path,dedupe_key) select user_id,k,'Nuevo momento compartido: '||(p_data->>'title'),case k when 'journal' then '/recuerdos/devlog' when 'goal' then '/creciendo/metas' else '/' end,'entry:'||eid||':'||user_id from public.space_members where space_id=sid and user_id<>auth.uid();end if;
 return eid;
end $$;

create table public.calendar_events(id uuid primary key default gen_random_uuid(),space_id uuid not null references public.spaces,owner_id uuid not null default auth.uid() references public.profiles,title text not null check(length(trim(title)) between 1 and 160),description text not null default '',start_at timestamptz not null,end_at timestamptz not null,all_day boolean not null default false,visibility text not null default 'private' check(visibility in ('private','shared')),kind text not null default 'event' check(kind in ('event','special','reminder')),annual boolean not null default false,sync_google boolean not null default false,version int not null default 1,updated_at timestamptz not null default now(),deleted_at timestamptz,created_at timestamptz not null default now(),check(end_at>start_at));
create function private.event_version() returns trigger language plpgsql set search_path='' as $$begin new.version=old.version+1;new.updated_at=now();if new.owner_id<>old.owner_id or new.space_id<>old.space_id then raise exception 'Autoría inmutable';end if;return new;end $$;
create trigger event_version before update on public.calendar_events for each row execute function private.event_version();
create table public.photos(id uuid primary key default gen_random_uuid(),space_id uuid not null references public.spaces,uploaded_by uuid not null default auth.uid() references public.profiles,title text not null check(length(title) between 1 and 160),storage_path text not null unique,thumb_path text not null,captured_at timestamptz not null,captured_at_source text not null check(captured_at_source in ('exif','manual')),uploaded_at timestamptz not null default now(),visibility text not null default 'private' check(visibility in ('private','shared')),trip_id uuid references public.entries,size_bytes bigint not null check(size_bytes>0 and size_bytes<=26214400),width int not null,height int not null,deleted_at timestamptz,check(storage_path=space_id::text||'/'||id::text||'/full.webp'),check(thumb_path=space_id::text||'/'||id::text||'/thumb.webp'));

create table private.google_connections(user_id uuid primary key references public.profiles,encrypted_refresh_token text not null,calendar_id text not null,status text not null default 'connected',sync_token text,last_sync_at timestamptz,last_error text);
create table private.oauth_states(state text primary key,user_id uuid not null references public.profiles,code_verifier text not null,redirect_uri text not null,expires_at timestamptz not null default now()+interval '10 minutes');
create table private.calendar_links(event_id uuid not null references public.calendar_events,user_id uuid not null references public.profiles,google_event_id text not null,etag text,local_version int not null default 0,remote_updated timestamptz,primary key(event_id,user_id));
create table public.calendar_conflicts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,event_id uuid not null references public.calendar_events,remote_event jsonb not null,resolved_at timestamptz,created_at timestamptz not null default now(),unique(user_id,event_id));
create function public.google_status() returns jsonb language sql stable security definer set search_path='' as $$select coalesce((select jsonb_build_object('status',status,'last_sync_at',last_sync_at,'last_error',last_error) from private.google_connections where user_id=auth.uid()),'{"status":"disconnected"}'::jsonb)$$;

-- Read policies never leak a partner's private records or sealed capsule body.
alter table public.spaces enable row level security;
create policy members on public.spaces for select to authenticated using(public.is_member(id));
alter table public.space_members enable row level security;
create policy members on public.space_members for select to authenticated using(public.is_member(space_id));
alter table public.profiles enable row level security;
create policy read_profiles on public.profiles for select to authenticated using(public.same_space(id));
create policy edit_profile on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.tasks enable row level security;
create policy read_tasks on public.tasks for select to authenticated using(public.is_member(space_id));
create policy create_task on public.tasks for insert to authenticated with check(public.is_member(space_id) and created_by=auth.uid() and (assignee_id is null or public.same_space(assignee_id)) and status='pending' and reported_percent=0 and verified_percent=0 and rejections=0);
alter table public.task_progress enable row level security;
create policy read_progress on public.task_progress for select to authenticated using(exists(select 1 from public.tasks where tasks.id=task_id and public.is_member(space_id)));
alter table public.task_verifications enable row level security;
create policy read_verifications on public.task_verifications for select to authenticated using(exists(select 1 from public.task_progress p join public.tasks t on t.id=p.task_id where p.id=progress_id and public.is_member(t.space_id)));
alter table public.notifications enable row level security;
create policy read_notifications on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy mark_notifications on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
alter table public.questions enable row level security;
create policy read_questions on public.questions for select to authenticated using(space_id is null or public.is_member(space_id));
create policy create_questions on public.questions for insert to authenticated with check(public.is_member(space_id) and created_by=auth.uid());
alter table public.answers enable row level security;
create policy read_answers on public.answers for select to authenticated using(public.is_member(space_id));
create policy create_answers on public.answers for insert to authenticated with check(public.is_member(space_id) and respondent_id=auth.uid() and exists(select 1 from public.questions q where q.id=question_id and (q.space_id is null or q.space_id=answers.space_id)));
create policy edit_answers on public.answers for update to authenticated using(respondent_id=auth.uid() and public.is_member(space_id)) with check(respondent_id=auth.uid() and public.is_member(space_id));
alter table public.entries enable row level security;
create policy read_entries on public.entries for select to authenticated using(public.is_member(space_id) and (owner_id=auth.uid() or visibility in ('shared','capsule')));
-- Writes to entries and their bodies go through save_entry; no direct browser writes.
alter table public.entry_bodies enable row level security;
create policy read_bodies on public.entry_bodies for select to authenticated using(public.can_read_entry(entry_id));
alter table public.calendar_events enable row level security;
create policy read_events on public.calendar_events for select to authenticated using(public.is_member(space_id) and (owner_id=auth.uid() or visibility='shared'));
create policy create_events on public.calendar_events for insert to authenticated with check(public.is_member(space_id) and owner_id=auth.uid());
create policy edit_events on public.calendar_events for update to authenticated using(public.is_member(space_id) and owner_id=auth.uid()) with check(public.is_member(space_id) and owner_id=auth.uid());
alter table public.photos enable row level security;
create policy read_photos on public.photos for select to authenticated using(public.is_member(space_id) and (uploaded_by=auth.uid() or visibility='shared'));
create policy create_photos on public.photos for insert to authenticated with check(public.is_member(space_id) and uploaded_by=auth.uid() and (trip_id is null or exists(select 1 from public.entries e where e.id=trip_id and e.kind='trip' and e.space_id=photos.space_id)));
create policy edit_photos on public.photos for update to authenticated using(public.is_member(space_id) and uploaded_by=auth.uid()) with check(public.is_member(space_id) and uploaded_by=auth.uid());
alter table public.calendar_conflicts enable row level security;
create policy read_conflicts on public.calendar_conflicts for select to authenticated using(user_id=auth.uid());

create function public.trash_item(p_table text,p_id uuid,p_restore boolean default false) returns void language plpgsql security definer set search_path='' as $$begin
 if p_table='entries' then update public.entries set deleted_at=case when p_restore then null else now() end where id=p_id and owner_id=auth.uid() and public.is_member(space_id);
 elsif p_table='photos' then update public.photos set deleted_at=case when p_restore then null else now() end where id=p_id and uploaded_by=auth.uid() and public.is_member(space_id);
 elsif p_table='calendar_events' then update public.calendar_events set deleted_at=case when p_restore then null else now() end where id=p_id and owner_id=auth.uid() and public.is_member(space_id);
 else raise exception 'Colección inválida';end if;
 if not found then raise exception 'Sin acceso';end if;end $$;

-- RLS and grants are both required. Internal helpers and future functions are not public RPCs.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.spaces,public.space_members,public.profiles,public.tasks,public.task_progress,public.task_verifications,public.notifications,public.questions,public.answers,public.entries,public.entry_bodies,public.calendar_events,public.photos,public.calendar_conflicts to authenticated;
grant insert on public.tasks,public.questions,public.answers,public.calendar_events,public.photos to authenticated;
grant update on public.answers,public.calendar_events to authenticated;
grant update(display_name,timezone,preferences) on public.profiles to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant update(title,visibility,trip_id,deleted_at) on public.photos to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_member(uuid),public.same_space(uuid),public.can_read_entry(uuid),public.report_task_progress(uuid,int,text),public.verify_task_progress(uuid,text,int,text),public.save_entry(jsonb,text,uuid),public.google_status(),public.trash_item(text,uuid,boolean) to authenticated;
grant usage on schema public to authenticated;
grant all on all tables in schema private to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
create index entries_space_kind on public.entries(space_id,kind,occurred_on desc);
create index tasks_space_day on public.tasks(space_id,due_on);
create index progress_task on public.task_progress(task_id,created_at desc);
create index events_space_start on public.calendar_events(space_id,start_at);
create index photos_space_capture on public.photos(space_id,captured_at desc);
create index notification_recipient on public.notifications(recipient_id,created_at desc);
