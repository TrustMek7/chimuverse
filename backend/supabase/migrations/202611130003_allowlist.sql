-- Explicitly authorized accounts. This table is in an unexposed schema.
insert into private.allowed_emails(email) values ('032azq@gmail.com'),('jcusilaymeg@gmail.com') on conflict do nothing;
-- Admit existing authorized users too; do not create accounts or passwords for them.
insert into public.profiles(id,display_name) select id,coalesce(nullif(raw_user_meta_data->>'full_name',''),split_part(email,'@',1)) from auth.users where lower(email) in (select email from private.allowed_emails) on conflict do nothing;
insert into public.space_members select 'c1111111-1111-4111-8111-111111111111',id from public.profiles on conflict do nothing;
