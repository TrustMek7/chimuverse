create table private.integration_settings(name text primary key,value text not null);
create table private.calendar_sync_queue(user_id uuid primary key references public.profiles,generation bigint not null default 1,processed_generation bigint not null default 0,requested_at timestamptz not null default now());
revoke all on private.integration_settings,private.calendar_sync_queue from public,anon,authenticated;

create function private.queue_calendar_sync(uid uuid) returns void language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
 if not exists(select 1 from private.google_connections where user_id=uid) then return;end if;
 insert into private.calendar_sync_queue(user_id) values(uid) on conflict(user_id) do update set generation=private.calendar_sync_queue.generation+1,requested_at=now();
 -- The durable queue remains pending if immediate delivery is unavailable.
 if pg_catalog.to_regclass('vault.decrypted_secrets') is null or pg_catalog.to_regnamespace('net') is null then return;end if;
 select value into endpoint from private.integration_settings where name='calendar_function_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='chimuverse_cron';
 if endpoint is null or secret is null then return;end if;
 begin
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:=jsonb_build_object('action','event','user_id',uid),timeout_milliseconds:=10000);
 exception when others then
  -- A network outage must not roll back the user's event. Cron retries the queue.
  null;
 end;
end $$;
create function private.auto_export_calendar_event() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null and exists(select 1 from private.google_connections where user_id=new.owner_id) then new.sync_google=true;end if;
 return new;
end $$;
create trigger auto_export_calendar_event before insert or update on public.calendar_events for each row execute function private.auto_export_calendar_event();
create function private.dispatch_calendar_event() returns trigger language plpgsql security definer set search_path='' as $$begin
 -- Service imports have no user JWT: do not feed Google changes back into an export loop.
 if auth.uid() is not null then perform private.queue_calendar_sync(new.owner_id);end if;
 return new;
end $$;
create trigger dispatch_calendar_event after insert or update on public.calendar_events for each row execute function private.dispatch_calendar_event();
create function private.connected_calendar_export() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.calendar_events set sync_google=true where owner_id=new.user_id and deleted_at is null and not sync_google;
 perform private.queue_calendar_sync(new.user_id);
 return new;
end $$;
create trigger connected_calendar_export after insert or update of encrypted_refresh_token on private.google_connections for each row execute function private.connected_calendar_export();

create function public.pending_calendar_sync(p_uid uuid) returns jsonb language sql security definer set search_path='' as $$select coalesce((select jsonb_build_object('generation',generation) from private.calendar_sync_queue where user_id=p_uid and generation>processed_generation),'null'::jsonb)$$;
create function public.complete_calendar_sync(p_uid uuid,p_generation bigint) returns void language sql security definer set search_path='' as $$update private.calendar_sync_queue set processed_generation=greatest(processed_generation,least(p_generation,generation)) where user_id=p_uid$$;
revoke all on function public.pending_calendar_sync(uuid),public.complete_calendar_sync(uuid,bigint) from public,anon,authenticated;
grant execute on function public.pending_calendar_sync(uuid),public.complete_calendar_sync(uuid,bigint) to service_role;
create or replace function public.google_status() returns jsonb language sql stable security definer set search_path='' as $$select coalesce((select jsonb_build_object('status',status,'last_sync_at',last_sync_at,'last_error',last_error,'auto_sync_pending',exists(select 1 from private.calendar_sync_queue q where q.user_id=auth.uid() and q.generation>q.processed_generation)) from private.google_connections where user_id=auth.uid()),'{"status":"disconnected"}'::jsonb)$$;
-- Existing connected accounts get automatic export too, without reconnecting.
do $$declare uid uuid;begin
 for uid in select user_id from private.google_connections loop
  update public.calendar_events set sync_google=true where owner_id=uid and deleted_at is null and not sync_google;
  perform private.queue_calendar_sync(uid);
 end loop;
end $$;
