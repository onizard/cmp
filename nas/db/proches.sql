-- Mode famille : des membres sans compte (les enfants, par exemple).
--
-- Pas d'adresse e-mail, pas de code : un prenom, ajoute depuis Mon compte.
-- Ils agissent sur l'appareil d'un parent (ou une tablette du foyer) : au
-- moment de cocher, on choisit qui a fait la tache. Ils gagnent des points
-- comme les autres, figurent au classement, prennent des bons et peuvent etre
-- designes pour en honorer un.
--
--   * tasks.done_proche : le membre sans compte qui a fait la tache. done_by
--     reste le compte connecte (celui du telephone), comme partout ;
--   * claims.proche : le bon appartient a ce membre (user_id reste le compte
--     qui l'a pris pour lui) ; claims.pour_proche : il est designe pour
--     l'honorer ;
--   * un membre retire (actif = false) garde son historique : ses points
--     comptes restent dans le bilan des autres.
--
-- Remplace, en les completant, cmp_task_event (reservation.sql),
-- cmp_bon_event (famille.sql), mode_foyer (catalogue.sql) et la politique
-- cl_update (bons-proprietaire.sql). A passer APRES eux ; si l'un d'eux est
-- relance plus tard, relancer celui-ci ensuite. A relancer sans risque :
-- tout est idempotent.

create table if not exists proches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nom text not null check (length(btrim(nom)) between 1 and 40),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists proches_foyer_idx on proches (household_id);

alter table proches enable row level security;
drop policy if exists proches_select on proches;
create policy proches_select on proches for select to authenticated
  using (public.is_member(household_id));
drop policy if exists proches_insert on proches;
create policy proches_insert on proches for insert to authenticated
  with check (public.is_member(household_id));
drop policy if exists proches_update on proches;
create policy proches_update on proches for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Pas de DELETE : on retire (actif = false), l'historique reste.
grant select, insert, update on proches to authenticated;

alter table tasks add column if not exists done_proche uuid references proches(id) on delete set null;
alter table claims add column if not exists proche uuid references proches(id) on delete set null;
alter table claims add column if not exists pour_proche uuid references proches(id) on delete set null;

-- --- Les gardes ----------------------------------------------------------

-- Une tache n'est faite que par un membre (actif) du meme foyer ; decochee,
-- elle n'est plus faite par personne.
create or replace function public.tache_proche()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.done then
    new.done_proche := null;
    return new;
  end if;
  if new.done_proche is not null
     and (tg_op = 'INSERT' or new.done_proche is distinct from old.done_proche)
     and not exists (select 1 from proches p
                      where p.id = new.done_proche
                        and p.household_id = new.household_id and p.actif) then
    raise exception using errcode = '42501',
      message = 'Ce membre ne fait pas partie du foyer.';
  end if;
  return new;
end
$$;

drop trigger if exists tasks_proche on tasks;
create trigger tasks_proche
  before insert or update on tasks
  for each row execute function public.tache_proche();

-- Un bon appartient a un membre du foyer, et n'est designe qu'a un autre
-- membre actif du foyer ; une fois utilise, on ne change plus qui l'honore.
create or replace function public.bon_proche()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proche is not null
     and (tg_op = 'INSERT' or new.proche is distinct from old.proche)
     and not exists (select 1 from proches p
                      where p.id = new.proche and p.household_id = new.household_id) then
    raise exception using errcode = '42501',
      message = 'Ce membre ne fait pas partie du foyer.';
  end if;
  if tg_op = 'UPDATE' and new.pour_proche is distinct from old.pour_proche then
    if old.used_at is not null then
      raise exception using errcode = '42501',
        message = 'Le bon est deja utilise : on ne change plus qui l''honore.';
    end if;
    if new.pour_proche is not null
       and (new.pour_proche is not distinct from new.proche
            or not exists (select 1 from proches p
                            where p.id = new.pour_proche
                              and p.household_id = new.household_id and p.actif)) then
      raise exception using errcode = '42501',
        message = 'Cette personne ne peut pas honorer ce bon.';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists claims_proche on claims;
create trigger claims_proche
  before insert or update on claims
  for each row execute function public.bon_proche();

-- Le bon d'un membre sans compte se gere depuis n'importe quel telephone du
-- foyer (il n'en a pas a lui) ; les autres restent a leur seul detenteur.
drop policy if exists cl_update on claims;
create policy cl_update on claims for update to authenticated
  using (is_member(household_id) and (user_id = auth.uid() or proche is not null))
  with check (is_member(household_id) and (user_id = auth.uid() or proche is not null));

-- --- Couple ou famille : les membres sans compte comptent ----------------

create or replace function public.mode_foyer(hid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when coalesce((select h.famille from households h where h.id = hid), false)
             or (select count(*) from members m where m.household_id = hid)
              + (select count(*) from proches p where p.household_id = hid and p.actif) >= 3
           then 'famille' else 'couple' end
$$;

create or replace function public.proche_catalogue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.catalogue_ajuste(new.household_id);
  return null;
end
$$;

drop trigger if exists proches_catalogue on proches;
create trigger proches_catalogue
  after insert or update of actif on proches
  for each row execute function public.proche_catalogue();

-- --- Les notifications : le prenom de celui ou celle qui a fait ---------

-- Meme fonction que dans reservation.sql, avec le membre sans compte en plus.
create or replace function cmp_task_event() returns trigger
language plpgsql as $f$
declare ev json;
begin
  if TG_OP = 'INSERT' then
    if new.deleted or new.done then return new; end if;
    ev := json_build_object('kind','add','household',new.household_id,
                            'actor',new.created_by,'text',new.text);
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

-- Meme fonction que dans famille.sql, avec le membre sans compte en plus.
create or replace function public.cmp_bon_event()
returns trigger
language plpgsql
as $$
begin
  if new.used_at is not null and old.used_at is null and not new.deleted then
    perform pg_notify('cmp_push', json_build_object(
      'kind', 'bon', 'household', new.household_id,
      'actor', new.user_id, 'claim', new.id, 'pour', new.pour,
      'proche', new.proche, 'pour_proche', new.pour_proche)::text);
  end if;
  return new;
end
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'proches'
     ) then
    alter publication supabase_realtime add table proches;
  end if;
end $$;

notify pgrst, 'reload schema';
select 'proches ok' as etat;
