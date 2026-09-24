-- Un achat s'annule dans la minute, pas au-dela.
--
-- L'application propose « Annuler » pendant soixante secondes apres l'achat,
-- pour une erreur de doigt. La base applique la meme borne, avec deux minutes
-- de marge pour un reseau lent : sans elle, un telephone reste sur une ancienne
-- version pourrait encore annuler un bon de la semaine derniere et recuperer
-- ses points.
--
-- auth.uid() est nul depuis psql : l'administrateur garde la main pour
-- rembourser a tout moment, comme il le faisait a la main.

create or replace function public.bon_annulation_bornee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (new.deleted and not old.deleted) then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if old.used_at is not null then
    raise exception using
      errcode = '42501',
      message = 'Un bon deja utilise ne s''annule pas.';
  end if;

  if now() - old.created_at > interval '2 minutes' then
    raise exception using
      errcode = '42501',
      message = 'Le delai d''annulation est passe.';
  end if;

  return new;
end
$$;

drop trigger if exists claims_annulation_bornee on claims;
create trigger claims_annulation_bornee
  before update on claims
  for each row execute function public.bon_annulation_bornee();

-- Plus aucun client n'efface un bon pour de bon : l'annulation passe par
-- `deleted`, que le declencheur ci-dessus surveille. Un DELETE, lui, lui
-- echapperait. La suppression de compte, qui en a besoin, tourne en
-- SECURITY DEFINER et n'est pas concernee par cette politique.
drop policy if exists cl_delete on claims;

notify pgrst, 'reload schema';
