-- Detail des foyers, pour le tableau de bord.
--
-- On y trouve la composition d'un foyer et l'activite de ses membres, jamais
-- le contenu de leurs taches : l'application promet a chacun que personne hors
-- de son foyer ne les lit, et cette promesse vaut aussi pour l'administrateur.
-- Seuls des compteurs sortent d'ici.

create or replace function public.cmp_foyers()
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

  select coalesce(json_agg(f order by f.derniere desc nulls last), '[]'::json)
    into res
  from (
    select
      h.id,
      (select count(*) from members m where m.household_id = h.id) as membres,
      (select count(*) from tasks t
        where t.household_id = h.id and not t.deleted) as taches,
      (select count(*) from tasks t
        where t.household_id = h.id and not t.deleted and not t.done) as restantes,
      (select max(t.updated_at) from tasks t
        where t.household_id = h.id and not t.deleted) as derniere,
      (select coalesce(json_agg(json_build_object(
                'prenom', nullif(btrim(coalesce(m.display_name, '')), ''),
                'email',  u.email,
                'inscrit', u.created_at,
                'vu',     u.last_sign_in_at
              ) order by u.created_at), '[]'::json)
         from members m
         join auth.users u on u.id = m.user_id
        where m.household_id = h.id) as gens
    from households h
  ) f;

  return res;
end
$$;

grant execute on function public.cmp_foyers() to authenticated;

notify pgrst, 'reload schema';

select 'foyers ok' as etat;
