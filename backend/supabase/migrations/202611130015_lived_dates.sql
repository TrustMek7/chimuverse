-- A lived date keeps its memory: the day it happened (past dates allowed, so dates
-- from before Chimuverse can be recorded), an optional vault photo and a short note
-- that is shown on the back of its polaroid. Either member may record or edit it,
-- since both lived it; the idea's author and kind never change.
create function public.complete_date(p_entry_id uuid,p_lived_on date,p_note text default '',p_photo_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare e public.entries; note text:=nullif(trim(coalesce(p_note,'')),'');
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into e from public.entries where id=p_entry_id for update;
 if e.id is null or e.kind<>'date' or e.deleted_at is not null or not public.is_member(e.space_id) then raise exception 'Cita no disponible';end if;
 -- One day of slack: the member's local "today" may be ahead of the server's UTC date.
 if p_lived_on is null or p_lived_on>current_date+1 or p_lived_on<date '2000-01-01' then raise exception 'Elige la fecha en que la vivieron (hoy o antes)';end if;
 if length(coalesce(note,''))>1000 then raise exception 'La descripción admite hasta 1000 caracteres';end if;
 if p_photo_id is not null and not exists(select 1 from public.photos p where p.id=p_photo_id and p.space_id=e.space_id and p.deleted_at is null) then raise exception 'Foto no disponible';end if;
 update public.entries set status='done',occurred_on=p_lived_on,
  details=(details-'memory_note'-'photo_id'-'lived_by')||jsonb_strip_nulls(jsonb_build_object('memory_note',note,'photo_id',p_photo_id,'lived_by',auth.uid()))
 where id=e.id;
 if e.status<>'done' then
  insert into public.notifications(recipient_id,kind,title,path,dedupe_key)
  select m.user_id,'date_lived','Nuevo recuerdo de cita: '||e.title,'/experiencias/citas','date-lived:'||e.id||':'||m.user_id
  from public.space_members m where m.space_id=e.space_id and m.user_id<>auth.uid()
  on conflict(dedupe_key) do nothing;
 end if;
end $$;
revoke all on function public.complete_date(uuid,date,text,uuid) from public,anon;
grant execute on function public.complete_date(uuid,date,text,uuid) to authenticated;
notify pgrst,'reload schema';
