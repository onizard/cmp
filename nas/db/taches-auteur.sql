-- Seul l'auteur d'une tache peut la modifier ou la supprimer.
--
-- La tache de l'autre se coche — c'est meme ce qui rapporte le plus — mais ne
-- se reecrit pas : ni son texte, ni son echeance (qui declenche des rappels
-- pressants pour tout le foyer), ni sa suppression. La garde de l'application
-- ne vaut que pour elle ; une PWA en retard d'une mise a jour l'ignore. La
-- regle vit donc ici.
--
-- Une tache sans auteur enregistre n'appartient a personne : chacun peut la
-- modifier, sans quoi elle resterait figee pour toujours. Le service d'envoi
-- et psql (auth.uid() nul) ne sont pas brides.

create or replace function public.tache_reservee_a_l_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mode entreprise : l'operation a deja ete verifiee par le code operateur,
  -- dans une fonction de entreprise.sql (drapeau local a la transaction).
  if current_setting('cmp.op', true) = '1' then
    return new;
  end if;
  if auth.uid() is null or old.created_by is null or old.created_by = auth.uid() then
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

drop trigger if exists tasks_reservee_a_l_auteur on public.tasks;
create trigger tasks_reservee_a_l_auteur
  before update on public.tasks
  for each row execute function public.tache_reservee_a_l_auteur();

-- L'application n'efface jamais une tache pour de bon (elle la marque
-- `deleted`). Un DELETE direct echapperait au declencheur : on le reserve lui
-- aussi a l'auteur. La suppression de compte tourne en SECURITY DEFINER et
-- n'est pas concernee.
drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks
  for delete using (
    public.is_member(household_id)
    and (created_by is null or created_by = auth.uid()));

notify pgrst, 'reload schema';
