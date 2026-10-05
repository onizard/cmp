-- Les sessions : sur un telephone partage, chacun ouvre la sienne.
--
-- En famille, sur le telephone d'un parent (ou une tablette du foyer), on
-- touche son prenom et on tape son code : tout ce qu'on fait ensuite est a
-- son nom, jusqu'a ce qu'on referme. Un adulte qui a son propre compte peut
-- donc agir sur le telephone d'un autre — avec son code, jamais sans.
--
--   * agit_pour(foyer, membre) : ce compte agit-il pour ce membre ? Oui si
--     c'est lui, ou si le code du membre a ete tape ici (le ticket de
--     codes.sql, un quart d'heure, prolonge tant que la session vit) ;
--   * une tache s'ajoute, se coche, se decoche, se modifie et se reserve au
--     nom de qui agit, pas seulement du compte connecte ;
--   * un bon se prend, s'utilise et se valide de meme ;
--   * tasks.created_proche : le membre sans compte (un enfant) qui a ajoute
--     la tache, comme done_proche dit qui l'a faite.
--
-- Remplace, en les completant, decoche_reservee_a_l_auteur (decoche.sql),
-- tache_reservee_a_l_auteur (taches-auteur.sql), tache_reservation
-- (reservation.sql), cmp_task_event (proches.sql) et les politiques
-- cl_insert et cl_update (bons-proprietaire.sql, proches.sql). A passer apres
-- eux et apres codes.sql ; si l'un d'eux est relance plus tard, relancer
-- celui-ci ensuite. A relancer sans risque : idempotent.

alter table tasks add column if not exists created_proche uuid references proches(id) on delete set null;

-- --- Qui agit -------------------------------------------------------------

create or replace function public.agit_pour(hid uuid, p_membre uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_membre is not null
     and (p_membre = auth.uid()
          or (exists (select 1 from members m
                       where m.household_id = hid and m.user_id = p_membre)
              and exists (select 1 from membres_tickets k
                           where k.household_id = hid and k.membre = p_membre
                             and k.par = auth.uid() and k.expire > now())))
$$;

-- La session vit : son ticket aussi. Expire, il ne se prolonge plus (il faut
-- retaper le code).
create or replace function public.cmp_ticket_prolonger(hid uuid, p_membre uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(hid) then
    return false;
  end if;
  update membres_tickets set expire = now() + interval '15 minutes'
   where household_id = hid and membre = p_membre
     and par = auth.uid() and expire > now();
  return found;
end
$$;

-- --- Les taches -----------------------------------------------------------

-- On ajoute et on coche en son nom, ou au nom de qui a ouvert sa session ici.
-- Un membre sans compte qui ajoute est du foyer ; on ne change plus ensuite
-- qui a ajoute.
create or replace function public.tache_acteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('cmp.op', true) = '1' or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' and new.created_by is not null
     and not public.agit_pour(new.household_id, new.created_by) then
    raise exception using errcode = '42501',
      message = 'On n''ajoute une tache qu''en son nom.';
  end if;
  if new.done and new.done_by is not null
     and (tg_op = 'INSERT' or not old.done or new.done_by is distinct from old.done_by)
     and not public.agit_pour(new.household_id, new.done_by) then
    raise exception using errcode = '42501',
      message = 'On ne coche une tache qu''en son nom.';
  end if;
  if tg_op = 'INSERT' then
    if new.created_proche is not null
       and not exists (select 1 from proches p
                        where p.id = new.created_proche
                          and p.household_id = new.household_id and p.actif) then
      raise exception using errcode = '42501',
        message = 'Ce membre ne fait pas partie du foyer.';
    end if;
  elsif new.created_proche is distinct from old.created_proche
        and new.created_proche is not null then
    raise exception using errcode = '42501',
      message = 'On ne change pas qui a ajoute une tache.';
  end if;
  return new;
end
$$;

drop trigger if exists tasks_acteur on tasks;
create trigger tasks_acteur
  before insert or update on tasks
  for each row execute function public.tache_acteur();

-- On ne decoche que ce qu'on a coche soi-meme (decoche.sql), session comprise.
create or replace function public.decoche_reservee_a_l_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('cmp.op', true) = '1' then
    return new;
  end if;
  if not (old.done and not new.done) then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if old.done_by is not null and not public.agit_pour(old.household_id, old.done_by) then
    raise exception using
      errcode = '42501',
      message = 'Seul l''auteur d''une tache cochee peut la decocher.';
  end if;
  return new;
end
$$;

-- Seul l'auteur modifie ou supprime (taches-auteur.sql), session comprise.
create or replace function public.tache_reservee_a_l_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('cmp.op', true) = '1' then
    return new;
  end if;
  if auth.uid() is null or old.created_by is null
     or public.agit_pour(old.household_id, old.created_by) then
    return new;
  end if;
  if new.text        is distinct from old.text
  or new.deleted     is distinct from old.deleted
  or new.due_at      is distinct from old.due_at
  or new.due_has_time is distinct from old.due_has_time
  or new.month       is distinct from old.month then
    raise exception using errcode = '42501',
      message = 'Seul l''auteur d''une tache peut la modifier ou la supprimer.';
  end if;
  return new;
end
$$;

drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks
  for delete using (
    public.is_member(household_id)
    and (created_by is null or public.agit_pour(household_id, created_by)));

-- « Je m'en occupe » (reservation.sql), au nom de qui agit : memes regles,
-- comptees par personne.
create or replace function public.tache_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  moi constant uuid := auth.uid();
  qui uuid;
  fuseau constant text := 'Europe/Paris';
begin
  if current_setting('cmp.op', true) = '1' then
    return new;
  end if;
  -- Une tache reservee par l'autre est bloquee : on ne la coche pas a sa
  -- place tant que sa reservation court.
  if moi is not null and new.done and not old.done
     and old.reserve_par is not null
     and old.reserve_par is distinct from coalesce(new.done_by, moi)
     and old.reserve_fin > now() then
    raise exception using errcode = '42501',
      message = 'L''autre s''occupe de cette tache : elle se coche a la fin de sa reservation.';
  end if;

  if new.reserve_par   is not distinct from old.reserve_par
 and new.reserve_debut is not distinct from old.reserve_debut
 and new.reserve_fin   is not distinct from old.reserve_fin then
    return new;
  end if;
  if moi is null then
    return new;
  end if;

  -- Une nouvelle reservation.
  if new.reserve_par   is distinct from old.reserve_par
  or new.reserve_debut is distinct from old.reserve_debut then
    qui := new.reserve_par;
    if not public.agit_pour(new.household_id, qui) then
      raise exception using errcode = '42501',
        message = 'On ne reserve une tache que pour soi.';
    end if;
    if old.done or old.deleted then
      raise exception using errcode = '42501',
        message = 'Une tache faite ou supprimee ne se reserve pas.';
    end if;
    if old.reserve_par is not null and old.reserve_par <> qui
       and old.reserve_fin > now() then
      raise exception using errcode = '42501',
        message = 'L''autre s''occupe deja de cette tache.';
    end if;
    if old.reserve_par = qui
       and (old.reserve_debut at time zone fuseau)::date
         = (now() at time zone fuseau)::date then
      raise exception using errcode = '42501',
        message = 'Tache deja reservee aujourd''hui : de nouveau possible demain.';
    end if;
    if exists (
      select 1 from tasks t
       where t.household_id = new.household_id
         and t.id <> new.id
         and t.reserve_par = qui
         and t.reserve_fin > now()
         and not t.done and not t.deleted
    ) then
      raise exception using errcode = '42501',
        message = 'Une seule tache reservee a la fois.';
    end if;
    new.reserve_debut := now();
    new.reserve_fin := now() + interval '1 hour';
    return new;
  end if;

  -- Seule la fin bouge : une annulation, par qui a reserve.
  if not public.agit_pour(old.household_id, old.reserve_par) then
    raise exception using errcode = '42501',
      message = 'Seule la personne qui a reserve peut annuler.';
  end if;
  new.reserve_fin := least(now(), old.reserve_fin);
  return new;
end
$$;

-- Les notifications : l'enfant qui ajoute est nomme, comme celui qui coche.
create or replace function cmp_task_event() returns trigger
language plpgsql as $f$
declare ev json;
begin
  if TG_OP = 'INSERT' then
    if new.deleted or new.done then return new; end if;
    ev := json_build_object('kind','add','household',new.household_id,
                            'actor',new.created_by,'text',new.text,
                            'proche',new.created_proche);
  elsif TG_OP = 'UPDATE' then
    if new.done and not old.done and not new.deleted then
      ev := json_build_object('kind','done','household',new.household_id,
                              'actor',new.done_by,'text',new.text,
                              'proche',new.done_proche);
    elsif new.reserve_par is not null
      and new.reserve_debut is distinct from old.reserve_debut
      and not new.done and not new.deleted then
      ev := json_build_object('kind','reserve','household',new.household_id,
                              'actor',new.reserve_par,'text',new.text);
    elsif new.reserve_par is not null
      and new.reserve_debut is not distinct from old.reserve_debut
      and new.reserve_fin < old.reserve_fin
      and old.reserve_fin > now()
      and not new.done and not new.deleted then
      ev := json_build_object('kind','libere','household',new.household_id,
                              'actor',new.reserve_par,'text',new.text);
    else
      return new;
    end if;
  else
    return new;
  end if;
  perform pg_notify('cmp_push', ev::text);
  return new;
end $f$;

-- --- Les bons -------------------------------------------------------------

drop policy if exists cl_insert on claims;
create policy cl_insert on claims for insert to authenticated
  with check (is_member(household_id) and public.agit_pour(household_id, user_id));

drop policy if exists cl_update on claims;
create policy cl_update on claims for update to authenticated
  using (is_member(household_id) and (public.agit_pour(household_id, user_id) or proche is not null))
  with check (is_member(household_id) and (public.agit_pour(household_id, user_id) or proche is not null));

revoke execute on function public.agit_pour(uuid, uuid) from public, anon;
grant execute on function public.agit_pour(uuid, uuid) to authenticated;
revoke execute on function public.cmp_ticket_prolonger(uuid, uuid) from public, anon;
grant execute on function public.cmp_ticket_prolonger(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
select 'sessions ok' as etat;
