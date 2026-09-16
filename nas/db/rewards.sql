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

drop policy if exists cl_all on claims;
create policy cl_all on claims for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));

grant all on rewards to anon, authenticated, service_role;
grant all on claims  to anon, authenticated, service_role;

-- Catalogue de départ, uniquement pour les foyers qui n'en ont pas encore.
insert into rewards (household_id, label, cost)
select h.id, v.label, v.cost
from households h
cross join (values
  ('Un café servi au lit', 10),
  ('Choisir le film de la soirée', 12),
  ('Une grasse matinée pendant que l''autre gère', 18),
  ('Un massage de 20 minutes', 25),
  ('Une soirée entièrement libre', 35),
  ('Un resto en amoureux, organisé par l''autre', 50),
  ('Une journée rien que pour soi', 75)
) as v(label, cost)
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
