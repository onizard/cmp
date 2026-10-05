-- Mode famille : les recompenses de couple, cachees aux enfants.
--
-- En famille, le catalogue propose les recompenses « tous » et « famille ».
-- Celles du couple restent aussi, marquees « de couple » : dans le Cerveau,
-- elles ne s'ouvrent qu'avec le code d'un parent — le meme que pour ses bons
-- (codes.sql). Un enfant qui prend le telephone d'un parent ne les voit pas,
-- ni les bons qui en viennent.
--
--   * rewards.couple / claims.couple : la recompense, le bon, sont « de
--     couple » ; l'appli les cache tant que le code n'est pas tape ;
--   * a deux, ce sont des recompenses comme les autres.
--
-- Remplace catalogue_ajuste (catalogue.sql) en la completant : a passer apres
-- catalogue.sql et proches.sql ; si catalogue.sql est relance plus tard,
-- relancer celui-ci ensuite. A relancer sans risque : idempotent.

alter table rewards add column if not exists couple boolean not null default false;
alter table claims add column if not exists couple boolean not null default false;

-- --- Le catalogue : les recompenses de couple gardees en famille --------

create or replace function public.catalogue_ajuste(hid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text := public.mode_foyer(hid);
begin
  update rewards r set deleted = true
    from catalogue_depart c
   where r.household_id = hid and not r.deleted and r.cle = c.cle
     and c.public not in ('tous', mode)
     and c.public <> 'couple';
  if mode = 'famille' then
    insert into rewards (household_id, cle, label, cost, couple)
    select hid, c.cle, c.label, c.cost, true
      from catalogue_depart c
     where c.actif and c.public = 'couple'
       and not exists (
         select 1 from rewards r
          where r.household_id = hid and not r.deleted
            and (r.cle = c.cle or lower(r.label) = lower(c.label)));
    update rewards r set couple = true
      from catalogue_depart c
     where r.household_id = hid and not r.deleted and r.cle = c.cle
       and c.public = 'couple' and not r.couple;
  else
    -- A deux, une recompense de couple est une recompense comme une autre.
    update rewards set couple = false where household_id = hid and couple;
  end if;
  return public.catalogue_pour(hid);
end
$$;

-- Les foyers deja en famille retrouvent tout de suite leurs recompenses de
-- couple.
select public.catalogue_ajuste(h.id)
  from households h
 where not coalesce(h.entreprise, false) and public.mode_foyer(h.id) = 'famille';

notify pgrst, 'reload schema';
select 'couple ok' as etat;
