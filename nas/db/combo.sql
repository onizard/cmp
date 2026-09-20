-- Le combo du jour a besoin de savoir QUAND une tache a ete cochee.
--
-- done_month ne dit que le mois, et updated_at bouge des qu'on renomme une
-- tache : ni l'un ni l'autre ne permet de compter les coches d'une journee.
-- D'ou une colonne a part, posee au moment de la coche et effacee a la
-- decoche.
--
-- Les taches deja cochees restent a null, volontairement : leur attribuer
-- updated_at distribuerait des combos retroactifs a qui a simplement corrige
-- plusieurs libelles le meme jour. Sans instant, pas de combo — elles valent
-- leur prix normal, et le compte repart proprement a partir d'aujourd'hui.

alter table tasks add column if not exists done_at timestamptz;

-- Le classement se fait par personne, par jour : c'est l'index qui va avec.
create index if not exists tasks_done_at_idx
  on tasks (done_by, done_at)
  where done_at is not null;

notify pgrst, 'reload schema';
