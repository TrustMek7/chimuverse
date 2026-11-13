-- Date ideas are ours too: either member edits or trashes any idea (the 150 seeded ideas have a
-- single author). Same shared path as finances; other kinds stay author-only.
create or replace function public.save_entry(p_data jsonb,p_content text default '',p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.entries;
begin
 if p_id is not null then
  select * into e from public.entries where id=p_id for update;
  if e.id is not null and e.kind in ('transaction','budget','date') and e.owner_id<>auth.uid() then
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
 if p_table='entries' then update public.entries set deleted_at=case when p_restore then null else now() end where id=p_id and (owner_id=auth.uid() or kind in ('transaction','budget','date')) and public.is_member(space_id);
 elsif p_table='photos' then update public.photos set deleted_at=case when p_restore then null else now() end where id=p_id and uploaded_by=auth.uid() and public.is_member(space_id);
 elsif p_table='calendar_events' then update public.calendar_events set deleted_at=case when p_restore then null else now() end where id=p_id and owner_id=auth.uid() and public.is_member(space_id);
 else raise exception 'Colección inválida';end if;
 if not found then raise exception 'Sin acceso';end if;end $$;

notify pgrst,'reload schema';
