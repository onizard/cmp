-- Bootstrap manuel (à exécuter en tant que superutilisateur « postgres »)
-- quand l'image supabase/postgres n'a pas initialisé rôles/schéma d'elle-même.
-- Le mot de passe est lu depuis la variable d'environnement PGPW via \getenv.
\getenv pgpass PGPW
set my.pw to :'pgpass';

do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then execute format('create role authenticator login noinherit password %L', current_setting('my.pw')); else execute format('alter role authenticator login password %L', current_setting('my.pw')); end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then execute format('create role supabase_auth_admin login createrole createdb password %L', current_setting('my.pw')); else execute format('alter role supabase_auth_admin login password %L', current_setting('my.pw')); end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then execute format('create role supabase_admin login superuser createrole createdb replication bypassrls password %L', current_setting('my.pw')); else execute format('alter role supabase_admin login password %L', current_setting('my.pw')); end if;
end $$;

grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;

create or replace function auth.uid() returns uuid language sql stable as $f$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$f$;

reset my.pw;
