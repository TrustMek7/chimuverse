alter table public.calendar_events add column recurrence text[] not null default '{}',add column recurrence_timezone text not null default 'America/Lima';
with changed as(update public.calendar_events set recurrence=array['RRULE:FREQ=YEARLY'] where annual returning id,version) update private.calendar_links l set local_version=c.version from changed c where l.event_id=c.id and l.local_version=c.version-1;
alter table public.calendar_events alter column visibility set default 'shared';
-- Sharing within Chimuverse does not itself change the Google event or send invitations.
with changed as(update public.calendar_events set visibility='shared' where visibility<>'shared' returning id,version)
update private.calendar_links l set local_version=c.version from changed c where l.event_id=c.id and l.local_version=c.version-1;
create function private.validate_calendar_recurrence() returns trigger language plpgsql set search_path='' as $$declare line text;begin
 new.visibility='shared';
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.recurrence_timezone) then raise exception 'Zona horaria inválida';end if;
 if cardinality(new.recurrence)>64 then raise exception 'Demasiadas reglas de repetición';end if;
 foreach line in array new.recurrence loop
  if length(line)>2000 or line !~ '^(RRULE|EXRULE|RDATE|EXDATE)(;[^:]+)?:' or line ~ E'[\n\r]' then raise exception 'Regla de repetición inválida';end if;
 end loop;
 if new.annual and cardinality(new.recurrence)=0 then new.recurrence=array['RRULE:FREQ=YEARLY'];end if;
 new.annual=(new.recurrence=array['RRULE:FREQ=YEARLY']);
 return new;
end $$;
create trigger validate_calendar_recurrence before insert or update on public.calendar_events for each row execute function private.validate_calendar_recurrence();

-- Keep existing service operations; extend the import contract without exposing private credentials.
alter function public.calendar_service(text,uuid,jsonb) set schema private;
alter function private.calendar_service(text,uuid,jsonb) rename to calendar_service_base;
create function public.calendar_service(p_op text,p_uid uuid,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; e public.calendar_events; eid uuid; rules text[];
begin
 if p_op<>'import' then return private.calendar_service_base(p_op,p_uid,p_data);end if;
 select space_id into sid from public.space_members where user_id=p_uid;
 if sid is null then raise exception 'Sin acceso';end if;
 eid=(p_data->>'event_id')::uuid;
 if p_data ? 'recurrence' then select coalesce(array_agg(value),'{}') into rules from jsonb_array_elements_text(p_data->'recurrence');end if;
 if eid is null then
  insert into public.calendar_events(space_id,owner_id,title,description,start_at,end_at,all_day,visibility,sync_google,recurrence,recurrence_timezone) values(sid,p_uid,p_data->>'title',coalesce(p_data->>'description',''),(p_data->>'start_at')::timestamptz,(p_data->>'end_at')::timestamptz,coalesce((p_data->>'all_day')::boolean,false),'shared',true,coalesce(rules,'{}'),coalesce(p_data->>'recurrence_timezone','America/Lima')) returning * into e;
 else
  update public.calendar_events set annual=false,title=coalesce(p_data->>'title',title),description=coalesce(p_data->>'description',description),start_at=coalesce((p_data->>'start_at')::timestamptz,start_at),end_at=coalesce((p_data->>'end_at')::timestamptz,end_at),all_day=coalesce((p_data->>'all_day')::boolean,all_day),recurrence=coalesce(rules,recurrence),recurrence_timezone=coalesce(p_data->>'recurrence_timezone',recurrence_timezone),deleted_at=case when coalesce((p_data->>'deleted')::boolean,false) then now() else null end where id=eid and owner_id=p_uid and space_id=sid returning * into e;
 end if;
 if e.id is null then raise exception 'Evento no autorizado';end if;
 return to_jsonb(e);
end $$;
revoke all on function public.calendar_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.calendar_service(text,uuid,jsonb) to service_role;

create table public.calendar_overrides(id uuid not null unique default gen_random_uuid(),event_id uuid not null references public.calendar_events,google_event_id text not null,original_start timestamptz not null,start_at timestamptz,end_at timestamptz,title text,cancelled boolean not null default false,primary key(event_id,google_event_id));
alter table public.calendar_overrides enable row level security;
create policy read_calendar_overrides on public.calendar_overrides for select to authenticated using(exists(select 1 from public.calendar_events e where e.id=event_id and public.is_member(e.space_id) and e.deleted_at is null));
revoke all on public.calendar_overrides from public,anon,authenticated;
grant select on public.calendar_overrides to authenticated;
create function public.import_calendar_override(p_uid uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.calendar_events where id=(p_data->>'event_id')::uuid and owner_id=p_uid) then raise exception 'Evento no autorizado';end if;
 insert into public.calendar_overrides(event_id,google_event_id,original_start,start_at,end_at,title,cancelled) values((p_data->>'event_id')::uuid,p_data->>'google_event_id',(p_data->>'original_start')::timestamptz,(p_data->>'start_at')::timestamptz,(p_data->>'end_at')::timestamptz,p_data->>'title',coalesce((p_data->>'cancelled')::boolean,false)) on conflict(event_id,google_event_id) do update set original_start=excluded.original_start,start_at=excluded.start_at,end_at=excluded.end_at,title=excluded.title,cancelled=excluded.cancelled;
end $$;
create function public.calendar_invitees(p_uid uuid) returns jsonb language sql security definer set search_path='' as $$select coalesce(jsonb_agg(email),'[]') from private.allowed_emails where exists(select 1 from public.space_members where user_id=p_uid)$$;
revoke all on function public.import_calendar_override(uuid,jsonb),public.calendar_invitees(uuid) from public,anon,authenticated;
grant execute on function public.import_calendar_override(uuid,jsonb),public.calendar_invitees(uuid) to service_role;
