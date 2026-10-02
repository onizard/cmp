-- Changer de mot de passe, ou de code responsable : d'abord l'ancien.
--
-- Le mot de passe se change par cmp_mot_de_passe, qui verifie le mot de
-- passe actuel ; tout autre changement (celui que le service
-- d'authentification ferait sur simple demande de l'appli) est refuse.
--
-- Deux secours :
--   * compte perso : qui a oublie son mot de passe se connecte par le lien
--     recu par mail (« Mot de passe oublie ») ; dans l'heure qui suit, il en
--     choisit un nouveau sans l'ancien ;
--   * compte pro : le code responsable remplace le mot de passe oublie
--     (cmp_entreprise_mot_de_passe, acces.sql). Le code responsable, lui, se
--     change avec l'ancien (cmp_entreprise_code_responsable_changer) ; le
--     mot de passe peut encore le remplacer s'il est oublie
--     (cmp_entreprise_code_responsable, que l'appli ne propose plus). Un
--     compte pro n'a pas le secours du lien : ses equipiers y sont
--     connectes par un lien, eux aussi.
--
-- Cinq essais faux en quinze minutes bloquent un moment : on ne devine pas
-- un mot de passe en les essayant tous.
--
-- A passer apres entreprise.sql et acces.sql. A relancer sans risque.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists mot_de_passe_essais (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists mot_de_passe_essais_idx on mot_de_passe_essais (user_id, at);
alter table mot_de_passe_essais enable row level security;
revoke all on mot_de_passe_essais from anon, authenticated;

create or replace function public.est_compte_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from members m
                   join households h on h.id = m.household_id and h.entreprise
                  where m.user_id = uid);
$$;

-- Le mot de passe actuel est-il bon ? Un essai faux est compte ; trop
-- d'essais : 'bloque'. Renvoie 'ok', 'faux' ou 'bloque'.
create or replace function public.mot_de_passe_verifier(uid uuid, p_actuel text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (select count(*) from mot_de_passe_essais
       where user_id = uid and at > now() - interval '15 minutes') >= 5 then
    return 'bloque';
  end if;
  if exists (select 1 from auth.users u
              where u.id = uid and coalesce(u.encrypted_password, '') <> ''
                and u.encrypted_password = crypt(coalesce(p_actuel, ''), u.encrypted_password)) then
    return 'ok';
  end if;
  insert into mot_de_passe_essais (user_id) values (uid);
  return 'faux';
end
$$;

-- Connecte par le lien du mail il y a moins d'une heure ?
create or replace function public.connexion_par_lien_recente()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
     where a ->> 'method' in ('otp', 'magiclink', 'recovery')
       and (a ->> 'timestamp')::bigint > extract(epoch from now() - interval '1 hour')
  );
$$;

-- Renvoie 'ok', 'faux', 'bloque' ou 'court'.
create or replace function public.cmp_mot_de_passe(p_actuel text, p_nouveau text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  moi constant uuid := auth.uid();
  v text;
begin
  if moi is null then
    raise exception using errcode = '42501', message = 'Connexion requise.';
  end if;
  if length(coalesce(p_nouveau, '')) < 8 then
    return 'court';
  end if;
  if not (connexion_par_lien_recente() and not est_compte_pro(moi)) then
    v := mot_de_passe_verifier(moi, p_actuel);
    if v <> 'ok' then
      return v;
    end if;
  end if;
  perform set_config('cmp.op', '1', true);
  update auth.users
     set encrypted_password = crypt(p_nouveau, gen_salt('bf', 10)), updated_at = now()
   where id = moi;
  return 'ok';
end
$$;

-- Compte pro : un nouveau code responsable, avec le mot de passe du compte.
-- Renvoie 'ok', 'faux', 'bloque', 'format' ou 'pas-entreprise'.
create or replace function public.cmp_entreprise_code_responsable(p_actuel text, p_nouveau text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  moi constant uuid := auth.uid();
  hid uuid;
  v text;
begin
  if moi is null then
    raise exception using errcode = '42501', message = 'Connexion requise.';
  end if;
  select m.household_id into hid
    from members m join households h on h.id = m.household_id and h.entreprise
   where m.user_id = moi
   limit 1;
  if hid is null then
    return 'pas-entreprise';
  end if;
  if coalesce(p_nouveau, '') !~ '^[0-9]{4,8}$' then
    return 'format';
  end if;
  v := mot_de_passe_verifier(moi, p_actuel);
  if v <> 'ok' then
    return v;
  end if;
  insert into entreprise_secrets (household_id, code_responsable)
  values (hid, crypt(p_nouveau, gen_salt('bf')))
  on conflict (household_id) do update set code_responsable = excluded.code_responsable;
  return 'ok';
end
$$;

-- Compte pro : un nouveau code responsable, avec l'ancien (celui qu'on
-- tape déjà pour gérer l'équipe). Un code faux compte comme un essai ; dix
-- en cinq minutes bloquent un moment. Renvoie 'ok', 'faux', 'format' ou
-- 'pas-entreprise'.
create or replace function public.cmp_entreprise_code_responsable_changer(p_ancien text, p_nouveau text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  moi constant uuid := auth.uid();
  hid uuid;
begin
  if moi is null then
    raise exception using errcode = '42501', message = 'Connexion requise.';
  end if;
  select m.household_id into hid
    from members m join households h on h.id = m.household_id and h.entreprise
   where m.user_id = moi
   limit 1;
  if hid is null then
    return 'pas-entreprise';
  end if;
  if coalesce(p_nouveau, '') !~ '^[0-9]{4,8}$' then
    return 'format';
  end if;
  if not public.entreprise_responsable(hid, p_ancien) then
    return 'faux';
  end if;
  update entreprise_secrets
     set code_responsable = crypt(p_nouveau, gen_salt('bf'))
   where household_id = hid;
  return 'ok';
end
$$;

-- La garde : un mot de passe ne change que par les fonctions ci-dessus (ou
-- par cmp_entreprise_mot_de_passe, avec le code responsable).
create or replace function public.garde_mot_de_passe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(old.encrypted_password, '') <> ''
     and coalesce(current_setting('cmp.op', true), '') <> '1' then
    raise exception using errcode = '42501',
      message = 'Le mot de passe se change depuis Mon compte, avec l''ancien.';
  end if;
  return new;
end
$$;

drop trigger if exists auth_users_mot_de_passe_pro on auth.users;
drop function if exists public.entreprise_garde_mot_de_passe();
drop trigger if exists auth_users_mot_de_passe on auth.users;
create trigger auth_users_mot_de_passe
  before update of encrypted_password on auth.users
  for each row execute function public.garde_mot_de_passe();

revoke all on function public.est_compte_pro(uuid) from public;
revoke all on function public.mot_de_passe_verifier(uuid, text) from public;
revoke all on function public.cmp_mot_de_passe(text, text) from public;
revoke all on function public.cmp_entreprise_code_responsable(text, text) from public;
grant execute on function public.cmp_mot_de_passe(text, text) to authenticated;
grant execute on function public.cmp_entreprise_code_responsable(text, text) to authenticated;
revoke all on function public.cmp_entreprise_code_responsable_changer(text, text) from public;
grant execute on function public.cmp_entreprise_code_responsable_changer(text, text) to authenticated;

notify pgrst, 'reload schema';
select 'mot de passe ok' as etat;
