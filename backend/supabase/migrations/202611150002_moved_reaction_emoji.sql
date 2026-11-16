-- Replace 🥹 with the more widely supported 🥺, preserving existing reactions.
alter table public.entry_reactions
  drop constraint entry_reactions_emoji_check;

update public.entry_reactions
set emoji = '🥺'
where emoji = '🥹';

alter table public.entry_reactions
  add constraint entry_reactions_emoji_check
  check (emoji in ('❤️','🥺','😂','✨','🤍','🫂'));

drop policy read_entry_reactions on public.entry_reactions;
create policy read_entry_reactions on public.entry_reactions
  for select to authenticated using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id
        and public.is_member(e.space_id)
        and e.deleted_at is null
        and e.kind in ('journal', 'mood')
        and (e.visibility <> 'capsule' or e.unlock_at <= now())
        and (
          (e.kind = 'journal' and emoji in ('❤️','🥺','😂','✨'))
          or (e.kind = 'mood' and emoji in ('❤️','🤍','🫂'))
        )
    )
  );

drop policy add_entry_reaction on public.entry_reactions;
create policy add_entry_reaction on public.entry_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.entries e
      where e.id = entry_id
        and public.is_member(e.space_id)
        and e.deleted_at is null
        and e.kind in ('journal', 'mood')
        and (e.visibility <> 'capsule' or e.unlock_at <= now())
        and (
          (e.kind = 'journal' and emoji in ('❤️','🥺','😂','✨'))
          or (e.kind = 'mood' and emoji in ('❤️','🤍','🫂'))
        )
    )
  );

notify pgrst, 'reload schema';
