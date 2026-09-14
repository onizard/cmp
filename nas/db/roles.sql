-- Fixe le mot de passe des rôles internes utilisés par gotrue / postgrest / realtime.
\set pgpass `echo "$POSTGRES_PASSWORD"`

alter user authenticator with password :'pgpass';
alter user supabase_auth_admin with password :'pgpass';
alter user supabase_admin with password :'pgpass';
