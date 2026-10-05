-- Mode famille : les recompenses de couple, derriere un code.
--
-- En famille, le catalogue ne propose que les recompenses « tous » et
-- « famille ». Les parents peuvent garder en plus celles du couple : il leur
-- suffit de choisir un code dans Mon compte. Dans le Cerveau, elles restent
-- cachees derriere ce code, pour qu'un enfant qui prend le telephone d'un
-- parent ne les voie pas, ni les bons qui en viennent.
--
--   * foyer_couple : le code (chiffre, bcrypt) et son administrateur, celui
--     qui l'a pose ; lui seul peut le changer, avec l'ancien ;
--   * rewards.couple / claims.couple : la recompense, le bon, sont « de
--     couple » ; l'appli les cache tant que le code n'est pas tape ;
--   * dix codes faux en cinq minutes bloquent la verification cinq minutes.
--
-- Remplace catalogue_ajuste (catalogue.sql) en la completant : a passer apres
-- catalogue.sql et proches.sql ; si catalogue.sql est relance plus tard,
-- relancer celui-ci ensuite. A relancer sans risque : idempotent.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table rewards add column if not exists couple boolean not null default false;
alter table claims add column if not exists couple boolean not null default false;

create table if not exists foyer_couple (
  household_id uuid primary key references households(id) on delete cascade,
  code text not null,
  admin uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Aucune politique : illisible depuis l'appli, seulement par les fonctions.
alter table foyer_couple enable row level security;

create table if not exists couple_essais (
  household_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists couple_essais_idx on couple_essais (household_id, at);
alter table couple_essais enable row level security;

-- --- Le catalogue : les recompenses de couple gardees en famille ---------

create or replace function public.catalogue_ajuste(hid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text := public.mode_foyer(hid);
  avec_couple boolean := exists (select 1 from foyer_couple f where f.household_id = hid);
begin
  update rewards r set deleted = true
    from catalogue_depart c
   where r.household_id = hid and not r.deleted and r.cle = c.cle
     and c.public not in ('tous', mode)
     and not (c.public = 'couple' and avec_couple);
  if avec_couple and mode = 'famille' then
    insert into rewards (household_id, cle, label, cost, couple)
    select hid, c.cle, c.label, c.cost, true
      from catalogue_depart c
     where c.actif and c.public = 'couple'
       and not exists (
         select 1 from rewards r
          where r.household_id = hid and not r.deleted
            and (r.cle = c.cle or lower(r.label) = lower(c.label)));
    update rewards r set couple = true
      from catalogue_depart c
     where r.household_id = hid and not r.deleted and r.cle = c.cle
       and c.public = 'couple' and not r.couple;
  else
    -- A deux, une recompense de couple est une recompense comme une autre.
    update rewards set couple = false where household_id = hid and couple;
  end if;
  return public.catalogue_pour(hid);
end
$$;

-- --- Le code ------------------------------------------------------------

create or replace function public.couple_controle(hid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(hid) then
    raise exception using errcode = '42501', message = 'Ce foyer n''est pas le tien.';
  end if;
  if (select count(*) from couple_essais
       where household_id = hid and at > now() - interval '5 minutes') >= 10 then
    raise exception using errcode = '42501',
      message = 'Trop de codes faux : reessaie dans quelques minutes.';
  end if;
end
$$;

-- Ou en est-on ? { code: y a-t-il un code, admin: est-ce moi qui l'ai pose }.
create or replace function public.cmp_couple_etat(hid uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare f foyer_couple;
begin
  if not public.is_member(hid) then
    return json_build_object('code', false, 'admin', false);
  end if;
  select * into f from foyer_couple where household_id = hid;
  return json_build_object('code', found, 'admin', found and f.admin = auth.uid());
end
$$;

-- Le premier code : celui qui le pose en devient l'administrateur. Les
-- recompenses de couple reviennent aussitot au catalogue.
create or replace function public.cmp_couple_poser(hid uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.couple_controle(hid);
  if coalesce(p_code, '') !~ '^[0-9]{4}$' then
    return 'format';
  end if;
  insert into foyer_couple (household_id, code, admin)
  values (hid, crypt(p_code, gen_salt('bf')), auth.uid())
  on conflict (household_id) do nothing;
  if not found then
    return 'deja';
  end if;
  perform public.catalogue_ajuste(hid);
  return 'ok';
end
$$;

-- Le code est-il bon ? Faux : l'essai compte (sans erreur, pour qu'il reste).
create or replace function public.cmp_couple_verifier(hid uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.couple_controle(hid);
  if exists (select 1 from foyer_couple f
              where f.household_id = hid
                and f.code = crypt(coalesce(p_code, ''), f.code)) then
    return true;
  end if;
  insert into couple_essais (household_id) values (hid);
  return false;
end
$$;

-- Changer le code : seulement l'administrateur, avec l'ancien.
create or replace function public.cmp_couple_changer(hid uuid, p_ancien text, p_nouveau text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare f foyer_couple;
begin
  perform public.couple_controle(hid);
  select * into f from foyer_couple where household_id = hid;
  if not found then
    return 'aucun';
  end if;
  if f.admin is distinct from auth.uid() then
    return 'admin';
  end if;
  if f.code <> crypt(coalesce(p_ancien, ''), f.code) then
    insert into couple_essais (household_id) values (hid);
    return 'faux';
  end if;
  if coalesce(p_nouveau, '') !~ '^[0-9]{4}$' then
    return 'format';
  end if;
  update foyer_couple set code = crypt(p_nouveau, gen_salt('bf')) where household_id = hid;
  return 'ok';
end
$$;

revoke execute on function public.couple_controle(uuid) from public, anon, authenticated;
revoke execute on function public.cmp_couple_etat(uuid) from public, anon;
revoke execute on function public.cmp_couple_poser(uuid, text) from public, anon;
revoke execute on function public.cmp_couple_verifier(uuid, text) from public, anon;
revoke execute on function public.cmp_couple_changer(uuid, text, text) from public, anon;
grant execute on function public.cmp_couple_etat(uuid) to authenticated;
grant execute on function public.cmp_couple_poser(uuid, text) to authenticated;
grant execute on function public.cmp_couple_verifier(uuid, text) to authenticated;
grant execute on function public.cmp_couple_changer(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
select 'couple ok' as etat;
