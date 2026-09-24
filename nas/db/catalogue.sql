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

insert into catalogue_depart (cle, label, cost, actif) values
  ('cafeAuLit', 'Un café servi au lit', 10, true),
  ('filmSoiree', 'Choisir le film de la soirée', 12, true),
  ('grasseMatinee', 'Une grasse matinée, sans réveil', 18, true),
  ('massage20', 'Un massage de 20 minutes', 25, true),
  ('soireeLibre', 'Une soirée entièrement libre', 35, true),
  ('restoAmoureux', 'Un resto en amoureux, organisé par l''autre', 50, true),
  ('journeePourSoi', 'Une journée rien que pour soi', 75, true),
  ('silenceTotal', 'Une heure de silence total', 10, true),
  ('dernierCarre', 'Le dernier carré de chocolat, sans discuter', 10, true),
  ('repasChoisi', 'Choisir le repas du soir', 12, true),
  ('telecommande', 'La télécommande toute la soirée', 12, true),
  ('siesteProtegee', 'Une sieste que personne ne vient interrompre', 18, true),
  ('bainCoule', 'Un bain coulé, sans être dérangé·e', 25, true),
  ('sortieAmis', 'Une sortie entre ami·es, sans rien organiser', 25, true),
  ('matineeDehors', 'Une matinée dehors, sans horaire', 35, true),
  ('weekendSansCorvee', 'Un week-end sans aucune corvée', 50, false),
  ('weekendADeux', 'Un week-end à deux, organisé par l''autre', 75, true),
  ('baladeADeux', 'Une balade à deux, téléphones éteints', 18, true),
  ('soireeSurprise', 'Une soirée surprise, organisée par l''autre', 50, true),
  ('spectacleADeux', 'Un concert ou un spectacle à deux', 50, true),
  ('vaisselle', 'La vaisselle faite par l''autre', 10, false),
  ('poubelles', 'Les poubelles sorties par l''autre pendant une semaine', 12, false),
  ('repasCuisine', 'Le repas du soir cuisiné par l''autre', 18, false),
  ('courses', 'Les courses faites par l''autre', 25, false),
  ('linge', 'Le linge lavé, étendu, plié et rangé par l''autre', 25, false),
  ('rangement', 'La maison rangée par l''autre', 35, false),
  ('menage', 'Le ménage complet fait par l''autre', 50, false),
  ('semaineRepas', 'Une semaine de repas cuisinés par l''autre', 75, false)
on conflict (cle) do update
  set label = excluded.label, cost = excluded.cost, actif = excluded.actif;

-- Remplit le catalogue d'un foyer avec ce qui lui manque. Une recompense deja
-- presente — meme cle, ou meme libelle — n'est pas doublee.
create or replace function public.catalogue_pour(hid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into rewards (household_id, cle, label, cost)
  select hid, c.cle, c.label, c.cost
    from catalogue_depart c
   where c.actif
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
select coalesce(sum(public.catalogue_pour(h.id)), 0) as ajoutees from households h;

notify pgrst, 'reload schema';

\echo '--- nombre de recompenses par foyer (19 attendu ; plus, si le foyer en avait ajoute a la main) ---'
select n as recompenses, count(*) as foyers
  from (select (select count(*) from rewards r
                 where r.household_id = h.id and not r.deleted) as n
          from households h) x
 group by n order by n;
