-- Replies on shared journal notes and mood check-ins.
create table public.entry_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index entry_comments_entry_created_idx
  on public.entry_comments(entry_id, created_at);

alter table public.entry_comments enable row level security;

create policy read_entry_comments on public.entry_comments
  for select to authenticated using (
    public.can_read_entry(entry_id)
    and exists (
      select 1 from public.entries e
      where e.id = entry_id
        and e.deleted_at is null
        and e.kind in ('journal', 'mood')
        and e.visibility in ('shared', 'capsule')
        and (e.visibility <> 'capsule' or e.unlock_at <= now())
    )
  );

create policy add_entry_comment on public.entry_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and public.can_read_entry(entry_id)
    and exists (
      select 1 from public.entries e
      where e.id = entry_id
        and e.deleted_at is null
        and e.kind in ('journal', 'mood')
        and e.visibility in ('shared', 'capsule')
        and (e.visibility <> 'capsule' or e.unlock_at <= now())
    )
  );

create policy delete_own_entry_comment on public.entry_comments
  for delete to authenticated using (
    author_id = auth.uid()
    and public.is_member((select e.space_id from public.entries e where e.id = entry_id))
  );

grant select, insert, delete on public.entry_comments to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.entry_comments;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
