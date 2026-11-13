-- Everything editable from its own module, no admin panel:
-- * questions we wrote (space questions) can be edited or trashed by either member;
-- * questions from the shared bank (space_id null) are never changed: a space can hide them,
--   and un-hide them from the trash;
-- * the trash shows shared things (finances, date ideas, our questions) to both of us, so
--   whoever trashed something of the other can restore it.
alter table public.questions add column deleted_at timestamptz;
create table public.question_hidden(
 space_id uuid not null references public.spaces on delete cascade,
 question_id uuid not null references public.questions on delete cascade,
 hidden_by uuid not null references public.profiles,
 hidden_at timestamptz not null default now(),
 primary key(space_id,question_id));
alter table public.question_hidden enable row level security;
create policy read_hidden on public.question_hidden for select to authenticated using(public.is_member(space_id));
grant select on public.question_hidden to authenticated;

-- Trashed shared entries stay readable by both members (only for the trash; lists hide them).
drop policy read_entries on public.entries;
create policy read_entries on public.entries for select to authenticated using(public.is_member(space_id)
 and (owner_id=auth.uid() or (visibility in ('shared','capsule') and deleted_at is null) or kind in ('transaction','budget','date')));

create function public.edit_question(p_id uuid,p_title text,p_category text,p_depth int) returns void
language plpgsql security definer set search_path='' as $$
declare q public.questions;v_title text:=trim(coalesce(p_title,''));v_category text:=trim(coalesce(p_category,''));
begin
 select * into q from public.questions where id=p_id for update;
 if q.id is null or (q.space_id is not null and not public.is_member(q.space_id)) then raise exception 'Pregunta no disponible';end if;
 if q.space_id is null then raise exception 'Las preguntas del banco no se editan: ocúltala y escribe la tuya';end if;
 if q.deleted_at is not null then raise exception 'La pregunta está en la papelera';end if;
 if length(v_title) not between 3 and 240 then raise exception 'La pregunta debe tener entre 3 y 240 caracteres';end if;
 if length(v_category) not between 1 and 60 then raise exception 'Elige un tema';end if;
 if p_depth is null or p_depth not between 1 and 3 then raise exception 'Elige una profundidad';end if;
 update public.questions set title=v_title,category=v_category,depth=p_depth where id=q.id;
end $$;

create or replace function public.trash_item(p_table text,p_id uuid,p_restore boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;q public.questions;
begin
 if p_table='entries' then update public.entries set deleted_at=case when p_restore then null else now() end where id=p_id and (owner_id=auth.uid() or kind in ('transaction','budget','date')) and public.is_member(space_id);
 elsif p_table='photos' then update public.photos set deleted_at=case when p_restore then null else now() end where id=p_id and uploaded_by=auth.uid() and public.is_member(space_id);
 elsif p_table='calendar_events' then update public.calendar_events set deleted_at=case when p_restore then null else now() end where id=p_id and owner_id=auth.uid() and public.is_member(space_id);
 elsif p_table='questions' then
  select space_id into sid from public.space_members where user_id=auth.uid();
  select * into q from public.questions where id=p_id;
  if q.id is null or sid is null then raise exception 'Sin acceso';end if;
  if q.space_id is null then
   -- A bank question is hidden for this space, never deleted.
   if p_restore then delete from public.question_hidden where space_id=sid and question_id=q.id;
   else insert into public.question_hidden(space_id,question_id,hidden_by) values(sid,q.id,auth.uid()) on conflict do nothing;end if;
   return;
  end if;
  update public.questions set deleted_at=case when p_restore then null else now() end where id=q.id and space_id=sid;
 else raise exception 'Colección inválida';end if;
 if not found then raise exception 'Sin acceso';end if;
end $$;
revoke all on function public.edit_question(uuid,text,text,int) from public,anon;
grant execute on function public.edit_question(uuid,text,text,int) to authenticated;
notify pgrst,'reload schema';
