-- CMP — schéma complet à coller dans l'éditeur SQL de Supabase.
-- Idempotent : peut être ré-exécuté sans erreur.

-- 1. Tables ---------------------------------------------------------------

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Maison'
);

create table if not exists members (
  user_id uuid references auth.users on delete cascade,
  household_id uuid references households on delete cascade,
  primary key (user_id, household_id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  text text not null,
  month text not null,
  position int not null default 0,
  done boolean not null default false,
  done_month text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_household_idx on tasks (household_id);

-- 2. Fonction d'appartenance (SECURITY DEFINER pour éviter la récursion RLS)

create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_member(uuid) to authenticated;

-- 3. Trigger : met à jour updated_at à chaque modification d'une tâche -----

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 4. Row Level Security ---------------------------------------------------

alter table households enable row level security;
alter table members    enable row level security;
alter table tasks      enable row level security;

-- households : visibles et modifiables par leurs membres ; création libre
-- (pour créer le premier foyer avant d'en être membre).
drop policy if exists households_select on households;
create policy households_select on households
  for select using (public.is_member(id));

drop policy if exists households_insert on households;
create policy households_insert on households
  for insert with check (auth.uid() is not null);

drop policy if exists households_update on households;
create policy households_update on households
  for update using (public.is_member(id)) with check (public.is_member(id));

-- members : un utilisateur ne gère que sa propre ligne ; il voit les membres
-- des foyers auxquels il appartient (le code d'invitation = l'id du foyer).
drop policy if exists members_select on members;
create policy members_select on members
  for select using (user_id = auth.uid() or public.is_member(household_id));

drop policy if exists members_insert on members;
create policy members_insert on members
  for insert with check (user_id = auth.uid());

drop policy if exists members_delete on members;
create policy members_delete on members
  for delete using (user_id = auth.uid());

-- tasks : lisibles et modifiables uniquement par les membres du même foyer.
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks
  for select using (public.is_member(household_id));

drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks
  for insert with check (public.is_member(household_id));

drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks
  for update using (public.is_member(household_id))
  with check (public.is_member(household_id));

drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks
  for delete using (public.is_member(household_id));

-- 5. Temps réel : diffuser les changements de tasks -----------------------

alter table tasks replica identity full;

-- Crée la publication si l'image ne l'a pas déjà fait, puis y ajoute tasks.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table tasks;
  end if;
end $$;
