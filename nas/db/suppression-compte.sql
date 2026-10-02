-- Suppression de son propre compte, par la personne elle-meme.
--
-- Deux garde-fous tiennent tout :
--   1. la fonction ne prend AUCUN parametre : elle ne peut agir que sur
--      auth.uid(), donc sur l'appelant. Personne ne peut supprimer autrui.
--   2. les taches d'un foyer partage ne sont PAS detruites : elles
--      appartiennent aussi a l'autre. On efface seulement le lien vers la
--      personne qui part. Le foyer n'est supprime que s'il devient vide.

--
-- Compte entreprise : le compte est partage par toute l'equipe (tous les
-- telephones relies ouvrent le meme compte). Le supprimer efface le foyer,
-- l'equipe et toutes les taches : il faut donc le code responsable, verifie
-- ici. Un code faux est compte contre les codes devines (pas d'erreur levee,
-- sinon l'essai serait annule avec elle).
--
-- Et un compte entreprise ne quitte jamais son foyer : la garde vit sur
-- members, pour qu'aucune version de l'appli ne puisse le faire.
--
-- A passer apres entreprise.sql. A relancer sans risque : idempotent.

-- L'ancienne version, sans parametre : remplacee par celle qui suit (le code
-- a une valeur par defaut, l'appel sans parametre marche toujours).
drop function if exists public.cmp_supprimer_mon_compte();

create or replace function public.cmp_supprimer_mon_compte(p_code_responsable text default null)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  moi uuid := auth.uid();
  foyers uuid[];
  h uuid;
  restants int;
  detruits int := 0;
begin
  if moi is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  select coalesce(array_agg(household_id), '{}'::uuid[])
    into foyers
    from members where user_id = moi;

  -- Compte entreprise : rien ne part sans le code responsable.
  foreach h in array foyers loop
    if exists (select 1 from households where id = h and entreprise) then
      if not public.entreprise_responsable(h, p_code_responsable) then
        return json_build_object('erreur', 'code');
      end if;
    end if;
  end loop;

  -- Les gardes de entreprise.sql laissent passer ce qui a ete verifie ici.
  perform set_config('cmp.op', '1', true);

  -- Les taches restent au foyer, mais perdent leur lien vers la personne :
  -- sans cela, la suppression du compte echouerait sur la cle etrangere.
  update tasks set created_by = null where created_by = moi;
  update tasks set done_by = null    where done_by    = moi;

  -- Ce qui n'appartient qu'a elle s'en va.
  delete from claims             where user_id = moi;
  delete from push_subscriptions where user_id = moi;
  delete from members            where user_id = moi;
  delete from admins             where user_id = moi;

  -- Un foyer dont elle etait la seule habitante disparait, avec son contenu.
  foreach h in array foyers loop
    select count(*) into restants from members where household_id = h;
    if restants = 0 then
      delete from households where id = h;  -- cascade : taches, recompenses, bons
      detruits := detruits + 1;
    end if;
  end loop;

  delete from auth.users where id = moi;
  perform set_config('cmp.op', '', true);

  return json_build_object('foyers_supprimes', detruits);
end
$$;

grant execute on function public.cmp_supprimer_mon_compte(text) to authenticated;

-- Un compte entreprise ne quitte pas son foyer.
create or replace function public.entreprise_ne_quitte_pas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or current_setting('cmp.op', true) = '1' then
    return old;
  end if;
  if exists (select 1 from households h where h.id = old.household_id and h.entreprise) then
    raise exception using errcode = '42501',
      message = 'Un compte entreprise ne quitte pas son foyer.';
  end if;
  return old;
end
$$;

drop trigger if exists members_entreprise on public.members;
create trigger members_entreprise
  before delete on public.members
  for each row execute function public.entreprise_ne_quitte_pas();

notify pgrst, 'reload schema';

select 'suppression ok' as etat;
