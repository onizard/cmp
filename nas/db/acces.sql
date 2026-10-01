-- Rejoindre un compte pro sans en connaitre le mot de passe.
--
-- Un equipier, connecte a son compte perso, demande a rejoindre le compte
-- pro de son entreprise en donnant seulement son adresse e-mail. Son
-- telephone affiche alors un CODE DE LIAISON de 8 caracteres, tire au hasard
-- ici. L'administrateur recoit un mail (envoye par le service d'envoi) avec
-- un lien : pour accepter, il doit taper ce code, que l'equipier lui a donne
-- de vive voix. Refuser ne demande rien.
--
-- Une fois accepte, le service d'envoi fabrique une connexion a usage unique
-- pour le compte pro (l'equivalent d'un lien magique, jamais envoye par
-- mail) ; le telephone de l'equipier la recupere et ouvre le compte pro a
-- cote du perso. Le mot de passe ne circule a aucun moment.
--
-- Les garde-fous :
--   * le code de liaison est chiffre (bcrypt) ; 5 codes faux annulent la
--     demande ;
--   * le lien du mail porte une cle de 48 caracteres, impossible a deviner ;
--   * une demande expire au bout de 7 jours ; une seule en attente a la fois
--     par equipier, et pas plus de 5 par jour ;
--   * la table est illisible depuis l'application : tout passe par les
--     fonctions ci-dessous.
--
-- Plus bas : le mot de passe d'un compte pro, reserve a l'administrateur.
--
-- A passer apres entreprise.sql. A relancer sans risque : idempotent.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists acces_demandes (
  id uuid primary key default gen_random_uuid(),
  demandeur uuid not null references auth.users on delete cascade,
  demandeur_email text,
  demandeur_nom text,
  email_pro text not null,
  cible uuid not null references auth.users on delete cascade,
  household_id uuid not null references households on delete cascade,
  code_hash text not null,
  cle text not null,
  langue text not null default 'fr',
  essais int not null default 0,
  statut text not null default 'attente',
  created_at timestamptz not null default now(),
  expire_at timestamptz not null default now() + interval '7 days',
  decided_at timestamptz,
  mail_envoye_at timestamptz,
  mail_essais int not null default 0,
  jeton text,
  jeton_at timestamptz,
  jeton_voulu_at timestamptz
);
-- Le telephone relie : sa connexion au compte pro, pour pouvoir la retirer.
alter table acces_demandes add column if not exists session_id uuid;
alter table acces_demandes add column if not exists utilise_at timestamptz;

alter table acces_demandes drop constraint if exists acces_demandes_statut_check;
alter table acces_demandes add constraint acces_demandes_statut_check
  check (statut in ('attente', 'acceptee', 'refusee', 'annulee', 'bloquee', 'expiree', 'recuperee', 'retiree'));

create index if not exists acces_demandes_demandeur_idx on acces_demandes (demandeur, created_at);

-- Aucune politique : personne ne lit ni n'ecrit cette table depuis
-- l'application. Seuls les fonctions ci-dessous et le service d'envoi y ont
-- acces.
alter table acces_demandes enable row level security;
revoke all on acces_demandes from anon, authenticated;

-- 8 caracteres parmi 32, sans ceux qui se confondent (O/0, I/1).
create or replace function public.acces_code_neuf()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(8);
  r text := '';
begin
  for i in 0..7 loop
    r := r || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return r;
end
$$;

-- « k7qm 4xpr », « K7QM-4XPR » : on compare sans tirets, espaces ni casse.
create or replace function public.acces_code_propre(p text)
returns text
language sql
immutable
as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- --- Cote equipier (connecte a son compte perso) ------------------------

create or replace function public.cmp_acces_demander(p_email text, p_langue text default 'fr')
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  moi constant uuid := auth.uid();
  e constant text := lower(btrim(coalesce(p_email, '')));
  c uuid;
  hid uuid;
  nom_pro text;
  code text;
  nid uuid;
begin
  if moi is null then
    raise exception using errcode = '42501', message = 'Connexion requise.';
  end if;

  update acces_demandes set statut = 'expiree'
   where demandeur = moi and statut = 'attente' and expire_at < now();

  if exists (select 1 from acces_demandes where demandeur = moi and statut = 'attente') then
    return json_build_object('erreur', 'deja');
  end if;
  if (select count(*) from acces_demandes
       where demandeur = moi and created_at > now() - interval '1 day') >= 5 then
    return json_build_object('erreur', 'trop');
  end if;

  select u.id, h.id, h.name into c, hid, nom_pro
    from auth.users u
    join members m on m.user_id = u.id
    join households h on h.id = m.household_id and h.entreprise
   where lower(u.email) = e
   limit 1;
  if c is null then
    return json_build_object('erreur', 'inconnu');
  end if;
  if c = moi then
    return json_build_object('erreur', 'soi');
  end if;

  code := acces_code_neuf();
  insert into acces_demandes (demandeur, demandeur_email, demandeur_nom, email_pro, cible,
                              household_id, code_hash, cle, langue)
  values (
    moi,
    (select u.email from auth.users u where u.id = moi),
    (select nullif(btrim(m.display_name), '') from members m
      where m.user_id = moi and m.display_name is not null limit 1),
    e, c, hid,
    crypt(code, gen_salt('bf')),
    encode(gen_random_bytes(24), 'hex'),
    coalesce(nullif(p_langue, ''), 'fr')
  )
  returning id into nid;

  perform pg_notify('cmp_push', json_build_object('kind', 'acces', 'id', nid)::text);
  return json_build_object(
    'id', nid,
    'code', substr(code, 1, 4) || '-' || substr(code, 5, 4),
    'nom', nom_pro
  );
end
$$;

-- Ou en est ma demande ? Acceptee, elle rend la connexion a usage unique,
-- et la fait refabriquer si la precedente a vieilli (elle vit une heure).
create or replace function public.cmp_acces_etat(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  moi constant uuid := auth.uid();
  d acces_demandes;
  nom_pro text;
begin
  select * into d from acces_demandes where id = p_id and demandeur = moi for update;
  if not found then
    return json_build_object('statut', 'introuvable');
  end if;
  select h.name into nom_pro from households h where h.id = d.household_id;

  if d.statut = 'attente' and d.expire_at < now() then
    update acces_demandes set statut = 'expiree' where id = d.id;
    return json_build_object('statut', 'expiree', 'nom', nom_pro);
  end if;

  if d.statut = 'acceptee' then
    if d.jeton is not null and d.jeton_at > now() - interval '45 minutes' then
      return json_build_object('statut', 'acceptee', 'nom', nom_pro,
                               'email', d.email_pro, 'jeton', d.jeton);
    end if;
    if d.jeton_voulu_at is null or d.jeton_voulu_at < now() - interval '1 minute' then
      update acces_demandes set jeton_voulu_at = now() where id = d.id;
      perform pg_notify('cmp_push', json_build_object('kind', 'acces_jeton', 'id', d.id)::text);
    end if;
  end if;

  return json_build_object('statut', d.statut, 'nom', nom_pro);
end
$$;

-- Le compte pro est ouvert sur le telephone : la connexion a usage unique
-- ne sert plus.
create or replace function public.cmp_acces_fini(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update acces_demandes set statut = 'recuperee', jeton = null, utilise_at = now()
   where id = p_id and demandeur = auth.uid() and statut = 'acceptee';
$$;

-- Appelee depuis la connexion pro toute neuve : note laquelle c'est, pour
-- que l'administrateur puisse la retirer plus tard.
create or replace function public.cmp_acces_lier(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update acces_demandes
     set session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
   where id = p_id and cible = auth.uid()
     and statut in ('acceptee', 'recuperee') and session_id is null;
$$;

create or replace function public.cmp_acces_annuler(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update acces_demandes set statut = 'annulee', decided_at = now()
   where id = p_id and demandeur = auth.uid() and statut = 'attente';
$$;

-- --- Cote administrateur (le lien du mail, connecte ou non) -------------

create or replace function public.cmp_acces_voir(p_id uuid, p_cle text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d acces_demandes;
  nom_pro text;
begin
  select * into d from acces_demandes where id = p_id and cle = coalesce(p_cle, '');
  if not found then
    return json_build_object('statut', 'introuvable');
  end if;
  if d.statut = 'attente' and d.expire_at < now() then
    update acces_demandes set statut = 'expiree' where id = d.id;
    d.statut := 'expiree';
  end if;
  select h.name into nom_pro from households h where h.id = d.household_id;
  return json_build_object(
    'statut', d.statut,
    'qui', coalesce(d.demandeur_nom, split_part(d.demandeur_email, '@', 1)),
    'email', d.demandeur_email,
    'nom', nom_pro,
    'restants', greatest(0, 5 - d.essais)
  );
end
$$;

-- Accepter (avec le code de liaison) ou refuser. Ne leve pas d'erreur sur
-- un code faux : l'essai compte, et une erreur l'effacerait.
create or replace function public.cmp_acces_decider(p_id uuid, p_cle text, p_code text, p_accepter boolean)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d acces_demandes;
begin
  select * into d from acces_demandes where id = p_id and cle = coalesce(p_cle, '') for update;
  if not found then
    return json_build_object('resultat', 'introuvable');
  end if;
  if d.statut <> 'attente' then
    return json_build_object('resultat', 'deja', 'statut', d.statut);
  end if;
  if d.expire_at < now() then
    update acces_demandes set statut = 'expiree' where id = d.id;
    return json_build_object('resultat', 'expiree');
  end if;

  if not coalesce(p_accepter, false) then
    update acces_demandes set statut = 'refusee', decided_at = now() where id = d.id;
    perform pg_notify('cmp_push', json_build_object('kind', 'acces_reponse', 'id', d.id)::text);
    return json_build_object('resultat', 'refusee');
  end if;

  if d.code_hash = crypt(acces_code_propre(p_code), d.code_hash) then
    update acces_demandes
       set statut = 'acceptee', decided_at = now(), jeton_voulu_at = now()
     where id = d.id;
    perform pg_notify('cmp_push', json_build_object('kind', 'acces_jeton', 'id', d.id)::text);
    perform pg_notify('cmp_push', json_build_object('kind', 'acces_reponse', 'id', d.id)::text);
    return json_build_object('resultat', 'acceptee');
  end if;

  update acces_demandes set essais = essais + 1 where id = d.id;
  if d.essais + 1 >= 5 then
    update acces_demandes set statut = 'bloquee', decided_at = now() where id = d.id;
    perform pg_notify('cmp_push', json_build_object('kind', 'acces_reponse', 'id', d.id)::text);
    return json_build_object('resultat', 'bloquee');
  end if;
  return json_build_object('resultat', 'faux', 'restants', 5 - (d.essais + 1));
end
$$;

-- --- Les telephones relies, et leur retrait -----------------------------
--
-- Dans Mon compte → Equipe, derriere le code responsable : qui a rejoint le
-- compte pro, et le bouton pour lui retirer l'acces. Retirer supprime sa
-- connexion : son telephone perd le compte pro au plus tard une heure apres
-- (le temps que son dernier jeton expire).

create or replace function public.cmp_acces_relies(hid uuid, p_responsable text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(hid) then
    raise exception using errcode = '42501', message = 'Reserve au compte pro.';
  end if;
  if not public.entreprise_responsable(hid, p_responsable) then
    return json_build_object('erreur', 'faux');
  end if;
  return json_build_object('relies', coalesce((
    select json_agg(json_build_object(
             'id', d.id,
             'qui', coalesce(d.demandeur_nom, split_part(d.demandeur_email, '@', 1)),
             'email', d.demandeur_email,
             'depuis', coalesce(d.utilise_at, d.decided_at))
           order by coalesce(d.utilise_at, d.decided_at) desc)
      from acces_demandes d
     where d.household_id = hid and d.statut in ('acceptee', 'recuperee')), '[]'::json));
end
$$;

create or replace function public.cmp_acces_retirer(p_id uuid, p_responsable text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d acces_demandes;
begin
  select * into d from acces_demandes where id = p_id for update;
  if not found or not public.is_member(d.household_id) then
    return 'introuvable';
  end if;
  if not public.entreprise_responsable(d.household_id, p_responsable) then
    return 'faux';
  end if;
  -- La connexion notee par le telephone et, au cas ou il ne l'aurait pas
  -- notee, toute connexion par lien ouverte pour lui (ni l'administrateur
  -- ni les tablettes ne se connectent ainsi : eux tapent le mot de passe).
  delete from auth.sessions s
   where s.user_id = d.cible
     and (s.id = d.session_id
          or (d.jeton_voulu_at is not null
              and s.created_at between d.jeton_voulu_at - interval '1 minute'
                                   and coalesce(d.utilise_at, now()) + interval '5 minutes'
              and exists (select 1 from auth.mfa_amr_claims a
                           where a.session_id = s.id
                             and a.authentication_method in ('otp', 'magiclink'))));
  update acces_demandes set statut = 'retiree', jeton = null, decided_at = now() where id = d.id;
  return 'ok';
end
$$;

revoke all on function public.cmp_acces_lier(uuid) from public;
revoke all on function public.cmp_acces_relies(uuid, text) from public;
revoke all on function public.cmp_acces_retirer(uuid, text) from public;
grant execute on function public.cmp_acces_lier(uuid) to authenticated;
grant execute on function public.cmp_acces_relies(uuid, text) to authenticated;
grant execute on function public.cmp_acces_retirer(uuid, text) to authenticated;

-- --- Le mot de passe d'un compte pro -----------------------------------
--
-- Toute l'equipe est connectee au compte pro : n'importe qui pourrait en
-- changer le mot de passe depuis Mon compte. On le reserve a
-- l'administrateur : avec l'ancien mot de passe (mot-de-passe.sql) ou, s'il
-- l'a oublie, avec le code responsable, par cette fonction. Le changement
-- direct est refuse (garde dans mot-de-passe.sql). Les equipiers connectes
-- le restent.

create or replace function public.cmp_entreprise_mot_de_passe(p_responsable text, p_nouveau text)
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
  if length(coalesce(p_nouveau, '')) < 8 then
    return 'court';
  end if;
  if not public.entreprise_responsable(hid, p_responsable) then
    return 'faux';
  end if;
  perform set_config('cmp.op', '1', true);
  update auth.users
     set encrypted_password = crypt(p_nouveau, gen_salt('bf', 10)), updated_at = now()
   where id = moi;
  return 'ok';
end
$$;

revoke all on function public.cmp_entreprise_mot_de_passe(text, text) from public;
grant execute on function public.cmp_entreprise_mot_de_passe(text, text) to authenticated;

revoke all on function public.acces_code_neuf() from public;
revoke all on function public.cmp_acces_demander(text, text) from public;
revoke all on function public.cmp_acces_etat(uuid) from public;
revoke all on function public.cmp_acces_fini(uuid) from public;
revoke all on function public.cmp_acces_annuler(uuid) from public;
revoke all on function public.cmp_acces_voir(uuid, text) from public;
revoke all on function public.cmp_acces_decider(uuid, text, text, boolean) from public;
grant execute on function public.cmp_acces_demander(text, text) to authenticated;
grant execute on function public.cmp_acces_etat(uuid) to authenticated;
grant execute on function public.cmp_acces_fini(uuid) to authenticated;
grant execute on function public.cmp_acces_annuler(uuid) to authenticated;
grant execute on function public.cmp_acces_voir(uuid, text) to anon, authenticated;
grant execute on function public.cmp_acces_decider(uuid, text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
select 'acces ok' as etat;
