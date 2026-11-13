-- Web Push: one subscription per browser/device, owned by its member.
create table public.push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 endpoint text not null unique check(endpoint ~ '^https://' and length(endpoint)<=1000),
 p256dh text not null check(length(p256dh) between 40 and 200),
 auth text not null check(length(auth) between 10 and 100),
 label text not null default 'Dispositivo' check(length(label)<=80),
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
create index push_subscription_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy read_own_push on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy delete_own_push on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());
-- Keys are never needed by the client after saving; it lists devices only.
grant select(id,label,created_at,last_seen_at,endpoint),delete on public.push_subscriptions to authenticated;

-- Saving goes through an RPC: a browser shared by both members moves to whoever signed in last.
create function public.save_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_label text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.space_members where user_id=auth.uid()) then raise exception 'Inicia sesión';end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,label)
 values(auth.uid(),p_endpoint,p_p256dh,p_auth,left(coalesce(nullif(trim(p_label),''),'Dispositivo'),80))
 on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,label=excluded.label,last_seen_at=now()
 returning id into sid;
 return sid;
end $$;
create function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path='' as $$
 delete from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid();
$$;
revoke all on function public.save_push_subscription(text,text,text,text),public.remove_push_subscription(text) from public,anon;
grant execute on function public.save_push_subscription(text,text,text,text),public.remove_push_subscription(text) to authenticated;

-- Every in-app notification is also offered to the recipient's devices.
create function private.dispatch_push() returns trigger language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
 if not exists(select 1 from public.push_subscriptions where user_id=new.recipient_id) then return new;end if;
 if pg_catalog.to_regclass('vault.decrypted_secrets') is null or pg_catalog.to_regnamespace('net') is null then return new;end if;
 select value into endpoint from private.integration_settings where name='push_function_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='chimuverse_cron';
 if endpoint is null or secret is null then return new;end if;
 begin
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:=jsonb_build_object('action','send','notification_id',new.id),timeout_milliseconds:=10000);
 exception when others then
  -- A push outage never rolls back the in-app notification.
  null;
 end;
 return new;
end $$;
create trigger dispatch_push after insert on public.notifications for each row execute function private.dispatch_push();
notify pgrst,'reload schema';
