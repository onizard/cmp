-- Mode entreprise : une equipe sur un compte partage, chacun avec son code.
--
-- On ne demande pas l'e-mail de chaque membre de l'equipe. Le compte est
-- partage (une tablette a l'atelier, ou le meme compte sur plusieurs
-- telephones) et c'est le CODE OPERATEUR, 4 chiffres, qui dit qui a cree,
-- coche, decoche, modifie ou supprime une tache.
--
-- Pour que « qui a fait quoi » soit fiable, rien ne passe par l'ecriture
-- directe dans `tasks` pour un foyer d'entreprise : tout passe par les
-- fonctions ci-dessous, qui verifient le code DANS la base. Les codes y sont
-- chiffres (bcrypt) et ne sont lisibles par personne, pas meme par
-- l'application. Dix codes faux en cinq minutes bloquent le foyer cinq
-- minutes : on ne devine pas un code en les essayant tous.
--
-- La gestion de l'equipe (ajouter, renommer, changer un code, desactiver)
-- demande le code responsable, choisi a la creation du compte.
--
-- A passer apres cmp.sql, decoche.sql, taches-auteur.sql et reservation.sql
-- (relances depuis cette version : ils laissent passer ce qui a ete verifie
-- ici). A relancer sans risque : tout est idempotent.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- --- Les donnees --------------------------------------------------------

-- Choisi a la creation, jamais change ensuite.
alter table households add column if not exists entreprise boolean not null default false;

-- Qui a cree / qui a coche, cote equipe. created_by / done_by restent le
-- compte connecte, comme partout.
alter table tasks add column if not exists created_op uuid;
alter table tasks add column if not exists done_op uuid;

create table if not exists operateurs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nom text not null check (length(btrim(nom)) between 1 and 40),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists operateurs_foyer_idx on operateurs (household_id);

-- Les membres du foyer voient l'equipe (noms), jamais les codes.
alter table operateurs enable row level security;
drop policy if exists operateurs_select on operateurs;
create policy operateurs_select on operateurs
  for select using (public.is_member(household_id));
grant select on operateurs to authenticated;

-- Les secrets : aucune politique, donc illisibles depuis l'application.
create table if not exists operateurs_codes (
  operateur_id uuid primary key references operateurs(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  code text not null
);
alter table operateurs_codes enable row level security;

create table if not exists entreprise_secrets (
  household_id uuid primary key references households(id) on delete cascade,
  code_responsable text not null
);
alter table entreprise_secrets enable row level security;

create table if not exists entreprise_essais (
  household_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists entreprise_essais_idx on entreprise_essais (household_id, at);
alter table entreprise_essais enable row level security;

-- --- Les gardes ---------------------------------------------------------

-- Un foyer d'entreprise ne s'ecrit pas directement : seulement par les
-- fonctions qui ont verifie le code (drapeau local a la transaction).
create or replace function public.entreprise_garde_taches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare hid uuid := coalesce(new.household_id, old.household_id);
begin
  if auth.uid() is null or current_setting('cmp.op', true) = '1' then
    return coalesce(new, old);
  end if;
  if exists (select 1 from households h where h.id = hid and h.entreprise) then
    raise exception using errcode = '42501',
      message = 'En entreprise, chaque action demande un code operateur.';
  end if;
  return coalesce(new, old);
end
$$;

drop trigger if exists tasks_entreprise on tasks;
create trigger tasks_entreprise
  before insert or update or delete on tasks
  for each row execute function public.entreprise_garde_taches();

-- Le type de foyer se choisit a la creation — et un compte entreprise ne se
-- cree que par cmp_entreprise_creer, qui pose aussi le code responsable.
create or replace function public.entreprise_definitive()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or current_setting('cmp.op', true) = '1' then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.entreprise)
     or (tg_op = 'UPDATE' and new.entreprise is distinct from old.entreprise) then
    raise exception using errcode = '42501',
      message = 'Le type de compte se choisit a la creation.';
  end if;
  return new;
end
$$;

drop trigger if exists households_entreprise on households;
create trigger households_entreprise
  before insert or update on households
  for each row execute function public.entreprise_definitive();

-- --- Outils internes ----------------------------------------------------

create or replace function public.entreprise_controle(hid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(hid) then
    raise exception using errcode = '42501', message = 'Ce foyer n''est pas le tien.';
  end if;
  if not exists (select 1 from households where id = hid and entreprise) then
    raise exception using errcode = '42501', message = 'Ce compte n''est pas un compte entreprise.';
  end if;
  if (select count(*) from entreprise_essais
       where household_id = hid and at > now() - interval '5 minutes') >= 10 then
    raise exception using errcode = '42501',
      message = 'Trop de codes faux : reessaie dans quelques minutes.';
  end if;
end
$$;

-- L'operateur actif qui porte ce code, ou NUL si le code est faux. On ne
-- leve pas d'erreur dans ce cas : l'erreur annulerait aussi l'essai qu'on
-- vient de compter, et le blocage apres dix essais ne verrait jamais rien.
create or replace function public.entreprise_operateur(hid uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare op uuid;
begin
  perform public.entreprise_controle(hid);
  select o.id into op
    from operateurs o join operateurs_codes c on c.operateur_id = o.id
   where o.household_id = hid and o.actif
     and c.code = crypt(coalesce(p_code, ''), c.code)
   limit 1;
  if op is null then
    insert into entreprise_essais (household_id) values (hid);
  end if;
  return op;
end
$$;

-- Le code responsable est-il bon ? Meme principe : faux = false, essai compte.
create or replace function public.entreprise_responsable(hid uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.entreprise_controle(hid);
  if exists (select 1 from entreprise_secrets s
              where s.household_id = hid
                and s.code_responsable = crypt(coalesce(p_code, ''), s.code_responsable)) then
    return true;
  end if;
  insert into entreprise_essais (household_id) values (hid);
  return false;
end
$$;

-- --- Creation du compte -------------------------------------------------

create or replace function public.cmp_entreprise_creer(p_nom text, p_code_responsable text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare hid uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Connexion requise.';
  end if;
  if coalesce(p_code_responsable, '') !~ '^[0-9]{4,8}$' then
    raise exception using errcode = '22023', message = 'Le code responsable fait 4 a 8 chiffres.';
  end if;
  perform set_config('cmp.op', '1', true);
  insert into households (name, entreprise)
  values (coalesce(nullif(btrim(p_nom), ''), 'Entreprise'), true)
  returning id into hid;
  perform set_config('cmp.op', '', true);
  insert into members (user_id, household_id) values (auth.uid(), hid);
  insert into entreprise_secrets (household_id, code_responsable)
  values (hid, crypt(p_code_responsable, gen_salt('bf')));
  return hid;
end
$$;

-- --- L'equipe (code responsable) ----------------------------------------

create or replace function public.cmp_responsable_verifier(hid uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.entreprise_responsable(hid, p_code);
end
$$;

-- Ajoute (p_id nul) ou modifie un operateur. p_code nul : code inchange.
-- Renvoie NUL si le code responsable est faux.
create or replace function public.cmp_operateur_enregistrer(
  hid uuid, p_responsable text, p_id uuid, p_nom text, p_code text, p_actif boolean)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare op uuid := p_id;
begin
  if not public.entreprise_responsable(hid, p_responsable) then
    return null;
  end if;
  if p_code is not null then
    if p_code !~ '^[0-9]{4}$' then
      raise exception using errcode = '22023', message = 'Le code operateur fait 4 chiffres.';
    end if;
    if exists (select 1 from operateurs o join operateurs_codes c on c.operateur_id = o.id
                where o.household_id = hid and o.actif and o.id is distinct from p_id
                  and c.code = crypt(p_code, c.code)) then
      raise exception using errcode = '23505', message = 'Ce code est deja pris dans l''equipe.';
    end if;
  end if;
  if op is null then
    if p_code is null then
      raise exception using errcode = '22023', message = 'Un nouveau membre a besoin d''un code.';
    end if;
    insert into operateurs (household_id, nom, actif)
    values (hid, btrim(p_nom), coalesce(p_actif, true))
    returning id into op;
  else
    update operateurs
       set nom = coalesce(nullif(btrim(p_nom), ''), nom),
           actif = coalesce(p_actif, actif)
     where id = op and household_id = hid;
    if not found then
      raise exception using errcode = '42501', message = 'Membre inconnu.';
    end if;
  end if;
  if p_code is not null then
    insert into operateurs_codes (operateur_id, household_id, code)
    values (op, hid, crypt(p_code, gen_salt('bf')))
    on conflict (operateur_id) do update set code = excluded.code;
  end if;
  return op;
end
$$;

-- --- Les taches (code operateur) ----------------------------------------

-- Qui porte ce code ? (pour dire « Bonjour Julie » avant d'agir)
create or replace function public.cmp_operateur_qui(hid uuid, p_code text)
returns uuid
language sql
security definer
set search_path = public
as $$ select public.entreprise_operateur(hid, p_code) $$;

create or replace function public.cmp_op_creer(
  hid uuid, p_code text, p_id uuid, p_mois text, p_texte text, p_position integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare op uuid := public.entreprise_operateur(hid, p_code);
begin
  if op is null then
    return null; -- code faux
  end if;
  if coalesce(btrim(p_texte), '') = '' then
    raise exception using errcode = '22023', message = 'Une tache a besoin d''un texte.';
  end if;
  perform set_config('cmp.op', '1', true);
  insert into tasks (id, household_id, text, month, position, done, deleted, created_by, created_op)
  values (p_id, hid, btrim(p_texte), p_mois, coalesce(p_position, 0), false, false, auth.uid(), op);
  perform set_config('cmp.op', '', true);
  return op;
end
$$;

-- Coche (p_fait) ou decoche. On ne decoche que ce qu'on a coche soi-meme.
-- Renvoie l'operateur, ou NUL si le code est faux (de meme pour les autres).
create or replace function public.cmp_op_cocher(p_id uuid, p_code text, p_fait boolean, p_mois text)
returns uuid
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
    return null; -- code faux
  end if;
  if t.deleted then
    raise exception using errcode = '42501', message = 'Tache supprimee.';
  end if;
  perform set_config('cmp.op', '1', true);
  if p_fait then
    if not t.done then
      update tasks set done = true, done_month = p_mois, done_by = auth.uid(),
                       done_at = now(), done_op = op
       where id = p_id;
    end if;
  else
    if t.done then
      if t.done_op is not null and t.done_op <> op then
        raise exception using errcode = '42501',
          message = 'Seule la personne qui a coche peut decocher.';
      end if;
      update tasks set done = false, done_month = null, done_by = null,
                       done_at = null, done_op = null
       where id = p_id;
    end if;
  end if;
  perform set_config('cmp.op', '', true);
  return op;
end
$$;

-- Modifie ou supprime : seulement la personne qui a cree la tache.
-- p_champs : { "text": …, "deleted": true, "due_at": …, "due_has_time": … }
create or replace function public.cmp_op_modifier(p_id uuid, p_code text, p_champs jsonb)
returns uuid
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
    return null; -- code faux
  end if;
  if t.created_op is not null and t.created_op <> op then
    raise exception using errcode = '42501',
      message = 'Seule la personne qui a cree la tache peut la modifier.';
  end if;
  perform set_config('cmp.op', '1', true);
  update tasks set
    text = case when p_champs ? 'text' and btrim(p_champs->>'text') <> ''
                then btrim(p_champs->>'text') else text end,
    deleted = case when p_champs ? 'deleted' then (p_champs->>'deleted')::boolean else deleted end,
    due_at = case when p_champs ? 'due_at' then (p_champs->>'due_at')::timestamptz else due_at end,
    due_has_time = case when p_champs ? 'due_has_time' then (p_champs->>'due_has_time')::boolean else due_has_time end,
    due_stage = case when p_champs ? 'due_at' then 0 else due_stage end
   where id = p_id;
  perform set_config('cmp.op', '', true);
  return op;
end
$$;

grant execute on function public.cmp_entreprise_creer(text, text) to authenticated;
grant execute on function public.cmp_responsable_verifier(uuid, text) to authenticated;
grant execute on function public.cmp_operateur_enregistrer(uuid, text, uuid, text, text, boolean) to authenticated;
grant execute on function public.cmp_operateur_qui(uuid, text) to authenticated;
grant execute on function public.cmp_op_creer(uuid, text, uuid, text, text, integer) to authenticated;
grant execute on function public.cmp_op_cocher(uuid, text, boolean, text) to authenticated;
grant execute on function public.cmp_op_modifier(uuid, text, jsonb) to authenticated;

-- Les fonctions internes ne s'appellent pas depuis l'application.
revoke execute on function public.entreprise_controle(uuid) from public, anon, authenticated;
revoke execute on function public.entreprise_operateur(uuid, text) from public, anon, authenticated;
revoke execute on function public.entreprise_responsable(uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'entreprise ok' as etat;
