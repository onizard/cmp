-- Suppression de son propre compte, par la personne elle-meme.
--
-- Deux garde-fous tiennent tout :
--   1. la fonction ne prend AUCUN parametre : elle ne peut agir que sur
--      auth.uid(), donc sur l'appelant. Personne ne peut supprimer autrui.
--   2. les taches d'un foyer partage ne sont PAS detruites : elles
--      appartiennent aussi a l'autre. On efface seulement le lien vers la
--      personne qui part. Le foyer n'est supprime que s'il devient vide.

create or replace function public.cmp_supprimer_mon_compte()
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

  return json_build_object('foyers_supprimes', detruits);
end
$$;

grant execute on function public.cmp_supprimer_mon_compte() to authenticated;

notify pgrst, 'reload schema';

select 'suppression ok' as etat;
