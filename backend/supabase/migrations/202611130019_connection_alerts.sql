-- A Google connection that loses its permission (Testing-mode tokens expire every 7 days, or the
-- person revoked it) used to fail silently: only Ajustes showed it. Now its owner gets one
-- notification per service and day (push, or email when there is no push), linking to Conexiones.
-- Only permission errors alert; temporary outages ("no respondió") do not.
create function private.alert_connection() returns trigger language plpgsql security definer set search_path='' as $$
declare svc text:=tg_argv[0];
begin
 if new.last_error is not null and new.last_error ilike '%reconecta%' and new.last_error is distinct from old.last_error then
  insert into public.notifications(recipient_id,kind,title,path,dedupe_key)
  values(new.user_id,'connection_error',
   case svc when 'calendar' then 'Google Calendar dejó de sincronizar: reconéctalo en Ajustes'
            else 'Gmail ya no puede enviar los avisos por correo: reconéctalo en Ajustes' end,
   '/ajustes/conexiones','connection:'||svc||':'||new.user_id||':'||current_date)
  on conflict(dedupe_key) do nothing;
 end if;
 return new;
end $$;
create trigger alert_connection after update of last_error on private.google_connections
 for each row execute function private.alert_connection('calendar');
create trigger alert_connection after update of last_error on private.gmail_connections
 for each row execute function private.alert_connection('gmail');
