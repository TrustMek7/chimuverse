-- Wishlist items and our shared calendar belong to both members. Either member
-- can edit or trash them; personal notes, mood records and other collections
-- retain their existing ownership rules.
create or replace function public.save_entry(p_data jsonb,p_content text default '',p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.entries;v_status text;
begin
 if p_id is not null then
  select * into e from public.entries where id=p_id for update;
  if e.id is not null and e.owner_id<>auth.uid() and e.kind in ('transaction','budget','date') then
   if not public.is_member(e.space_id) or e.deleted_at is not null then raise exception 'No puedes editar esta entrada';end if;
   if coalesce(p_data->>'kind',e.kind)<>e.kind then raise exception 'No se puede cambiar el tipo';end if;
   update public.entries set title=p_data->>'title',occurred_on=coalesce((p_data->>'occurred_on')::date,e.occurred_on),
    amount=(p_data->>'amount')::numeric,details=coalesce(p_data->'details','{}')||jsonb_build_object('edited_by',auth.uid())
   where id=e.id;
   insert into public.entry_bodies values(e.id,coalesce(p_content,'')) on conflict(entry_id) do update set content=excluded.content;
   return e.id;
  end if;
  if e.id is not null and e.owner_id<>auth.uid() and e.kind='watch' then
   if not public.is_member(e.space_id) or e.deleted_at is not null then raise exception 'No puedes editar esta entrada';end if;
   if coalesce(p_data->>'kind',e.kind)<>e.kind then raise exception 'No se puede cambiar el tipo';end if;
   v_status:=coalesce(p_data->>'status','');
   if v_status not in ('pending','progress','done') then raise exception 'Estado no válido';end if;
   update public.entries set status=v_status where id=e.id;
   return e.id;
  end if;
  if e.id is not null and e.owner_id<>auth.uid() and e.kind='wish' then
   if not public.is_member(e.space_id) or e.deleted_at is not null then raise exception 'No puedes editar este deseo';end if;
   if coalesce(p_data->>'kind',e.kind)<>e.kind then raise exception 'No se puede cambiar el tipo';end if;
   v_status:=coalesce(p_data->>'status',e.status);
   if v_status not in ('pending','done') then raise exception 'Estado no válido';end if;
   update public.entries set title=p_data->>'title',status=v_status,
    occurred_on=coalesce((p_data->>'occurred_on')::date,e.occurred_on),
    details=coalesce(p_data->'details','{}')||jsonb_build_object('edited_by',auth.uid())
   where id=e.id;
   insert into public.entry_bodies values(e.id,coalesce(p_content,'')) on conflict(entry_id) do update set content=excluded.content;
   return e.id;
  end if;
 end if;
 return private.save_entry_base(p_data||jsonb_build_object('visibility',case when p_data->>'visibility'='capsule' then 'capsule' else 'shared' end),p_content,p_id);
end $$;

-- Events are shared between the only two members. Keep owner and space immutable
-- through the existing trigger; either member's edits queue export for the owner.
drop policy edit_events on public.calendar_events;
create policy edit_events on public.calendar_events for update to authenticated
 using(public.is_member(space_id)) with check(public.is_member(space_id));
drop policy read_events on public.calendar_events;
create policy read_events on public.calendar_events for select to authenticated
 using(public.is_member(space_id) and (owner_id=auth.uid() or visibility='shared'));
drop policy read_entries on public.entries;
create policy read_entries on public.entries for select to authenticated using(public.is_member(space_id)
 and (owner_id=auth.uid() or (visibility in ('shared','capsule') and deleted_at is null) or kind in ('transaction','budget','date','wish')));

create or replace function public.trash_item(p_table text,p_id uuid,p_restore boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;q public.questions;
begin
 if p_table='entries' then
  update public.entries set deleted_at=case when p_restore then null else now() end
   where id=p_id and (owner_id=auth.uid() or kind in ('transaction','budget','date','wish')) and public.is_member(space_id);
 elsif p_table='photos' then
  update public.photos set deleted_at=case when p_restore then null else now() end where id=p_id and uploaded_by=auth.uid() and public.is_member(space_id);
 elsif p_table='calendar_events' then
  update public.calendar_events set deleted_at=case when p_restore then null else now() end where id=p_id and public.is_member(space_id);
 elsif p_table='questions' then
  select space_id into sid from public.space_members where user_id=auth.uid();
  select * into q from public.questions where id=p_id;
  if q.id is null or sid is null then raise exception 'Sin acceso';end if;
  if q.space_id is null then
   if p_restore then delete from public.question_hidden where space_id=sid and question_id=q.id;
   else insert into public.question_hidden(space_id,question_id,hidden_by) values(sid,q.id,auth.uid()) on conflict do nothing;end if;
   return;
  end if;
  update public.questions set deleted_at=case when p_restore then null else now() end where id=q.id and space_id=sid;
 else raise exception 'Colección inválida';end if;
 if not found then raise exception 'Sin acceso';end if;
end $$;
notify pgrst,'reload schema';
