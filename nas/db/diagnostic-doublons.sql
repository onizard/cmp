-- Deux causes possibles, deux correctifs differents.

\echo '=== A. Deux COMPTES distincts partageant une adresse ==='
select lower(u.email) as adresse, count(*) as comptes,
       string_agg(u.id::text || ' (' || to_char(u.created_at, 'DD/MM HH24:MI') || ')', ' + ') as details
from auth.users u
group by lower(u.email)
having count(*) > 1;

\echo '=== B. Un MEME compte membre de plusieurs foyers ==='
select u.email, count(*) as foyers,
       string_agg(m.household_id::text, ' + ') as lesquels
from members m
join auth.users u on u.id = m.user_id
group by u.email
having count(*) > 1;

\echo '=== Contexte : tous les foyers et leur contenu ==='
select h.id,
       (select count(*) from members m where m.household_id = h.id) as membres,
       (select count(*) from tasks t where t.household_id = h.id and not t.deleted) as taches,
       (select string_agg(coalesce(nullif(btrim(m.display_name), ''), '?') || ' <' || u.email || '>', ', ')
          from members m join auth.users u on u.id = m.user_id
         where m.household_id = h.id) as qui
from households h
order by membres desc, taches desc;
