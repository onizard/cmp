-- Mode entreprise : « je m'en occupe » pour une heure, au nom d'un membre.
--
-- En entreprise, tous les telephones partagent le meme compte : c'est le
-- CODE OPERATEUR qui dit qui reserve, comme il dit qui coche. Memes regles
-- qu'en perso (reservation.sql), comptees par membre de l'equipe :
--
--   * une reservation dure une heure, puis tombe d'elle-meme ;
--   * une seule reservation a la fois, par membre ;
--   * on peut la liberer avant l'heure (seulement celui ou celle qui l'a
--     prise), mais on ne reserve pas deux fois la meme tache le meme jour ;
--   * on ne prend pas la reservation d'un collegue tant qu'elle court ;
--   * la tache reservee ne se coche que par la personne qui l'a reservee.
--
-- Les refus ne levent pas d'erreur : ils reviennent dans la reponse
-- ({ "op": …, "refus": … }), comme un code faux (op nul), pour que l'essai
-- compte contre les codes devines.
--
-- A passer apres entreprise.sql. A relancer sans risque : idempotent.

alter table tasks add column if not exists reserve_op uuid;

-- Reserver : renvoie { op } si c'est fait, { op: null } si le code est faux,
-- sinon { op, refus: 'autre' | 'aujourdhui' | 'uneAutre' | 'fini', … }.
create or replace function public.cmp_op_reserver(p_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  op uuid;
  autre tasks%rowtype;
  fuseau constant text := 'Europe/Paris';
begin
  select * into t from tasks where id = p_id;
  if not found then
    raise exception using errcode = '42501', message = 'Tache introuvable.';
  end if;
  op := public.entreprise_operateur(t.household_id, p_code);
  if op is null then
    return jsonb_build_object('op', null);
  end if;
  if t.done or t.deleted then
    return jsonb_build_object('op', op, 'refus', 'fini');
  end if;
  if t.reserve_op is not null and t.reserve_fin > now() then
    if t.reserve_op = op then
      return jsonb_build_object('op', op);
    end if;
    return jsonb_build_object('op', op, 'refus', 'autre', 'qui', t.reserve_op, 'fin', t.reserve_fin);
  end if;
  if t.reserve_op = op
     and (t.reserve_debut at time zone fuseau)::date = (now() at time zone fuseau)::date then
    return jsonb_build_object('op', op, 'refus', 'aujourdhui');
  end if;
  select * into autre from tasks
   where household_id = t.household_id and id <> t.id
     and reserve_op = op and reserve_fin > now()
     and not done and not deleted
   limit 1;
  if found then
    return jsonb_build_object('op', op, 'refus', 'uneAutre', 'tache', autre.text);
  end if;
  perform set_config('cmp.op', '1', true);
  update tasks set reserve_par = auth.uid(), reserve_op = op,
                   reserve_debut = now(), reserve_fin = now() + interval '1 hour'
   where id = p_id;
  perform set_config('cmp.op', '', true);
  return jsonb_build_object('op', op);
end
$$;

-- Liberer avant l'heure : seulement la personne qui a reserve.
-- { op } si c'est fait (ou s'il n'y avait plus rien a liberer), { op: null }
-- si le code est faux, { op, refus: 'pasToi' } sinon.
create or replace function public.cmp_op_liberer(p_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  op uuid;
begin
  select * into t from tasks where id = p_id;
  if not found then
    raise exception using errcode = '42501', message = 'Tache introuvable.';
  end if;
  op := public.entreprise_operateur(t.household_id, p_code);
  if op is null then
    return jsonb_build_object('op', null);
  end if;
  if t.reserve_op is null or t.reserve_fin <= now() then
    return jsonb_build_object('op', op);
  end if;
  if t.reserve_op <> op then
    return jsonb_build_object('op', op, 'refus', 'pasToi');
  end if;
  perform set_config('cmp.op', '1', true);
  update tasks set reserve_fin = now() where id = p_id;
  perform set_config('cmp.op', '', true);
  return jsonb_build_object('op', op);
end
$$;

-- La tache reservee par un collegue ne se coche pas a sa place : la garde
-- vit dans un declencheur, pour que cmp_op_cocher n'ait pas a changer.
create or replace function public.tache_reservation_op()
returns trigger
language plpgsql
as $$
begin
  if new.done and not old.done
     and old.reserve_op is not null and old.reserve_fin > now()
     and new.done_op is distinct from old.reserve_op then
    raise exception using errcode = '42501', message = 'cmp:reservee';
  end if;
  return new;
end
$$;

drop trigger if exists tasks_reservation_op on public.tasks;
create trigger tasks_reservation_op
  before update on public.tasks
  for each row execute function public.tache_reservation_op();

revoke execute on function public.cmp_op_reserver(uuid, text) from public, anon;
revoke execute on function public.cmp_op_liberer(uuid, text) from public, anon;
grant execute on function public.cmp_op_reserver(uuid, text) to authenticated;
grant execute on function public.cmp_op_liberer(uuid, text) to authenticated;

notify pgrst, 'reload schema';
select 'reservation entreprise ok' as etat;
