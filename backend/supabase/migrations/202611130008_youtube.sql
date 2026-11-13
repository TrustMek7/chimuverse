-- OAuth secrets and playlist ownership remain service-only. Both space members
-- may edit the shared playlist through the authenticated Edge Function.
create table private.youtube_connections(
 user_id uuid primary key references auth.users on delete cascade,
 encrypted_refresh_token text not null
);
create table private.youtube_states(
 state text primary key, user_id uuid not null references auth.users on delete cascade,
 verifier text not null, expires_at timestamptz not null default now()+interval '10 minutes'
);
create table private.youtube_playlists(
 space_id uuid primary key references public.spaces on delete cascade,
 owner_id uuid not null references auth.users,
 playlist_id text, title text not null default 'Nuestro soundtrack',
 lock_until timestamptz
);
create function public.youtube_service(p_op text,p_uid uuid,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; result jsonb;
begin
 select space_id into sid from public.space_members where user_id=p_uid;
 if sid is null then raise exception 'Sin acceso al espacio'; end if;
 case p_op
 when 'connection' then select to_jsonb(c) into result from private.youtube_connections c where user_id=p_uid;
 when 'connect' then
  insert into private.youtube_connections values(p_uid,p_data->>'token') on conflict(user_id) do update set encrypted_refresh_token=excluded.encrypted_refresh_token;
 when 'disconnect' then
  delete from private.youtube_connections where user_id=p_uid;
  delete from private.youtube_states where user_id=p_uid;
 when 'state' then
  delete from private.youtube_states where expires_at<now();
  insert into private.youtube_states(state,user_id,verifier) values(p_data->>'state',p_uid,p_data->>'verifier');
 when 'playlist' then
  select to_jsonb(p)||jsonb_build_object('token',c.encrypted_refresh_token) into result
  from private.youtube_playlists p left join private.youtube_connections c on c.user_id=p.owner_id where p.space_id=sid;
 when 'lock' then
  insert into private.youtube_playlists(space_id,owner_id) values(sid,p_uid) on conflict do nothing;
  update private.youtube_playlists set lock_until=now()+interval '10 minutes' where space_id=sid and (lock_until is null or lock_until<now());
  result:=jsonb_build_object('acquired',found);
 when 'unlock' then update private.youtube_playlists set lock_until=null where space_id=sid;
 when 'save' then
  update private.youtube_playlists set playlist_id=p_data->>'id',title=p_data->>'title',owner_id=p_uid where space_id=sid and playlist_id is null;
  if not found then raise exception 'Ya existe una playlist compartida';end if;
 else raise exception 'Operacion no disponible';
 end case;
 return coalesce(result,'null'::jsonb);
end $$;
create function public.consume_youtube_state(p_state text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.youtube_states;
begin
 delete from private.youtube_states where state=p_state and expires_at>now() returning * into s;
 if not found then return null;end if;return to_jsonb(s);
end $$;
revoke all on function public.youtube_service(text,uuid,jsonb),public.consume_youtube_state(text) from public,anon,authenticated;
grant execute on function public.youtube_service(text,uuid,jsonb),public.consume_youtube_state(text) to service_role;
