-- Mode famille : un code a 4 chiffres par membre, pour ses bons.
--
-- Sur le telephone d'un parent, un enfant pourrait prendre, utiliser ou
-- valider un bon avec les points d'un autre. Chaque membre peut donc avoir un
-- code : tant qu'il en a un, rien ne touche a ses bons sans lui.
--
--   * un compte choisit son propre code (le changer demande l'ancien) ;
--   * le code d'un membre sans compte (un enfant) est choisi par un parent,
--     qui confirme avec son propre code — un enfant ne peut donc pas changer
--     celui d'un autre ;
--   * taper le bon code ouvre, pour ce telephone, un ticket d'un quart
--     d'heure : la base laisse alors prendre, utiliser, annuler ou valider
--     les bons de ce membre ; sans ticket, elle refuse (« cmp:code ») ;
--   * un membre sans code garde le fonctionnement d'avant ;
--   * dix codes faux en cinq minutes bloquent la verification cinq minutes.
--
-- A passer apres proches.sql. A relancer sans risque : idempotent.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- membre : le compte (auth.users) ou le membre sans compte (proches).
create table if not exists membres_codes (
  household_id uuid not null references households(id) on delete cascade,
  membre uuid not null,
  code text not null,
  primary key (household_id, membre)
);
alter table membres_codes enable row level security;

create table if not exists membres_tickets (
  household_id uuid not null references households(id) on delete cascade,
  membre uuid not null,
  par uuid not null,
  expire timestamptz not null,
  primary key (household_id, membre, par)
);
alter table membres_tickets enable row level security;

create table if not exists codes_essais (
  household_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists codes_essais_idx on codes_essais (household_id, at);
alter table codes_essais enable row level security;

create or replace function public.codes_controle(hid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(hid) then
    raise exception using errcode = '42501', message = 'Ce foyer n''est pas le tien.';
  end if;
  if (select count(*) from codes_essais
       where household_id = hid and at > now() - interval '5 minutes') >= 10 then
    raise exception using errcode = '42501',
      message = 'Trop de codes faux : reessaie dans quelques minutes.';
  end if;
end
$$;

-- Qui a un code (pas le code !) : l'appli sait ainsi quand le demander.
create or replace function public.cmp_codes_etat(hid uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_member(hid)
    then coalesce((select json_agg(membre) from membres_codes where household_id = hid), '[]'::json)
    else '[]'::json end
$$;

-- Le bon code de ce membre ? (interne)
create or replace function public.code_bon(hid uuid, p_membre uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (select 1 from membres_codes c
                  where c.household_id = hid and c.membre = p_membre
                    and c.code = crypt(coalesce(p_code, ''), c.code))
$$;

-- Choisir ou changer un code.
--   Le sien : l'ancien s'il y en a un.
--   Celui d'un membre sans compte du foyer : son propre code (le parent doit
--   donc avoir choisi le sien d'abord).
-- Renvoie 'ok', 'format', 'faux', 'parentSansCode' ou 'interdit'.
create or replace function public.cmp_code_poser(hid uuid, p_membre uuid, p_nouveau text, p_preuve text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare moi constant uuid := auth.uid();
begin
  perform public.codes_controle(hid);
  if coalesce(p_nouveau, '') !~ '^[0-9]{4}$' then
    return 'format';
  end if;
  if p_membre = moi then
    if exists (select 1 from membres_codes where household_id = hid and membre = moi)
       and not public.code_bon(hid, moi, p_preuve) then
      insert into codes_essais (household_id) values (hid);
      return 'faux';
    end if;
  elsif exists (select 1 from proches p where p.id = p_membre and p.household_id = hid and p.actif) then
    if not exists (select 1 from membres_codes where household_id = hid and membre = moi) then
      return 'parentSansCode';
    end if;
    if not public.code_bon(hid, moi, p_preuve) then
      insert into codes_essais (household_id) values (hid);
      return 'faux';
    end if;
  else
    return 'interdit';
  end if;
  insert into membres_codes (household_id, membre, code)
  values (hid, p_membre, crypt(p_nouveau, gen_salt('bf')))
  on conflict (household_id, membre) do update set code = excluded.code;
  delete from membres_tickets where household_id = hid and membre = p_membre;
  return 'ok';
end
$$;

-- Taper le code d'un membre : ouvre ses bons pour un quart d'heure, depuis ce
-- compte. Faux : l'essai compte (sans erreur, pour qu'il reste).
create or replace function public.cmp_code_ouvrir(hid uuid, p_membre uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.codes_controle(hid);
  if not public.code_bon(hid, p_membre, p_code) then
    insert into codes_essais (household_id) values (hid);
    return false;
  end if;
  insert into membres_tickets (household_id, membre, par, expire)
  values (hid, p_membre, auth.uid(), now() + interval '15 minutes')
  on conflict (household_id, membre, par) do update set expire = excluded.expire;
  return true;
end
$$;

-- La garde : les bons d'un membre qui a un code ne bougent qu'avec un ticket.
create or replace function public.bon_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare proprio uuid := coalesce(new.proche, new.user_id);
begin
  if auth.uid() is null then
    return new; -- service d'envoi, psql
  end if;
  if tg_op = 'UPDATE'
     and new.used_at is not distinct from old.used_at
     and new.realise_at is not distinct from old.realise_at
     and new.deleted is not distinct from old.deleted
     and new.pour is not distinct from old.pour
     and new.pour_proche is not distinct from old.pour_proche then
    return new; -- rien qui touche aux points ni au bon
  end if;
  if not exists (select 1 from membres_codes c
                  where c.household_id = new.household_id and c.membre = proprio) then
    return new;
  end if;
  if not exists (select 1 from membres_tickets k
                  where k.household_id = new.household_id and k.membre = proprio
                    and k.par = auth.uid() and k.expire > now()) then
    raise exception using errcode = '42501', message = 'cmp:code';
  end if;
  return new;
end
$$;

drop trigger if exists claims_code on claims;
create trigger claims_code
  before insert or update on claims
  for each row execute function public.bon_code();

revoke execute on function public.codes_controle(uuid) from public, anon, authenticated;
revoke execute on function public.code_bon(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.cmp_codes_etat(uuid) from public, anon;
revoke execute on function public.cmp_code_poser(uuid, uuid, text, text) from public, anon;
revoke execute on function public.cmp_code_ouvrir(uuid, uuid, text) from public, anon;
grant execute on function public.cmp_codes_etat(uuid) to authenticated;
grant execute on function public.cmp_code_poser(uuid, uuid, text, text) to authenticated;
grant execute on function public.cmp_code_ouvrir(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
select 'codes ok' as etat;
