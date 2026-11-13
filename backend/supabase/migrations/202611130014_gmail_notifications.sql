-- Email notifications through each member's Gmail (scope gmail.send: send only, never read).
-- A notification for one member is mailed from the partner's Gmail, or from their own as a fallback,
-- and only when that member has no device with push notifications.
create table private.gmail_connections(
 user_id uuid primary key references auth.users on delete cascade,
 email text not null,
 encrypted_refresh_token text not null,
 connected_at timestamptz not null default now(),
 last_error text,
 last_sent_at timestamptz
);
create table private.gmail_states(
 state text primary key, user_id uuid not null references auth.users on delete cascade,
 verifier text not null, expires_at timestamptz not null default now()+interval '10 minutes'
);
create table private.email_deliveries(
 notification_id uuid primary key references public.notifications on delete cascade,
 sender_id uuid references auth.users on delete set null,
 status text not null check(status in('sent','failed')),
 created_at timestamptz not null default now()
);
revoke all on private.gmail_connections,private.gmail_states,private.email_deliveries from public,anon,authenticated;

create function public.gmail_service(p_op text,p_uid uuid,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.space_members where user_id=p_uid) then raise exception 'Sin acceso al espacio';end if;
 case p_op
 when 'connect' then
  insert into private.gmail_connections(user_id,email,encrypted_refresh_token) values(p_uid,p_data->>'email',p_data->>'token')
  on conflict(user_id) do update set email=excluded.email,encrypted_refresh_token=excluded.encrypted_refresh_token,connected_at=now(),last_error=null;
 when 'disconnect' then
  delete from private.gmail_connections where user_id=p_uid;
  delete from private.gmail_states where user_id=p_uid;
 when 'state' then
  delete from private.gmail_states where expires_at<now();
  insert into private.gmail_states(state,user_id,verifier) values(p_data->>'state',p_uid,p_data->>'verifier');
 when 'error' then update private.gmail_connections set last_error=left(p_data->>'message',300) where user_id=p_uid;
 when 'sent' then update private.gmail_connections set last_sent_at=now(),last_error=null where user_id=p_uid;
 else raise exception 'Operacion no disponible';
 end case;
 return coalesce(result,'null'::jsonb);
end $$;
create function public.consume_gmail_state(p_state text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.gmail_states;
begin
 delete from private.gmail_states where state=p_state and expires_at>now() returning * into s;
 if not found then return null;end if;return to_jsonb(s);
end $$;

-- Decides whether and how one notification is emailed. Returns null to skip.
create function public.mail_plan(p_notification uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.notifications; sid uuid; to_email text; sender private.gmail_connections;
begin
 select * into n from public.notifications where id=p_notification;
 if n.id is null or n.read_at is not null then return null;end if;
 if exists(select 1 from private.email_deliveries where notification_id=n.id) then return null;end if;
 -- Push is the primary channel; email is only the fallback.
 if exists(select 1 from public.push_subscriptions where user_id=n.recipient_id) then return null;end if;
 select space_id into sid from public.space_members where user_id=n.recipient_id;
 if sid is null then return null;end if;
 select email into to_email from auth.users where id=n.recipient_id;
 if to_email is null then return null;end if;
 -- Partner's Gmail first, then the recipient's own.
 select c.* into sender from private.gmail_connections c join public.space_members m on m.user_id=c.user_id
 where m.space_id=sid order by (c.user_id=n.recipient_id), c.connected_at limit 1;
 if sender.user_id is null then return null;end if;
 return jsonb_build_object('notification_id',n.id,'title',n.title,'path',n.path,'to',to_email,
  'sender_id',sender.user_id,'sender_email',sender.email,'token',sender.encrypted_refresh_token,
  'sender_name',(select display_name from public.profiles where id=sender.user_id),
  'self',sender.user_id=n.recipient_id);
end $$;
create function public.mail_delivered(p_notification uuid,p_sender uuid,p_status text) returns void language sql security definer set search_path='' as $$
 insert into private.email_deliveries(notification_id,sender_id,status) values(p_notification,p_sender,p_status) on conflict(notification_id) do nothing;
$$;
revoke all on function public.gmail_service(text,uuid,jsonb),public.consume_gmail_state(text),public.mail_plan(uuid),public.mail_delivered(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.gmail_service(text,uuid,jsonb),public.consume_gmail_state(text),public.mail_plan(uuid),public.mail_delivered(uuid,uuid,text) to service_role;

-- Client-visible status: own connection (without token) and whether the partner connected.
create function public.gmail_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'connected',c.user_id is not null,'email',c.email,'last_error',c.last_error,'last_sent_at',c.last_sent_at,
  'partner_connected',exists(select 1 from private.gmail_connections pc join public.space_members pm on pm.user_id=pc.user_id
    join public.space_members me on me.space_id=pm.space_id where me.user_id=auth.uid() and pc.user_id<>auth.uid()))
 from (select auth.uid() uid) u left join private.gmail_connections c on c.user_id=u.uid
 where exists(select 1 from public.space_members where user_id=auth.uid());
$$;
revoke all on function public.gmail_status() from public,anon;
grant execute on function public.gmail_status() to authenticated;

create function private.dispatch_mail() returns trigger language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
 if exists(select 1 from public.push_subscriptions where user_id=new.recipient_id) then return new;end if;
 if not exists(select 1 from private.gmail_connections c join public.space_members m on m.user_id=c.user_id
   join public.space_members r on r.space_id=m.space_id where r.user_id=new.recipient_id) then return new;end if;
 if pg_catalog.to_regclass('vault.decrypted_secrets') is null or pg_catalog.to_regnamespace('net') is null then return new;end if;
 select value into endpoint from private.integration_settings where name='mail_function_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='chimuverse_cron';
 if endpoint is null or secret is null then return new;end if;
 begin
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:=jsonb_build_object('action','send','notification_id',new.id),timeout_milliseconds:=10000);
 exception when others then null;
 end;
 return new;
end $$;
create trigger dispatch_mail after insert on public.notifications for each row execute function private.dispatch_mail();
notify pgrst,'reload schema';
