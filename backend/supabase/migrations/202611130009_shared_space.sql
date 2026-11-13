-- The two members share all content. Time capsules retain their opening date;
-- membership checks and owner-only editing remain unchanged.
create function private.share_space_content() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='entries' and new.visibility='capsule' then return new;end if;
 new.visibility:='shared';return new;
end $$;
create trigger aa_share_entry before insert or update on public.entries for each row execute function private.share_space_content();
create trigger aa_share_photo before insert or update on public.photos for each row execute function private.share_space_content();
alter table public.entries alter column visibility set default 'shared';
alter table public.photos alter column visibility set default 'shared';
update public.entries set visibility='shared' where visibility='private';
-- A legacy photo may reference a deleted album. Sharing metadata must not
-- revalidate that old album relationship; no paths or ownership are modified.
alter table public.photos disable trigger guard_photo;
update public.photos set visibility='shared' where visibility='private';
alter table public.photos enable trigger guard_photo;
alter table public.entries drop constraint entries_visibility_check;
alter table public.entries add constraint entries_visibility_check check(visibility in ('shared','capsule'));
alter table public.photos drop constraint photos_visibility_check;
alter table public.photos add constraint photos_visibility_check check(visibility='shared');
alter table public.calendar_events drop constraint calendar_events_visibility_check;
alter table public.calendar_events add constraint calendar_events_visibility_check check(visibility='shared');

create or replace function public.can_read_entry(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.entries e where e.id=eid and public.is_member(e.space_id)
 and (e.deleted_at is null or e.owner_id=auth.uid()) and (e.visibility<>'capsule' or e.unlock_at<=now()))
$$;

-- Normalize legacy clients before calling the existing transaction so shared
-- notifications are emitted as well, even when a client submits "private".
alter function public.save_entry(jsonb,text,uuid) rename to save_entry_base;
alter function public.save_entry_base(jsonb,text,uuid) set schema private;
revoke all on function private.save_entry_base(jsonb,text,uuid) from public,anon,authenticated;
create function public.save_entry(p_data jsonb,p_content text default '',p_id uuid default null) returns uuid language sql security definer set search_path='' as $$
 select private.save_entry_base(p_data||jsonb_build_object('visibility',case when p_data->>'visibility'='capsule' then 'capsule' else 'shared' end),p_content,p_id)
$$;
revoke all on function public.save_entry(jsonb,text,uuid) from public,anon;
grant execute on function public.save_entry(jsonb,text,uuid) to authenticated;
