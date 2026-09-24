-- Plusieurs recompenses par palier, et traduites.
--
-- Le catalogue n'en comptait qu'une par prix : atteindre un palier ne laissait
-- donc aucun choix, juste une case a cocher. On garde les memes paliers — ils
-- forment une echelle qui marche — et on y pose de quoi hesiter.
--
-- (Les corvees posees par la premiere version de ce script ont ete retirees :
-- voir catalogue.sql. Relance, il ne les remet plus.)
--
-- Chaque recompense du catalogue porte desormais une `cle`. L'application s'en
-- sert pour afficher le libelle dans la langue de chacun ; le `label` francais
-- reste en base comme repli, et pour les recompenses sans cle.
--
-- Pose pour TOUS les foyers, pas seulement les nouveaux. Idempotent : un
-- libelle deja present n'est pas redouble, une cle deja posee est reposee.

alter table rewards add column if not exists cle text;

insert into rewards (household_id, cle, label, cost)
select h.id, v.cle, v.label, v.cost
from households h
cross join (values
  ('silenceTotal', 'Une heure de silence total', 10),
  ('dernierCarre', 'Le dernier carré de chocolat, sans discuter', 10),
  ('repasChoisi', 'Choisir le repas du soir', 12),
  ('telecommande', 'La télécommande toute la soirée', 12),
  ('siesteProtegee', 'Une sieste que personne ne vient interrompre', 18),
  ('bainCoule', 'Un bain coulé, sans être dérangé·e', 25),
  ('sortieAmis', 'Une sortie entre ami·es, sans rien organiser', 25),
  ('matineeDehors', 'Une matinée dehors, sans horaire', 35),
  ('weekendADeux', 'Un week-end à deux, organisé par l''autre', 75)
) as v(cle, label, cost)
where not exists (
  select 1 from rewards r
   where r.household_id = h.id
     and lower(r.label) = lower(v.label)
     and not r.deleted
);

-- Les recompenses deja en place recoivent leur cle, retrouvee par le libelle.
update rewards r set cle = v.cle
from (values
  ('cafeAuLit', 'Un café servi au lit', 10),
  ('filmSoiree', 'Choisir le film de la soirée', 12),
  ('grasseMatinee', 'Une grasse matinée pendant que l''autre gère', 18),
  ('massage20', 'Un massage de 20 minutes', 25),
  ('soireeLibre', 'Une soirée entièrement libre', 35),
  ('restoAmoureux', 'Un resto en amoureux, organisé par l''autre', 50),
  ('journeePourSoi', 'Une journée rien que pour soi', 75),
  ('silenceTotal', 'Une heure de silence total', 10),
  ('dernierCarre', 'Le dernier carré de chocolat, sans discuter', 10),
  ('repasChoisi', 'Choisir le repas du soir', 12),
  ('telecommande', 'La télécommande toute la soirée', 12),
  ('siesteProtegee', 'Une sieste que personne ne vient interrompre', 18),
  ('bainCoule', 'Un bain coulé, sans être dérangé·e', 25),
  ('sortieAmis', 'Une sortie entre ami·es, sans rien organiser', 25),
  ('matineeDehors', 'Une matinée dehors, sans horaire', 35),
  ('weekendSansCorvee', 'Un week-end sans aucune corvée', 50),
  ('weekendADeux', 'Un week-end à deux, organisé par l''autre', 75),
  ('vaisselle', 'La vaisselle faite par l''autre', 10),
  ('poubelles', 'Les poubelles sorties par l''autre pendant une semaine', 12),
  ('repasCuisine', 'Le repas du soir cuisiné par l''autre', 18),
  ('courses', 'Les courses faites par l''autre', 25),
  ('linge', 'Le linge lavé, étendu, plié et rangé par l''autre', 25),
  ('rangement', 'La maison rangée par l''autre', 35),
  ('menage', 'Le ménage complet fait par l''autre', 50),
  ('semaineRepas', 'Une semaine de repas cuisinés par l''autre', 75)
) as v(cle, label, cost)
where lower(r.label) = lower(v.label) and r.cle is distinct from v.cle;

notify pgrst, 'reload schema';

\echo '--- catalogue par palier ---'
select cost, count(*) as choix, count(cle) as traduites
from rewards where not deleted
group by cost order by cost;
