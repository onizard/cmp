-- Rattrapage du catalogue de récompenses.
--
-- La migration précédente ramenait bêtement tout ce qui était sous 10 points
-- À 10 : le café (5) et le film (8) se retrouvaient tous les deux à 10, ce qui
-- donne deux lignes identiques à l'œil. On ré-étale l'échelle au lieu de
-- l'écraser, puis on supprime les vrais doublons et on les interdit.

\echo '--- avant ---'
select household_id, label, cost from rewards where not deleted order by household_id, cost;

-- 1. Ré-étalement de l'échelle d'origine, libellé par libellé.
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

-- 2. Les récompenses ajoutées à la main qui seraient encore sous le plancher.
update rewards set cost = 10 where not deleted and cost < 10;

-- 3. Vrais doublons (même libellé, même foyer) : on garde le plus ancien.
update rewards set deleted = true
where id in (
  select id from (
    select id, row_number() over (
      partition by household_id, lower(label) order by created_at, id
    ) as rang
    from rewards where not deleted
  ) t where t.rang > 1
);

-- 4. Et on empêche que ça revienne.
create unique index if not exists rewards_uniq_label
  on rewards (household_id, lower(label)) where not deleted;

notify pgrst, 'reload schema';

\echo '--- après ---'
select label, cost from rewards where not deleted order by cost, label;
