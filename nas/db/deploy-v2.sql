-- Mise à jour base pour la v2 (style tendre + onglet Mon compte).
-- À exécuter une fois : aligne la table gages sur le code de l'appli
-- et autorise un membre à quitter le foyer.

-- 1) gages : le code utilise text/done/done_at (pas label/honoured)
alter table gages add column if not exists text text;
alter table gages add column if not exists done boolean not null default false;
alter table gages add column if not exists done_at timestamptz;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='gages' and column_name='label'
  ) then
    execute 'alter table gages alter column label drop not null';
  end if;
end $$;

-- 2) autoriser un membre à quitter le foyer (supprimer sa propre ligne)
drop policy if exists mb_del on members;
create policy mb_del on members for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
select 'v2 ok' as etat;
