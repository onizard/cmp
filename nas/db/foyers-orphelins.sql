-- Un foyer sans habitant ne doit pas survivre.
--
-- Le nettoyage ponctuel ne suffit pas : il faut que ce soit impossible, quelle
-- que soit la porte de sortie — le bouton de suppression, « quitter le foyer »,
-- une cascade depuis auth.users, ou un DELETE lance a la main en SQL. D'ou un
-- declencheur sur members plutot qu'un enieme script a relancer.

create or replace function public.foyer_vide_disparait()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si c'est deja une cascade venue de households, ne pas y retoucher.
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  delete from households h
   where h.id = old.household_id
     and not exists (select 1 from members m where m.household_id = h.id);

  return old;
end
$$;

drop trigger if exists members_dernier_parti on members;
create trigger members_dernier_parti
  after delete on members
  for each row execute function public.foyer_vide_disparait();

-- Et on solde l'existant.
\echo '--- foyers orphelins avant ---'
select h.id,
       (select count(*) from tasks t where t.household_id = h.id and not t.deleted) as taches
from households h
where not exists (select 1 from members m where m.household_id = h.id);

delete from households h
where not exists (select 1 from members m where m.household_id = h.id);

\echo '--- apres ---'
select count(*) as foyers_restants from households;
