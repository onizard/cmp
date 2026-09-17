-- Rattache chaque personne a UN seul foyer, sans rien perdre.
--
-- Pour qui appartient a plusieurs foyers, on garde le plus « vivant » :
-- d'abord celui qui a le plus de taches, puis celui ou la personne a renseigne
-- son prenom, puis le plus ancien. On ne retire l'appartenance aux autres que
-- s'ils sont VIDES : aucune tache, et personne d'autre dedans. Un foyer qui
-- contient quoi que ce soit n'est jamais touche.

\echo '=== Avant ==='
select u.email, count(*) as foyers
from members m join auth.users u on u.id = m.user_id
group by u.email having count(*) > 1;

with classement as (
  select
    m.user_id,
    m.household_id,
    row_number() over (
      partition by m.user_id
      order by
        (select count(*) from tasks t
          where t.household_id = m.household_id and not t.deleted) desc,
        (nullif(btrim(coalesce(m.display_name, '')), '') is not null) desc,
        m.household_id
    ) as rang
  from members m
  where m.user_id in (
    select user_id from members group by user_id having count(*) > 1
  )
),
aRetirer as (
  select c.user_id, c.household_id
  from classement c
  where c.rang > 1
    -- uniquement si le foyer quitte est vide de tout
    and not exists (select 1 from tasks t
                     where t.household_id = c.household_id and not t.deleted)
    and not exists (select 1 from members m2
                     where m2.household_id = c.household_id
                       and m2.user_id <> c.user_id)
)
delete from members m
using aRetirer r
where m.user_id = r.user_id and m.household_id = r.household_id;

-- Les foyers devenus orphelins disparaissent (aucun membre, aucune tache).
delete from households h
where not exists (select 1 from members m where m.household_id = h.id)
  and not exists (select 1 from tasks t where t.household_id = h.id);

\echo '=== Apres : plus personne dans plusieurs foyers ? ==='
select coalesce((
  select string_agg(email, ', ') from (
    select u.email from members m join auth.users u on u.id = m.user_id
    group by u.email having count(*) > 1
  ) x
), 'aucun') as encore_en_double;

\echo '=== Etat des foyers ==='
select h.id,
       (select count(*) from members m where m.household_id = h.id) as membres,
       (select count(*) from tasks t where t.household_id = h.id and not t.deleted) as taches,
       (select string_agg(coalesce(nullif(btrim(m.display_name), ''), '?') || ' <' || u.email || '>', ', ')
          from members m join auth.users u on u.id = m.user_id
         where m.household_id = h.id) as qui
from households h
order by membres desc, taches desc;
