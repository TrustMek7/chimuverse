drop policy read_entries on public.entries;
drop policy read_questions on public.questions;
create policy read_questions on public.questions for select to authenticated using(public.is_member(space_id) or (space_id is null and exists(select 1 from public.space_members where user_id=auth.uid())));
revoke update on public.answers from authenticated;
grant update(answer) on public.answers to authenticated;
create policy read_entries on public.entries for select to authenticated using(public.is_member(space_id) and (owner_id=auth.uid() or (visibility in ('shared','capsule') and deleted_at is null)));
create or replace function public.can_read_entry(eid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.entries e where e.id=eid and public.is_member(e.space_id) and (e.owner_id=auth.uid() or (e.visibility in ('shared','capsule') and e.kind<>'mood' and e.deleted_at is null)) and (e.visibility<>'capsule' or e.unlock_at<=now()))$$;
drop policy read_events on public.calendar_events;
create policy read_events on public.calendar_events for select to authenticated using(public.is_member(space_id) and (owner_id=auth.uid() or (visibility='shared' and deleted_at is null)));
drop policy read_photos on public.photos;
create policy read_photos on public.photos for select to authenticated using(public.is_member(space_id) and (uploaded_by=auth.uid() or (visibility='shared' and deleted_at is null)));
create function private.validate_profile() returns trigger language plpgsql set search_path='' as $$begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Zona horaria no válida';end if;
 if octet_length(new.preferences::text)>10000 then raise exception 'El perfil supera el tamaño permitido';end if;
 return new;
end $$;
create trigger validate_profile before insert or update on public.profiles for each row execute function private.validate_profile();
create function private.validate_entry_data() returns trigger language plpgsql set search_path='' as $$begin
 if octet_length(new.details::text)>16000 then raise exception 'El contenido supera el tamaño permitido';end if;
 if new.kind='mood' and coalesce(new.details->>'mood','') not in ('radiante','bien','tranquilo','bajo','dificil') then raise exception 'Estado de ánimo inválido';end if;
 if new.kind='transaction' and coalesce(new.details->>'direction','') not in ('income','expense','saving') then raise exception 'Tipo de movimiento inválido';end if;
 if new.kind='journal' and new.details->>'subtype'='note_for_partner' and new.visibility<>'shared' then raise exception 'Una nota para tu pareja debe ser compartida';end if;
 return new;
end $$;
create trigger validate_entry_data before insert or update on public.entries for each row execute function private.validate_entry_data();
create function private.guard_photo() returns trigger language plpgsql set search_path='' as $$begin
 if new.trip_id is not null and not exists(select 1 from public.entries e where e.id=new.trip_id and e.kind='trip' and e.space_id=new.space_id and (e.owner_id=new.uploaded_by or e.visibility='shared') and e.deleted_at is null) then raise exception 'Álbum no disponible';end if;
 return new;
end $$;
create trigger guard_photo before insert or update on public.photos for each row execute function private.guard_photo();
-- Idempotent reminders, meant to be called by the scheduler (never the browser).
create function public.enqueue_reminders() returns int language plpgsql security definer set search_path='' as $$declare n int;begin
 insert into public.notifications(recipient_id,kind,title,path,dedupe_key)
 select m.user_id,'task_reminder','Sigue pendiente de verificar: '||t.title,'/dia/quests/'||t.id,'reminder:'||p.id||':'||h.hours from public.task_progress p join public.tasks t on t.id=p.task_id join public.space_members m on m.space_id=t.space_id cross join (values(24),(72)) as h(hours) where p.state='pending' and p.reported_by<>m.user_id and p.created_at<=now()-make_interval(hours=>h.hours) on conflict(dedupe_key) do nothing;
 get diagnostics n=row_count;
 insert into public.notifications(recipient_id,kind,title,path,dedupe_key)
 select m.user_id,'event_reminder','Pronto: '||e.title,'/dia/calendario','event-reminder:'||e.id||':'||m.user_id||':'||e.version from public.calendar_events e join public.space_members m on m.space_id=e.space_id where e.deleted_at is null and e.start_at between now() and now()+interval '1 hour' and (e.visibility='shared' or e.owner_id=m.user_id) on conflict(dedupe_key) do nothing;
 return n;
end $$;
revoke all on function public.enqueue_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_reminders() to service_role;
