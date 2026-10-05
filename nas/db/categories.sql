-- Categories de taches et ordre manuel : pour ranger la liste du mois.
--
--   * une tache porte au plus une categorie (tasks.categorie, un simple nom) ;
--     elle s'ajoute avec « #nom » a la fin du texte, ou en glissant la tache
--     dans sa section ;
--   * la table categories garde celles qu'on a creees avec le bouton
--     « Ajouter une categorie » pour un mois, meme vides, pour que l'autre les
--     voie aussi ;
--   * tasks.rang : l'ordre choisi a la main (appui long, puis glisser). Nul
--     tant qu'on n'a rien deplace : l'ordre automatique s'applique ;
--   * n'importe quel membre du foyer range et deplace n'importe quelle tache :
--     ce n'est pas « qui a fait quoi », juste du rangement. En entreprise, ou
--     l'ecriture directe est fermee, cmp_taches_ranger le fait sans code.
--
-- A passer apres entreprise.sql. A relancer sans risque : idempotent.

alter table tasks add column if not exists categorie text;
alter table tasks add column if not exists rang double precision;
alter table tasks drop constraint if exists tasks_categorie_check;
alter table tasks add constraint tasks_categorie_check
  check (categorie is null or length(btrim(categorie)) between 1 and 40);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  mois text not null,
  nom text not null check (length(btrim(nom)) between 1 and 40),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);
-- Une seule « Dépense » par mois, quelle que soit la casse.
create unique index if not exists categories_mois_nom
  on categories (household_id, mois, lower(btrim(nom)));

alter table categories enable row level security;

drop policy if exists categories_select on categories;
create policy categories_select on categories
  for select using (public.is_member(household_id));

drop policy if exists categories_insert on categories;
create policy categories_insert on categories
  for insert with check (public.is_member(household_id));

drop policy if exists categories_delete on categories;
create policy categories_delete on categories
  for delete using (public.is_member(household_id));

grant select, insert, delete on categories to authenticated;

alter table categories replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'categories'
     ) then
    alter publication supabase_realtime add table categories;
  end if;
end $$;

-- Ranger plusieurs taches d'un coup : [{ "id": …, "categorie": …, "rang": … }].
-- Une cle absente ne change rien ; « categorie » nulle ou vide sort la tache
-- de sa categorie. Sert en entreprise, ou les gardes refusent l'ecriture
-- directe ; en perso, l'appli ecrit directement (et hors ligne).
create or replace function public.cmp_taches_ranger(p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ch jsonb;
  hid uuid;
  c text;
begin
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 then
    raise exception using errcode = '22023', message = 'Liste de rangement invalide.';
  end if;
  for ch in select * from jsonb_array_elements(p_changes) loop
    select household_id into hid from tasks where id = (ch->>'id')::uuid;
    if hid is null or not public.is_member(hid) then
      raise exception using errcode = '42501', message = 'Tache introuvable.';
    end if;
    c := nullif(btrim(coalesce(ch->>'categorie', '')), '');
    if c is not null and length(c) > 40 then
      raise exception using errcode = '22023', message = 'Nom de categorie trop long.';
    end if;
    perform set_config('cmp.op', '1', true);
    update tasks set
      categorie = case when ch ? 'categorie' then c else categorie end,
      rang = case when ch ? 'rang' then (ch->>'rang')::double precision else rang end
     where id = (ch->>'id')::uuid;
    perform set_config('cmp.op', '', true);
  end loop;
end
$$;

drop function if exists public.cmp_tache_categorie(uuid, text);
revoke execute on function public.cmp_taches_ranger(jsonb) from public, anon;
grant execute on function public.cmp_taches_ranger(jsonb) to authenticated;

notify pgrst, 'reload schema';
select 'categories ok' as etat;
