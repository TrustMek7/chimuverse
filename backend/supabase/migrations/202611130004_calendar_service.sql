alter table private.google_connections add column lock_until timestamptz;
-- Service-only RPC: private tokens never enter the exposed schema or browser.
create function public.calendar_service(p_op text,p_uid uuid,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; sid uuid; e public.calendar_events; eventid uuid;
begin
 select space_id into sid from public.space_members where user_id=p_uid;
 if sid is null then raise exception 'Sin acceso al espacio';end if;
 case p_op
 when 'connection' then select to_jsonb(c) into result from private.google_connections c where user_id=p_uid;
 when 'connect' then
  insert into private.google_connections(user_id,encrypted_refresh_token,calendar_id) values(p_uid,p_data->>'token',p_data->>'calendar_id') on conflict(user_id) do update set encrypted_refresh_token=excluded.encrypted_refresh_token,calendar_id=excluded.calendar_id,status='connected',last_error=null;
 when 'state' then
  delete from private.oauth_states where expires_at<now();
  insert into private.oauth_states(state,user_id,code_verifier,redirect_uri) values(p_data->>'state',p_uid,p_data->>'verifier',p_data->>'redirect_uri');
 when 'disconnect' then delete from private.google_connections where user_id=p_uid;delete from private.oauth_states where user_id=p_uid;
 when 'lock' then
  update private.google_connections set lock_until=now()+interval '90 seconds' where user_id=p_uid and (lock_until is null or lock_until<now());
  result:=jsonb_build_object('acquired',found);
 when 'finish' then update private.google_connections set lock_until=null,last_sync_at=case when p_data->>'error' is null then now() else last_sync_at end,last_error=p_data->>'error',status=case when p_data->>'error' is null then 'connected' else 'error' end,sync_token=coalesce(p_data->>'sync_token',sync_token) where user_id=p_uid;
 when 'reset_cursor' then update private.google_connections set sync_token=null where user_id=p_uid;
 when 'links' then select coalesce(jsonb_agg(to_jsonb(l)),'[]') into result from private.calendar_links l where user_id=p_uid;
 when 'link' then insert into private.calendar_links(event_id,user_id,google_event_id,etag,local_version,remote_updated) values((p_data->>'event_id')::uuid,p_uid,p_data->>'google_event_id',p_data->>'etag',(p_data->>'local_version')::int,(p_data->>'remote_updated')::timestamptz) on conflict(event_id,user_id) do update set google_event_id=excluded.google_event_id,etag=excluded.etag,local_version=excluded.local_version,remote_updated=excluded.remote_updated;
 when 'events' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from public.calendar_events t where t.owner_id=p_uid and t.space_id=sid;
 when 'conflict' then
  perform 1 from public.calendar_events where id=(p_data->>'event_id')::uuid and owner_id=p_uid;
  if not found then raise exception 'Evento no autorizado';end if;
  insert into public.calendar_conflicts(user_id,event_id,remote_event) values(p_uid,(p_data->>'event_id')::uuid,p_data->'remote') on conflict(user_id,event_id) do update set remote_event=excluded.remote_event,resolved_at=null;
 when 'conflicts' then select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from public.calendar_conflicts c where user_id=p_uid and resolved_at is null;
 when 'resolve' then update public.calendar_conflicts set resolved_at=now() where id=(p_data->>'conflict_id')::uuid and user_id=p_uid;
 when 'import' then
  eventid:=(p_data->>'event_id')::uuid;
  if eventid is null then
   insert into public.calendar_events(space_id,owner_id,title,description,start_at,end_at,all_day,visibility,sync_google,annual) values(sid,p_uid,p_data->>'title',coalesce(p_data->>'description',''),(p_data->>'start_at')::timestamptz,(p_data->>'end_at')::timestamptz,coalesce((p_data->>'all_day')::boolean,false),'private',true,coalesce((p_data->>'annual')::boolean,false)) returning * into e;
  else
   update public.calendar_events set title=coalesce(p_data->>'title',title),description=coalesce(p_data->>'description',description),start_at=coalesce((p_data->>'start_at')::timestamptz,start_at),end_at=coalesce((p_data->>'end_at')::timestamptz,end_at),all_day=coalesce((p_data->>'all_day')::boolean,all_day),annual=coalesce((p_data->>'annual')::boolean,annual),deleted_at=case when coalesce((p_data->>'deleted')::boolean,false) then now() else null end where id=eventid and owner_id=p_uid and space_id=sid returning * into e;
  end if;
  if e.id is null then raise exception 'Evento no autorizado';end if;
  result:=to_jsonb(e);
 else raise exception 'Operación no disponible';
 end case;
 return coalesce(result,'null'::jsonb);
end $$;
create function public.consume_calendar_state(p_state text) returns jsonb language plpgsql security definer set search_path='' as $$declare s private.oauth_states;begin delete from private.oauth_states where state=p_state and expires_at>now() returning * into s;if not found then return null;end if;return to_jsonb(s);end $$;
create function public.calendar_accounts() returns jsonb language sql security definer set search_path='' as $$select coalesce(jsonb_agg(user_id),'[]') from private.google_connections$$;
revoke all on function public.calendar_service(text,uuid,jsonb),public.consume_calendar_state(text),public.calendar_accounts() from public,anon,authenticated;
grant execute on function public.calendar_service(text,uuid,jsonb),public.consume_calendar_state(text),public.calendar_accounts() to service_role;

-- Mood sharing exposes the state, never the private note.
create or replace function public.can_read_entry(eid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.entries e where e.id=eid and public.is_member(e.space_id) and (e.owner_id=auth.uid() or (e.visibility in ('shared','capsule') and e.kind<>'mood')) and (e.visibility<>'capsule' or e.unlock_at<=now()))$$;
