alter table public.entries add column calendar_event_id uuid references public.calendar_events on delete set null;
create function public.schedule_date(p_entry_id uuid,p_start_at timestamptz,p_end_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.entries; event_id uuid; zone text;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if p_start_at is null or p_end_at is null or p_end_at<=p_start_at then raise exception 'Elige un horario de inicio y fin válido';end if;
 select timezone into zone from public.profiles where id=auth.uid();
 select * into e from public.entries where id=p_entry_id for update;
 if e.id is null or e.kind<>'date' or e.deleted_at is not null or not public.is_member(e.space_id) then raise exception 'Cita no disponible';end if;
 event_id:=e.calendar_event_id;
 if event_id is null then
  insert into public.calendar_events(space_id,owner_id,title,description,start_at,end_at,visibility,kind,recurrence_timezone)
  values(e.space_id,auth.uid(),e.title,'Cita de Chimuverse: '||e.title,p_start_at,p_end_at,'shared','event',coalesce(zone,'America/Lima')) returning id into event_id;
  update public.entries set calendar_event_id=event_id where id=e.id;
 else
  update public.calendar_events set title=e.title,start_at=p_start_at,end_at=p_end_at,deleted_at=null
  where id=event_id and space_id=e.space_id;
  if not found then raise exception 'Evento vinculado no disponible';end if;
 end if;
 return event_id;
end $$;
revoke all on function public.schedule_date(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.schedule_date(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
