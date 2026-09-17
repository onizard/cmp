-- Échéances sur les tâches.
--   due_at       : le moment visé (null = pas d'échéance)
--   due_has_time : false quand seule la date compte (on vise alors 23 h 59)
--   due_stage    : dernier palier de rappel déjà envoyé, remis à 0 à chaque
--                  changement d'échéance — c'est ce qui évite de renvoyer
--                  deux fois le même rappel.

alter table tasks add column if not exists due_at timestamptz;
alter table tasks add column if not exists due_has_time boolean not null default true;
alter table tasks add column if not exists due_stage smallint not null default 0;

create index if not exists tasks_due_idx
  on tasks (due_at) where due_at is not null;

notify pgrst, 'reload schema';

select count(*) as taches, count(due_at) as avec_echeance from tasks where not deleted;
