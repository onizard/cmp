-- Reconnaitre un membre a son seul code (famille).
--
-- Sur la liste des taches, on ne demande que le code : il dit qui l'on est.
-- La fonction cherche le membre du foyer qui porte ce code et, s'il est seul
-- a le porter, ouvre son ticket (codes.sql) comme cmp_code_ouvrir.
--
--   * { membre } : c'est lui ;
--   * { membre: null } : code faux (l'essai compte, comme partout) ;
--   * { ambigu: true } : deux membres ont choisi le meme code — l'appli
--     demande alors le prenom.
--
-- A passer apres codes.sql. A relancer sans risque : idempotent.

create or replace function public.cmp_code_qui(hid uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  trouves uuid[];
begin
  perform public.codes_controle(hid);
  select array_agg(c.membre) into trouves
    from membres_codes c
   where c.household_id = hid
     and c.code = crypt(coalesce(p_code, ''), c.code)
     and (exists (select 1 from members m
                   where m.household_id = hid and m.user_id = c.membre)
          or exists (select 1 from proches p
                      where p.id = c.membre and p.household_id = hid and p.actif));
  if trouves is null then
    insert into codes_essais (household_id) values (hid);
    return json_build_object('membre', null);
  end if;
  if array_length(trouves, 1) > 1 then
    return json_build_object('ambigu', true);
  end if;
  insert into membres_tickets (household_id, membre, par, expire)
  values (hid, trouves[1], auth.uid(), now() + interval '15 minutes')
  on conflict (household_id, membre, par) do update set expire = excluded.expire;
  return json_build_object('membre', trouves[1]);
end
$$;

revoke execute on function public.cmp_code_qui(uuid, text) from public, anon;
grant execute on function public.cmp_code_qui(uuid, text) to authenticated;

notify pgrst, 'reload schema';
select 'code-qui ok' as etat;
