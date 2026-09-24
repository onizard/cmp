-- Un bon utilise engage l'autre, jusqu'a ce que son detenteur dise « c'est fait ».
--
-- Jusqu'ici « Utiliser » poinconnait le bon et c'etait tout : l'autre n'en
-- savait rien. Desormais un bon utilise est EN ATTENTE. L'autre est prevenu tout
-- de suite, puis relance regulierement, et le voit au milieu de son ecran a
-- chaque ouverture. Seul le detenteur peut clore l'affaire, en validant que la
-- recompense a bien ete honoree : c'est `realise_at`.
--
-- `rappel_at` est tenu par le service d'envoi : la date du dernier rappel,
-- pour les espacer.

alter table claims add column if not exists realise_at timestamptz;
alter table claims add column if not exists rappel_at timestamptz;

-- Les bons deja utilises avant cette version sont consideres comme honores :
-- sans cela, chaque foyer verrait d'un coup ressurgir, avec rappels, tous les
-- bons poinconnes depuis le debut.
update claims set realise_at = used_at
 where used_at is not null and realise_at is null;

-- Garde-fous, quelle que soit la version de l'application :
--   · on ne valide qu'un bon deja utilise ;
--   · une validation ne se retire pas, un bon utilise ne se « desutilise » pas.
-- L'ecriture elle-meme est deja reservee au detenteur (politique cl_update) :
-- l'autre ne peut donc pas se valider lui-meme.
create or replace function public.bon_cycle_de_vie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- service d'envoi, psql : pas de bride
  end if;
  if new.realise_at is not null and new.used_at is null then
    raise exception using errcode = '42501',
      message = 'On ne valide qu''un bon deja utilise.';
  end if;
  if old.realise_at is not null and new.realise_at is distinct from old.realise_at then
    raise exception using errcode = '42501',
      message = 'Une validation ne se retire pas.';
  end if;
  if old.used_at is not null and new.used_at is distinct from old.used_at then
    raise exception using errcode = '42501',
      message = 'Un bon utilise le reste.';
  end if;
  return new;
end
$$;

drop trigger if exists claims_cycle_de_vie on claims;
create trigger claims_cycle_de_vie
  before update on claims
  for each row execute function public.bon_cycle_de_vie();

-- L'utilisation d'un bon previent le service d'envoi, comme une tache cochee.
create or replace function public.cmp_bon_event()
returns trigger
language plpgsql
as $$
begin
  if new.used_at is not null and old.used_at is null and not new.deleted then
    perform pg_notify('cmp_push', json_build_object(
      'kind', 'bon', 'household', new.household_id,
      'actor', new.user_id, 'claim', new.id)::text);
  end if;
  return new;
end
$$;

drop trigger if exists claims_push on claims;
create trigger claims_push
  after update on claims
  for each row execute function public.cmp_bon_event();

notify pgrst, 'reload schema';

\echo '--- bons en attente (doit etre 0 juste apres la migration) ---'
select count(*) as en_attente from claims
 where used_at is not null and realise_at is null and not deleted;
