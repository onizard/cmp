-- Récompenses : catalogue commun au foyer + dépenses de points.
-- Barème (côté application) : +1 ajouter, +1 cocher sa tâche, +1,5 celle de l'autre.
-- Les points se cumulent sans plafond.
-- Le catalogue commence à 10 points.

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  label text not null,
  cost numeric(6,1) not null check (cost > 0),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  reward_id uuid,
  user_id uuid not null,
  label text not null,            -- figé : l'historique survit aux modifications
  cost numeric(6,1) not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table rewards enable row level security;
alter table claims  enable row level security;

drop policy if exists rw_all on rewards;
create policy rw_all on rewards for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));

-- Chacun ses bons : la lecture est ouverte au foyer (elle sert a calculer les
-- points de l'autre), l'ecriture ne l'est qu'au proprietaire.
drop policy if exists cl_all on claims;

drop policy if exists cl_select on claims;
create policy cl_select on claims for select to authenticated
  using (is_member(household_id));

drop policy if exists cl_insert on claims;
create policy cl_insert on claims for insert to authenticated
  with check (is_member(household_id) and user_id = auth.uid());

drop policy if exists cl_update on claims;
create policy cl_update on claims for update to authenticated
  using (is_member(household_id) and user_id = auth.uid())
  with check (is_member(household_id) and user_id = auth.uid());

drop policy if exists cl_delete on claims;
create policy cl_delete on claims for delete to authenticated
  using (is_member(household_id) and user_id = auth.uid());

grant all on rewards to anon, authenticated, service_role;
grant all on claims  to anon, authenticated, service_role;

-- La cle permet d'afficher chaque recompense dans la langue de chacun.
alter table rewards add column if not exists cle text;

-- Catalogue de départ, uniquement pour les foyers qui n'en ont pas encore.
insert into rewards (household_id, cle, label, cost)
select h.id, v.cle, v.label, v.cost
from households h
cross join (values
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
where not exists (select 1 from rewards r where r.household_id = h.id);

-- Les catalogues déjà en place : on ré-étale l'échelle d'origine au lieu de
-- tout ramener à 10 — sinon le café (5) et le film (8) finissent au même prix
-- et se lisent comme un doublon.
update rewards r set cost = v.cost
from (values
  ('Un café servi au lit', 10),
  ('Choisir le film de la soirée', 12),
  ('Une grasse matinée pendant que l''autre gère', 18),
  ('Un massage de 20 minutes', 25),
  ('Une soirée entièrement libre', 35),
  ('Un resto en amoureux, organisé par l''autre', 50),
  ('Une journée rien que pour soi', 75)
) as v(label, cost)
where r.label = v.label and not r.deleted and r.cost <> v.cost;

-- Ce qui resterait sous le plancher (récompenses ajoutées à la main).
update rewards set cost = 10 where not deleted and cost < 10;

-- Un même libellé ne peut pas exister deux fois dans un foyer.
create unique index if not exists rewards_uniq_label
  on rewards (household_id, lower(label)) where not deleted;

notify pgrst, 'reload schema';
select label, cost from rewards where not deleted order by cost;
