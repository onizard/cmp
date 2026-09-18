-- On ne decoche que ce qu'on a coche soi-meme.
--
-- La garde posee dans l'application ne vaut que pour l'application, et encore :
-- une PWA sert sa version en cache, donc un telephone qui n'a pas encore pris
-- la mise a jour continue de decocher la tache de l'autre sans rien demander a
-- personne. La regle doit donc vivre dans la base, seul endroit que tous les
-- clients traversent.
--
-- La regle : seul l'auteur d'une tache cochee peut la decocher. Une tache dont
-- l'auteur n'est pas enregistre (cochee avant que la colonne ne soit remplie,
-- ou dont l'auteur a supprime son compte) n'appartient a personne : chacun peut
-- la decocher, faute de quoi elle resterait cochee pour toujours.

create or replace function public.decoche_reservee_a_l_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seul le passage de « fait » a « a faire » est concerne. Renommer la tache,
  -- lui poser une echeance ou la supprimer reste libre.
  if not (old.done and not new.done) then
    return new;
  end if;

  -- auth.uid() est nul hors requete d'un utilisateur : service de notification,
  -- maintenance en psql, scripts d'administration. On ne les bride pas.
  if auth.uid() is null then
    return new;
  end if;

  if old.done_by is not null and old.done_by <> auth.uid() then
    -- 42501 = privilege insuffisant : PostgREST le rend en HTTP 403, que le
    -- client reconnait comme un refus definitif et non comme une panne reseau.
    raise exception using
      errcode = '42501',
      message = 'Seul l''auteur d''une tache cochee peut la decocher.';
  end if;

  return new;
end
$$;

drop trigger if exists tasks_decoche_reservee on public.tasks;
create trigger tasks_decoche_reservee
  before update on public.tasks
  for each row execute function public.decoche_reservee_a_l_auteur();

notify pgrst, 'reload schema';
