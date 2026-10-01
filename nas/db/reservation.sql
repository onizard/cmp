-- Reserver une tache : « je m'en occupe », pour une heure.
--
-- Celui ou celle qui est en train de faire une tache previent l'autre qu'il
-- est inutile de s'y mettre. N'importe quelle tache en attente se reserve,
-- qu'on l'ait ajoutee ou non. Les regles :
--
--   * une reservation dure une heure, puis tombe d'elle-meme ;
--   * une seule reservation a la fois, par personne ;
--   * on peut l'annuler, mais on ne reserve pas deux fois la meme tache le
--     meme jour : il faut attendre le lendemain (jour de Paris, comme les
--     rappels) ;
--   * on ne prend pas la reservation de l'autre tant qu'elle court ;
--   * la tache reservee est bloquee : l'autre ne peut pas la cocher tant que
--     la reservation court.
--
-- L'application applique les memes regles, mais une PWA en retard d'une mise
-- a jour les ignore : elles vivent donc ici. Les heures sont celles du
-- serveur, pas du telephone. psql et le service d'envoi (auth.uid() nul) ne
-- sont pas brides.
--
-- A relancer sans risque : tout est idempotent.

alter table tasks add column if not exists reserve_par uuid;
alter table tasks add column if not exists reserve_debut timestamptz;
alter table tasks add column if not exists reserve_fin timestamptz;

-- « Ai-je deja une reservation en cours ? » : l'index qui va avec.
create index if not exists tasks_reserve_idx
  on tasks (household_id, reserve_par, reserve_fin)
  where reserve_par is not null;

create or replace function public.tache_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  moi constant uuid := auth.uid();
  fuseau constant text := 'Europe/Paris';
begin
  -- Mode entreprise : l'operation a deja ete verifiee par le code operateur,
  -- dans une fonction de entreprise.sql (drapeau local a la transaction).
  if current_setting('cmp.op', true) = '1' then
    return new;
  end if;
  -- Une tache reservee par l'autre est bloquee : on ne la coche pas a sa
  -- place tant que sa reservation court.
  if moi is not null and new.done and not old.done
     and old.reserve_par is not null and old.reserve_par <> moi
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
    if new.reserve_par is distinct from moi then
      raise exception using errcode = '42501',
        message = 'On ne reserve une tache que pour soi.';
    end if;
    if old.done or old.deleted then
      raise exception using errcode = '42501',
        message = 'Une tache faite ou supprimee ne se reserve pas.';
    end if;
    if old.reserve_par is not null and old.reserve_par <> moi
       and old.reserve_fin > now() then
      raise exception using errcode = '42501',
        message = 'L''autre s''occupe deja de cette tache.';
    end if;
    if old.reserve_par = moi
       and (old.reserve_debut at time zone fuseau)::date
         = (now() at time zone fuseau)::date then
      raise exception using errcode = '42501',
        message = 'Tache deja reservee aujourd''hui : de nouveau possible demain.';
    end if;
    if exists (
      select 1 from tasks t
       where t.household_id = new.household_id
         and t.id <> new.id
         and t.reserve_par = moi
         and t.reserve_fin > now()
         and not t.done and not t.deleted
    ) then
      raise exception using errcode = '42501',
        message = 'Une seule tache reservee a la fois.';
    end if;
    -- L'heure du serveur fait foi, pas celle du telephone.
    new.reserve_debut := now();
    new.reserve_fin := now() + interval '1 hour';
    return new;
  end if;

  -- Seule la fin bouge : c'est une annulation, par qui a reserve. On ne peut
  -- que l'avancer, jamais la prolonger.
  if old.reserve_par is distinct from moi then
    raise exception using errcode = '42501',
      message = 'Seule la personne qui a reserve peut annuler.';
  end if;
  new.reserve_fin := least(now(), old.reserve_fin);
  return new;
end
$$;

drop trigger if exists tasks_reservation on public.tasks;
create trigger tasks_reservation
  before update on public.tasks
  for each row execute function public.tache_reservation();

-- Le service d'envoi previent l'autre : « Untel s'occupe de… », et, si la
-- reservation est annulee avant l'heure, « Untel a libere… ». Meme fonction
-- que dans push.sql, avec ces deux cas en plus.
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
                              'actor',new.done_by,'text',new.text);
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

notify pgrst, 'reload schema';
select 'reservation ok' as etat;
