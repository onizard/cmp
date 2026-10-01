-- Mode famille : des 3 membres, un bon utilise designe qui l'honore.
--
-- A deux, pas de question : c'est l'autre. A plusieurs, celui qui utilise son
-- bon choisit la personne qui le realisera. Seule cette personne recoit
-- l'alerte et les rappels, et voit le bon au milieu de son ecran. Le detenteur
-- reste seul a pouvoir dire « c'est fait » (politique cl_update, inchangee).
--
-- Un bon sans destinataire (couple, ou application pas encore a jour) garde
-- le fonctionnement d'avant : tout le foyer, sauf le detenteur, est prevenu.
--
-- Le catalogue famille et sa bascule vivent dans catalogue.sql, a passer
-- AVANT ce fichier. A relancer sans risque : tout est idempotent.

alter table claims add column if not exists pour uuid;

-- Garde-fous, quelle que soit la version de l'application :
--   · on ne designe qu'un membre du foyer, et jamais soi-meme ;
--   · une fois le bon utilise, on ne change plus qui l'honore.
create or replace function public.bon_destinataire()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.pour is not distinct from old.pour then
    return new; -- service d'envoi, psql, ou rien a verifier
  end if;
  if old.used_at is not null then
    raise exception using errcode = '42501',
      message = 'Ce bon est deja utilise : on ne change plus qui l''honore.';
  end if;
  if new.pour is not null then
    if new.pour = new.user_id then
      raise exception using errcode = '42501',
        message = 'On ne designe pas soi-meme pour honorer son bon.';
    end if;
    if not exists (select 1 from members m
                    where m.household_id = new.household_id
                      and m.user_id = new.pour) then
      raise exception using errcode = '42501',
        message = 'Cette personne ne fait pas partie du foyer.';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists claims_destinataire on claims;
create trigger claims_destinataire
  before update on claims
  for each row execute function public.bon_destinataire();

-- Le service d'envoi apprend a qui s'adresse le bon.
create or replace function public.cmp_bon_event()
returns trigger
language plpgsql
as $$
begin
  if new.used_at is not null and old.used_at is null and not new.deleted then
    perform pg_notify('cmp_push', json_build_object(
      'kind', 'bon', 'household', new.household_id,
      'actor', new.user_id, 'claim', new.id, 'pour', new.pour)::text);
  end if;
  return new;
end
$$;

notify pgrst, 'reload schema';
select 'famille ok' as etat;
