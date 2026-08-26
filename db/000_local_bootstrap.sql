-- ⚠️ פיתוח מקומי בלבד. לא להריץ על Supabase — שם כל זה כבר קיים.
--
-- מייצר את התפקידים ואת auth.uid() ש-Supabase מספקת, כדי ש-003_rls.sql
-- יורץ מילה במילה גם מקומית. בלי זה מדיניות ה-RLS לא נבדקת כלל.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;

-- ב-Supabase זה נגזר מה-JWT. מקומית מציבים אותו ידנית ב-set_config.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
