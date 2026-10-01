-- Le catalogue de recompenses : une reference unique, et chaque foyer servi.
--
-- Deux choses a regler d'un coup.
--
-- 1. Un foyer cree apres le passage des scripts n'avait AUCUNE recompense :
--    rien ne remplissait son catalogue, il affichait « Le catalogue est vide ».
--    Desormais le catalogue de depart vit dans une table, et un declencheur le
--    copie dans chaque nouveau foyer au moment de sa creation.
--
-- 2. Plus de corvees parmi les recompenses. Faire la vaisselle a la place de
--    l'autre n'est pas un cadeau : c'est une tache, et sa place est dans la
--    liste, ou chacun la prend. Les recompenses gardent le plaisir — a deux, ou
--    du temps pour soi. Les corvees sont retirees du catalogue (deleted), pas
--    effacees : les bons deja achetes restent valables et traduits.
--
-- Idempotent : le relancer ne double rien et ne ressuscite rien.

create table if not exists catalogue_depart (
  cle   text primary key,
  label text not null,
  cost  numeric(6,1) not null check (cost > 0),
  actif boolean not null default true
);
-- Aucune politique : ni lue ni ecrite depuis l'application, seulement ici.
alter table catalogue_depart enable row level security;

-- A qui s'adresse chaque recompense : a tous, au couple seulement, ou a la
-- famille seulement. Un foyer est une famille des qu'il compte 3 membres.
alter table catalogue_depart add column if not exists public text not null default 'tous';
alter table catalogue_depart drop constraint if exists catalogue_depart_public_check;
alter table catalogue_depart add constraint catalogue_depart_public_check
  check (public in ('tous', 'couple', 'famille'));

insert into catalogue_depart (cle, label, cost, actif, public) values
  ('cafeAuLit', 'Un café servi au lit', 10, true, 'couple'),
  ('filmSoiree', 'Choisir le film de la soirée', 12, true, 'tous'),
  ('grasseMatinee', 'Une grasse matinée, sans réveil', 18, true, 'tous'),
  ('massage20', 'Un massage de 20 minutes', 25, true, 'couple'),
  ('soireeLibre', 'Une soirée entièrement libre', 35, true, 'tous'),
  ('restoAmoureux', 'Un resto en amoureux, organisé par l''autre', 50, true, 'couple'),
  ('journeePourSoi', 'Une journée rien que pour soi', 75, true, 'tous'),
  ('silenceTotal', 'Une heure de silence total', 10, false, 'tous'),
  ('dernierCarre', 'Le dernier carré de chocolat, sans discuter', 10, true, 'tous'),
  ('repasChoisi', 'Choisir le repas du soir', 12, true, 'tous'),
  ('telecommande', 'La télécommande toute la soirée', 12, true, 'tous'),
  ('siesteProtegee', 'Une sieste que personne ne vient interrompre', 18, true, 'tous'),
  ('bainCoule', 'Un bain coulé, sans être dérangé·e', 25, true, 'tous'),
  ('sortieAmis', 'Une sortie entre ami·es, sans rien organiser', 25, true, 'tous'),
  ('matineeDehors', 'Une matinée dehors, sans horaire', 35, true, 'tous'),
  ('weekendSansCorvee', 'Un week-end sans aucune corvée', 50, false, 'tous'),
  ('weekendADeux', 'Un week-end à deux, organisé par l''autre', 75, true, 'couple'),
  ('chocolatChaud', 'Un chocolat chaud à deux, sous un plaid', 10, true, 'couple'),
  ('baladeADeux', 'Une balade à deux, téléphones éteints', 18, true, 'couple'),
  ('soireeSurprise', 'Une soirée surprise, organisée par l''autre', 50, true, 'couple'),
  ('spectacleADeux', 'Un concert ou un spectacle à deux', 50, true, 'couple'),
  ('vaisselle', 'La vaisselle faite par l''autre', 10, false, 'tous'),
  ('poubelles', 'Les poubelles sorties par l''autre pendant une semaine', 12, false, 'tous'),
  ('repasCuisine', 'Le repas du soir cuisiné par l''autre', 18, false, 'tous'),
  ('courses', 'Les courses faites par l''autre', 25, false, 'tous'),
  ('linge', 'Le linge lavé, étendu, plié et rangé par l''autre', 25, false, 'tous'),
  ('rangement', 'La maison rangée par l''autre', 35, false, 'tous'),
  ('menage', 'Le ménage complet fait par l''autre', 50, false, 'tous'),
  ('semaineRepas', 'Une semaine de repas cuisinés par l''autre', 75, false, 'tous'),
  ('dessertChoisi', 'Choisir le dessert', 10, true, 'famille'),
  ('chocolatChantilly', 'Un chocolat chaud avec de la chantilly', 10, true, 'famille'),
  ('musiqueVoiture', 'Choisir la musique en voiture toute la semaine', 12, true, 'famille'),
  ('petitDejAuLit', 'Un petit-déjeuner servi au lit', 18, true, 'famille'),
  ('soireeJeux', 'Une soirée jeux, au jeu de son choix', 18, true, 'famille'),
  ('veillerPlusTard', 'Veiller une heure de plus', 18, true, 'famille'),
  ('soireePizza', 'Une soirée pizza, garnie à son goût', 25, true, 'famille'),
  ('sortieWeekend', 'Choisir la sortie du week-end', 35, true, 'famille'),
  ('piqueNique', 'Un pique-nique au parc, tous ensemble', 35, true, 'famille'),
  ('cinemaPopcorn', 'Une séance de cinéma, avec le pop-corn', 50, true, 'famille'),
  ('journeeAuChoix', 'Une journée où l’on choisit toutes les activités', 75, true, 'famille')
on conflict (cle) do update
  set label = excluded.label, cost = excluded.cost, actif = excluded.actif,
      public = excluded.public;

-- Couple ou famille : famille des 3 membres, ou plus tot si le foyer l'a
-- choisi (interrupteur « Mode famille » dans Mon compte).
alter table households add column if not exists famille boolean not null default false;

create or replace function public.mode_foyer(hid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when coalesce((select h.famille from households h where h.id = hid), false)
             or (select count(*) from members m where m.household_id = hid) >= 3
           then 'famille' else 'couple' end
$$;

-- Remplit le catalogue d'un foyer avec ce qui lui manque, selon qu'il est un
-- couple ou une famille. Une recompense deja presente — meme cle, ou meme
-- libelle — n'est pas doublee.
create or replace function public.catalogue_pour(hid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  mode text := public.mode_foyer(hid);
begin
  insert into rewards (household_id, cle, label, cost)
  select hid, c.cle, c.label, c.cost
    from catalogue_depart c
   where c.actif
     and c.public in ('tous', mode)
     and not exists (
       select 1 from rewards r
        where r.household_id = hid and not r.deleted
          and (r.cle = c.cle or lower(r.label) = lower(c.label)));
  get diagnostics n = row_count;
  return n;
end
$$;

-- A la creation d'un foyer. SECURITY DEFINER : a cet instant, celui qui cree
-- le foyer n'en est pas encore membre, et les politiques lui refuseraient
-- l'ecriture dans rewards.
create or replace function public.foyer_nouveau_catalogue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.catalogue_pour(new.id);
  return new;
end
$$;

drop trigger if exists households_catalogue on households;
create trigger households_catalogue
  after insert on households
  for each row execute function public.foyer_nouveau_catalogue();

-- Ajuste le catalogue d'un foyer a ce qu'il est devenu : on retire ce qui ne
-- s'adresse pas a lui (deleted, pas efface : les bons deja achetes restent
-- valables et traduits), puis on complete.
create or replace function public.catalogue_ajuste(hid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare mode text := public.mode_foyer(hid);
begin
  update rewards r set deleted = true
    from catalogue_depart c
   where r.household_id = hid and not r.deleted and r.cle = c.cle
     and c.public not in ('tous', mode);
  return public.catalogue_pour(hid);
end
$$;

-- Le 3e membre arrive : le foyer devient une famille, son catalogue suit. Et
-- dans l'autre sens s'il repart.
create or replace function public.membre_catalogue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.catalogue_ajuste(coalesce(new.household_id, old.household_id));
  return null;
end
$$;

drop trigger if exists members_catalogue on members;
create trigger members_catalogue
  after insert or delete on members
  for each row execute function public.membre_catalogue();

-- L'interrupteur « Mode famille » : le catalogue suit aussitot.
create or replace function public.foyer_mode_catalogue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.famille is distinct from old.famille then
    perform public.catalogue_ajuste(new.id);
  end if;
  return new;
end
$$;

drop trigger if exists households_mode_catalogue on households;
create trigger households_mode_catalogue
  after update of famille on households
  for each row execute function public.foyer_mode_catalogue();

-- --- Mise a niveau des foyers existants -----------------------------------

-- Les lignes encore sans cle la retrouvent par leur libelle, ancien ou actuel.
update rewards r set cle = v.cle
  from (select cle, label from catalogue_depart
        union all select * from (values
  ('grasseMatinee', 'Une grasse matinée pendant que l''autre gère')
        ) as a(cle, label)) v
 where r.cle is null and lower(r.label) = lower(v.label);

-- Les corvees quittent le catalogue.
update rewards set deleted = true
 where not deleted
   and cle in (select cle from catalogue_depart where not actif);

-- Les libelles reformules, sans heurter un doublon eventuel du nouveau nom.
update rewards r set label = c.label
  from catalogue_depart c
 where r.cle = c.cle and c.actif and not r.deleted and r.label <> c.label
   and not exists (
     select 1 from rewards r2
      where r2.household_id = r.household_id and not r2.deleted
        and r2.id <> r.id and lower(r2.label) = lower(c.label));

-- Chaque foyer recoit ce qui lui manque — y compris ceux qui n'avaient rien.
\echo '--- recompenses ajoutees, tous foyers confondus ---'
select coalesce(sum(public.catalogue_ajuste(h.id)), 0) as ajoutees from households h;

notify pgrst, 'reload schema';

\echo '--- recompenses par foyer : 19 pour un couple, 22 pour une famille (plus, si le foyer en avait ajoute a la main) ---'
select public.mode_foyer(h.id) as mode,
       (select count(*) from rewards r
         where r.household_id = h.id and not r.deleted) as recompenses,
       count(*) as foyers
  from households h
 group by 1, 2 order by 1, 2;
