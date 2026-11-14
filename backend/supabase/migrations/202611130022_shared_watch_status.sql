-- Starting or finishing a shared movie/series is a shared action, even if
-- only one member originally added it. The partner can change status only;
-- editing its title and other details remains with its author.
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
  if e.id is not null and e.kind='watch' and e.owner_id<>auth.uid() then
   if not public.is_member(e.space_id) or e.deleted_at is not null then raise exception 'No puedes editar esta entrada';end if;
   if coalesce(p_data->>'kind',e.kind)<>e.kind then raise exception 'No se puede cambiar el tipo';end if;
   v_status:=coalesce(p_data->>'status','');
   if v_status not in ('pending','progress','done') then raise exception 'Estado no válido';end if;
   update public.entries set status=v_status where id=e.id;
   return e.id;
  end if;
 end if;
 return private.save_entry_base(p_data||jsonb_build_object('visibility',case when p_data->>'visibility'='capsule' then 'capsule' else 'shared' end),p_content,p_id);
end $$;
notify pgrst,'reload schema';
