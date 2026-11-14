-- Shared reactions for journal entries and mood check-ins. Capsules keep their
-- reactions hidden until opening, just like the capsule body itself.
create table public.entry_reactions(
 entry_id uuid not null references public.entries(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.profiles,
 emoji text not null check(emoji in ('❤️','🥹','😂','✨','🤍','🫂')),
 created_at timestamptz not null default now(),
 primary key(entry_id,user_id,emoji)
);
alter table public.entry_reactions enable row level security;
create policy read_entry_reactions on public.entry_reactions for select to authenticated using(
 exists(select 1 from public.entries e where e.id=entry_id and public.is_member(e.space_id)
  and e.deleted_at is null and e.kind in ('journal','mood')
  and (e.visibility<>'capsule' or e.unlock_at<=now())
  and ((e.kind='journal' and emoji in ('❤️','🥹','😂','✨')) or (e.kind='mood' and emoji in ('❤️','🤍','🫂'))))
);
create policy add_entry_reaction on public.entry_reactions for insert to authenticated with check(
 user_id=auth.uid() and exists(select 1 from public.entries e where e.id=entry_id and public.is_member(e.space_id)
  and e.deleted_at is null and e.kind in ('journal','mood')
  and (e.visibility<>'capsule' or e.unlock_at<=now())
  and ((e.kind='journal' and emoji in ('❤️','🥹','😂','✨')) or (e.kind='mood' and emoji in ('❤️','🤍','🫂'))))
);
create policy remove_own_entry_reaction on public.entry_reactions for delete to authenticated using(
 user_id=auth.uid() and exists(select 1 from public.entries e where e.id=entry_id and public.is_member(e.space_id)
  and e.kind in ('journal','mood') and (e.visibility<>'capsule' or e.unlock_at<=now()))
);
grant select,insert,delete on public.entry_reactions to authenticated;
do $$begin alter publication supabase_realtime add table public.entry_reactions; exception when duplicate_object then null;end $$;
notify pgrst,'reload schema';
