-- Rappel « invite ta moitié », pour qui est encore seul dans son foyer.
--
--   invite_on      : la personne veut ce rappel (un celibataire le coupe)
--   invite_envois  : combien lui ont deja ete envoyes — il y a un plafond,
--                    un rappel qui ne s'arrete jamais devient du harcelement
--   invite_dernier : quand, pour espacer d'une semaine
--   langue         : la langue de l'appareil, pour que le service d'envoi
--                    cesse de parler francais a tout le monde

alter table push_subscriptions add column if not exists invite_on boolean not null default true;
alter table push_subscriptions add column if not exists invite_envois smallint not null default 0;
alter table push_subscriptions add column if not exists invite_dernier timestamptz;
alter table push_subscriptions add column if not exists langue text;

notify pgrst, 'reload schema';

select count(*) as abonnements,
       count(*) filter (where invite_on) as veulent_le_rappel
from push_subscriptions;
