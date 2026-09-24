-- Chacun ses bons.
--
-- La politique posee jusqu'ici, `cl_all`, disait seulement « membre du foyer » :
-- n'importe qui pouvait donc utiliser, rendre ou supprimer un bon paye par
-- l'autre avec SES points. La garde cote application ne suffit pas — une PWA
-- sert sa version en cache, et un telephone en retard d'une mise a jour ne la
-- connait pas encore.
--
-- La lecture, elle, reste ouverte a tout le foyer : c'est en voyant les
-- depenses de l'autre qu'on calcule ses points restants.

drop policy if exists cl_all on claims;

drop policy if exists cl_select on claims;
create policy cl_select on claims for select to authenticated
  using (is_member(household_id));

drop policy if exists cl_insert on claims;
create policy cl_insert on claims for insert to authenticated
  with check (is_member(household_id) and user_id = auth.uid());

drop policy if exists cl_update on claims;
create policy cl_update on claims for update to authenticated
  using (is_member(household_id) and user_id = auth.uid())
  with check (is_member(household_id) and user_id = auth.uid());

drop policy if exists cl_delete on claims;
create policy cl_delete on claims for delete to authenticated
  using (is_member(household_id) and user_id = auth.uid());

notify pgrst, 'reload schema';
