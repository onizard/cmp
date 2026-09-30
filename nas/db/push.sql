-- Notifications push : abonnements + déclencheur sur les tâches.

-- Qui a ajouté la tâche (pour dire « Untel a ajouté… »)
alter table tasks add column if not exists created_by uuid;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  household_id uuid not null references households(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  evening boolean not null default true,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists ps_own on push_subscriptions;
create policy ps_own on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema public to anon, authenticated, service_role;
grant all on push_subscriptions to anon, authenticated, service_role;

-- Déclencheur : prévient le service d'envoi via pg_notify.
-- reservation.sql en donne une version plus complète (réservations) : le
-- relancer après ce fichier-ci.
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
    else
      return new;
    end if;
  else
    return new;
  end if;
  perform pg_notify('cmp_push', ev::text);
  return new;
end $f$;

drop trigger if exists tasks_push on tasks;
create trigger tasks_push after insert or update on tasks
  for each row execute function cmp_task_event();

notify pgrst, 'reload schema';
select 'push ok' as etat;
