-- Tableau de bord : réservé aux comptes inscrits dans « admins ».
--
-- Le point essentiel : masquer un onglet dans l'application ne protège RIEN,
-- le code est lisible par tous. La restriction vit donc ici. Les chiffres ne
-- sortent que par une fonction qui vérifie elle-même qui appelle, et elle ne
-- renvoie que des agrégats — jamais le contenu d'un foyer, jamais une tâche.

create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- Personne ne lit cette table par l'API : même la liste des admins est privée.
drop policy if exists adm_none on admins;
create policy adm_none on admins for select to authenticated using (false);

grant select on admins to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- Les statistiques, en un seul appel. Refus net si l'appelant n'est pas admin.
create or replace function public.cmp_stats()
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare res json;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;

  select json_build_object(
    'comptes',        (select count(*) from auth.users),
    'comptes_7j',     (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'comptes_30j',    (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'actifs_7j',      (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'actifs_30j',     (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),

    'foyers',         (select count(*) from households),
    'foyers_a_deux',  (select count(*) from (
                         select household_id from members group by household_id having count(*) > 1
                       ) d),
    'foyers_actifs',  (select count(distinct household_id) from tasks
                        where not deleted and created_at > now() - interval '30 days'),

    'taches',         (select count(*) from tasks where not deleted),
    'taches_7j',      (select count(*) from tasks where not deleted and created_at > now() - interval '7 days'),
    'cochees_7j',     (select count(*) from tasks where not deleted and done
                        and updated_at > now() - interval '7 days'),
    'echeances',      (select count(*) from tasks where not deleted and due_at is not null),

    'notifs',         (select count(*) from push_subscriptions),
    'recompenses',    (select count(*) from claims where not deleted),

    -- Part des comptes qui ont créé au moins une tâche : le vrai taux d'activation.
    'actives',        (select count(distinct created_by) from tasks
                        where created_by is not null and not deleted),

    -- Inscriptions jour par jour sur 30 jours, pour la courbe.
    'courbe',         (select coalesce(json_agg(json_build_object('j', j, 'n', n) order by j), '[]')
                       from (
                         select d::date as j,
                                (select count(*) from auth.users u
                                  where u.created_at >= d and u.created_at < d + interval '1 day') as n
                         from generate_series(
                           (now() - interval '29 days')::date, now()::date, interval '1 day'
                         ) d
                       ) s)
  ) into res;

  return res;
end
$$;

grant execute on function public.cmp_stats() to authenticated;

notify pgrst, 'reload schema';

select 'admin ok' as etat, count(*) as admins from admins;
