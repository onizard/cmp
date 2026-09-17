-- Les bons de recompense deviennent collectionnables.
--
-- Obtenir un bon (depenser ses points) et l'utiliser sont desormais deux
-- moments distincts :
--   claims.created_at : le bon est obtenu, il entre dans l'inventaire
--   claims.used_at    : le bon est poinconne, il ne sert plus qu'au souvenir
--
-- rewards.visuel portera le nom du fichier de la carte dessinee, quand les
-- visuels seront prets. Vide en attendant : l'application dessine alors une
-- carte par defaut.

alter table claims  add column if not exists used_at timestamptz;
alter table rewards add column if not exists visuel text;

notify pgrst, 'reload schema';

select count(*) as bons,
       count(used_at) as deja_utilises
from claims where not deleted;
