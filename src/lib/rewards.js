import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { REWARD_CUSTOM, secondesPourAnnuler } from './gamify.js';

const rewardFrom = (r) => ({
  id: r.id,
  householdId: r.household_id,
  // La cle traduit le libelle ; le label francais reste le repli.
  cle: r.cle || null,
  label: r.label,
  cost: Number(r.cost),
  visuel: r.visuel || null,
  // En famille : une récompense de couple, cachée derrière le code couple.
  couple: r.couple === true,
  deleted: r.deleted,
  createdAt: r.created_at,
});

const claimFrom = (r) => ({
  id: r.id,
  householdId: r.household_id,
  rewardId: r.reward_id,
  userId: r.user_id,
  // Poinçonné quand il a servi. Un bon utilisé reste dans l'inventaire.
  usedAt: r.used_at || null,
  // Validé par son détenteur : l'autre a bien honoré le bon.
  realiseAt: r.realise_at || null,
  // En famille : la personne désignée pour honorer le bon.
  pour: r.pour || null,
  // Membres sans compte (proches.sql) : le bon est à lui, ou il l'honore.
  proche: r.proche || null,
  pourProche: r.pour_proche || null,
  // Un bon pris sur une récompense de couple (caché comme elle).
  couple: r.couple === true,
  label: r.label,
  cost: Number(r.cost),
  deleted: r.deleted,
  createdAt: r.created_at,
});

const key = (hid, what) => `cmp:${what}:${hid}`;
const readLS = (k, f) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : f;
  } catch {
    return f;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Catalogue de récompenses du foyer, dépenses, et prénoms des membres.
 * `acteur` : la session ouverte (session.js) — les bons sont alors à elle.
 */
export function useRewards(householdId, userId, acteur = null) {
  // Qui agit, lu au moment d'agir (cf. store.js, agirPour).
  const acteurRef = useRef(acteur);
  const acteurVu = useRef(acteur);
  if (acteurVu.current !== acteur) {
    acteurVu.current = acteur;
    acteurRef.current = acteur;
  }
  const qui = useCallback(() => {
    const a = acteurRef.current;
    return { a, compte: (a && a.compte) || userId, proche: (a && a.proche) || null };
  }, [userId]);
  const agirPour = useCallback((a) => {
    acteurRef.current = a;
  }, []);
  const [rewards, setRewards] = useState(() =>
    householdId ? readLS(key(householdId, 'rewards'), []) : [],
  );
  const [claims, setClaims] = useState(() =>
    householdId ? readLS(key(householdId, 'claims'), []) : [],
  );
  // Prénoms et membres gardés sur le téléphone : l'écran « Qui es-tu ? »
  // s'affiche juste du premier coup, sans attendre le réseau.
  const [names, setNames] = useState(() =>
    householdId ? readLS(key(householdId, 'noms'), {}) : {},
  );
  const [otherUser, setOtherUser] = useState(null);
  // Tous les membres du foyer, moi compris, dans l'ordre d'arrivée.
  const [members, setMembers] = useState(() =>
    householdId ? readLS(key(householdId, 'membres'), []) : [],
  );
  // La première lecture de la base est-elle faite ? Avant, qui a un code
  // n'est pas sûr : on n'ouvre aucune session.
  const [charge, setCharge] = useState(false);
  // … sauf si on le sait déjà de la dernière fois (hors ligne, par exemple).
  const [codesConnus] = useState(() =>
    Boolean(householdId) && readLS(key(householdId, 'avecCode'), null) !== null,
  );
  // Le foyer a-t-il choisi le mode famille (même à deux) ?
  const [familleActivee, setFamilleActivee] = useState(false);
  // Les membres sans compte (les enfants, par exemple) : { id, nom, actif }.
  const [proches, setProches] = useState(() =>
    householdId ? readLS(key(householdId, 'proches'), []) : [],
  );
  // Les membres (comptes ou sans compte) qui ont un code pour leurs bons.
  const [avecCode, setAvecCode] = useState(() =>
    householdId ? readLS(key(householdId, 'avecCode'), []) : [],
  );
  const rRef = useRef(rewards);
  const cRef = useRef(claims);

  const saveRewards = useCallback(
    (next) => {
      rRef.current = next;
      setRewards(next);
      if (householdId) writeLS(key(householdId, 'rewards'), next);
    },
    [householdId],
  );

  const saveClaims = useCallback(
    (next) => {
      cRef.current = next;
      setClaims(next);
      if (householdId) writeLS(key(householdId, 'claims'), next);
    },
    [householdId],
  );

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) return;
    const [{ data: rw }, { data: cl }, { data: mem }, { data: foyer }, { data: pr }] = await Promise.all([
      supabase.from('rewards').select('*').eq('household_id', householdId),
      supabase.from('claims').select('*').eq('household_id', householdId),
      supabase
        .from('members')
        .select('user_id, display_name')
        .eq('household_id', householdId),
      // Sans la colonne (base pas encore à jour), l'erreur laisse `foyer` vide.
      supabase.from('households').select('famille').eq('id', householdId).maybeSingle(),
      // Sans la table (base pas encore à jour), `pr` reste vide.
      supabase.from('proches').select('id, nom, actif, created_at').eq('household_id', householdId),
    ]);
    // Base pas encore à jour : les fonctions manquent, on reste sans code.
    const { data: co } = await supabase.rpc('cmp_codes_etat', { hid: householdId });
    if (Array.isArray(co)) {
      setAvecCode(co);
      writeLS(key(householdId, 'avecCode'), co);
    }
    if (pr) {
      const liste = pr
        .map((p) => ({ id: p.id, nom: p.nom, actif: p.actif !== false, createdAt: p.created_at }))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      setProches(liste);
      writeLS(key(householdId, 'proches'), liste);
    }
    if (foyer) setFamilleActivee(Boolean(foyer.famille));
    if (rw) saveRewards(rw.map(rewardFrom));
    if (cl) saveClaims(cl.map(claimFrom));
    if (mem) {
      const map = {};
      mem.forEach((m) => {
        map[m.user_id] = m.display_name || '';
      });
      setNames(map);
      setMembers(mem.map((m) => m.user_id));
      writeLS(key(householdId, 'noms'), map);
      writeLS(key(householdId, 'membres'), mem.map((m) => m.user_id));
      setOtherUser(mem.map((m) => m.user_id).find((id) => id !== userId) ?? null);
    }
    if (mem && co !== undefined) setCharge(true);
  }, [householdId, userId, saveRewards, saveClaims]);

  useEffect(() => {
    if (!householdId) return undefined;
    refresh();
    const t = setInterval(refresh, 30000);
    // Retour sur l'application — souvent depuis la notification d'un bon
    // utilisé : on relit tout de suite, sans attendre le prochain passage.
    const auRetour = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [householdId, refresh]);

  /**
   * L'interrupteur « Mode famille ». La base ajuste aussitôt le catalogue ;
   * on relit tout pour l'afficher.
   */
  const activerFamille = useCallback(
    async (on) => {
      setFamilleActivee(Boolean(on));
      if (!supabase) return;
      const { error } = await supabase
        .from('households')
        .update({ famille: Boolean(on) })
        .eq('id', householdId);
      refresh();
      return !error;
    },
    [householdId, refresh],
  );

  /** Dépense ses points pour une récompense (on fige son nom et son coût). */
  // `proche` : un membre sans compte prend le bon avec SES points, depuis le
  // téléphone d'un parent.
  const claimReward = useCallback(
    async (reward, pourProche = null) => {
      const { compte, proche: procheActeur } = qui();
      const proche = pourProche || procheActeur;
      const row = {
        id: uuid(),
        household_id: householdId,
        reward_id: reward.id,
        user_id: compte,
        label: reward.label,
        cost: reward.cost,
        deleted: false,
        ...(proche ? { proche } : {}),
        ...(reward.couple ? { couple: true } : {}),
      };
      // Le visuel n'est pas copié sur le bon : on le retrouve par reward_id au
      // moment de l'affichage, pour qu'un nouveau dessin s'applique aussi aux
      // bons déjà obtenus.
      saveClaims([...cRef.current, { ...claimFrom(row), createdAt: new Date().toISOString() }]);
      // L'envoi part sans qu'on l'attende : le bon existe déjà à l'écran, et
      // l'appelant doit pouvoir le montrer tout de suite, même sur un réseau
      // lent. (Le constructeur de requête ne part qu'à l'appel de .then.)
      // Refusé (le code du membre n'a pas été tapé) : on relit la base.
      if (supabase) supabase.from('claims').insert(row).then(({ error }) => error && refresh());
      return row.id;
    },
    [householdId, qui, saveClaims],
  );

  /**
   * Est-ce mon bon ? On ne dispose pas de ce que l'autre a payé avec ses
   * points. La base applique la même règle (nas/db/bons-proprietaire.sql),
   * qui seule fait autorité : un téléphone en retard d'une mise à jour ne
   * connaît pas encore celle-ci.
   */
  // Le bon d'un membre sans compte se gère depuis n'importe quel téléphone du
  // foyer : il n'en a pas à lui.
  // En session, seulement ceux de qui l'a ouverte.
  const estAMoi = useCallback(
    (id) => {
      const bon = cRef.current.find((c) => c.id === id);
      if (!bon) return false;
      const { a, compte, proche } = qui();
      if (proche) return bon.proche === proche;
      return bon.proche ? !a : bon.userId === compte;
    },
    [qui],
  );

  /**
   * Utilise un bon. En famille, `pour` désigne la personne qui l'honorera :
   * elle seule est prévenue. À deux, pas besoin — c'est l'autre.
   */
  // `pourProche` : la personne désignée est un membre sans compte.
  const useClaim = useCallback(
    async (id, pour = null, pourProche = false) => {
      if (!estAMoi(id)) return;
      const quand = new Date().toISOString();
      const qui = pourProche ? { pourProche: pour } : { pour };
      saveClaims(
        cRef.current.map((c) => (c.id === id ? { ...c, usedAt: quand, ...qui } : c)),
      );
      if (!supabase) return;
      const maj = !pour
        ? { used_at: quand }
        : pourProche
          ? { used_at: quand, pour_proche: pour }
          : { used_at: quand, pour };
      const { error } = await supabase.from('claims').update(maj).eq('id', id);
      if (error) refresh();
    },
    [saveClaims, estAMoi, refresh],
  );

  /**
   * Le détenteur valide que l'autre a honoré le bon : le bon est poinçonné, et
   * les relances s'arrêtent. Personne d'autre ne peut le faire — la base
   * réserve l'écriture au détenteur.
   */
  const validerBon = useCallback(
    async (id) => {
      if (!estAMoi(id)) return;
      const bon = cRef.current.find((c) => c.id === id);
      if (!bon || !bon.usedAt || bon.realiseAt) return;
      const quand = new Date().toISOString();
      saveClaims(
        cRef.current.map((c) => (c.id === id ? { ...c, realiseAt: quand } : c)),
      );
      if (!supabase) return;
      const { error } = await supabase
        .from('claims')
        .update({ realise_at: quand })
        .eq('id', id);
      if (error) refresh();
    },
    [saveClaims, estAMoi, refresh],
  );

  /**
   * Annule un achat fait par erreur, dans la minute. Passé ce délai le bon est
   * acquis : il ne se rend ni ne s'échange. Si le serveur refuse — délai
   * dépassé de son point de vue — on relit la base pour remettre l'écran
   * d'accord avec elle.
   */
  const annulerAchat = useCallback(
    async (id) => {
      if (!estAMoi(id)) return;
      const bon = cRef.current.find((c) => c.id === id);
      if (secondesPourAnnuler(bon) <= 0) return;
      saveClaims(
        cRef.current.map((c) => (c.id === id ? { ...c, deleted: true } : c)),
      );
      if (!supabase) return;
      const { error } = await supabase
        .from('claims')
        .update({ deleted: true })
        .eq('id', id);
      if (error) refresh();
    },
    [saveClaims, estAMoi, refresh],
  );

  /**
   * Récompense sur mesure : on décrit ce qu'on veut et on l'obtient aussitôt.
   * Elle n'entre pas au catalogue — c'est un souhait unique, à prix fixe.
   */
  const claimCustom = useCallback(
    async (label, pourProche = null) => {
      const { compte, proche: procheActeur } = qui();
      const proche = pourProche || procheActeur;
      const text = label.trim();
      if (!text) return 'Dis ce que tu demandes.';
      const row = {
        id: uuid(),
        household_id: householdId,
        reward_id: null,
        user_id: compte,
        label: text,
        cost: REWARD_CUSTOM,
        deleted: false,
        ...(proche ? { proche } : {}),
      };
      saveClaims([...cRef.current, { ...claimFrom(row), createdAt: new Date().toISOString() }]);
      if (supabase) {
        const { error } = await supabase.from('claims').insert(row);
        if (error) refresh();
      }
      return null;
    },
    [householdId, qui, saveClaims],
  );

  // --- Les codes (codes.sql, couple.sql) ----------------------------------

  /** Taper le code d'un membre : ses bons s'ouvrent un quart d'heure. */
  const ouvrirCode = useCallback(
    async (membre, code) => {
      if (!supabase) return 'horsLigne';
      const { data, error } = await supabase.rpc('cmp_code_ouvrir', { hid: householdId, p_membre: membre, p_code: code });
      if (error) return error.message;
      return data ? null : 'faux';
    },
    [householdId],
  );

  /**
   * Qui porte ce code ? { membre } (son ticket est ouvert), { membre: null }
   * si le code est faux, { ambigu: true } si deux membres l'ont choisi,
   * { erreur } sinon.
   */
  const quiCode = useCallback(
    async (code) => {
      if (!supabase) return { erreur: 'horsLigne' };
      const { data, error } = await supabase.rpc('cmp_code_qui', { hid: householdId, p_code: code });
      if (error) return { erreur: error.message };
      return data || { membre: null };
    },
    [householdId],
  );

  /** La session vit : son ticket aussi. false s'il a expiré (retaper le code). */
  const prolongerCode = useCallback(
    async (membre) => {
      if (!supabase) return true;
      const { data, error } = await supabase.rpc('cmp_ticket_prolonger', { hid: householdId, p_membre: membre });
      // Base pas encore à jour, ou réseau : on ne ferme pas pour si peu.
      if (error) return true;
      return data !== false;
    },
    [householdId],
  );

  /**
   * Choisir ou changer un code : le sien (`preuve` = l'ancien), ou celui d'un
   * membre sans compte (`preuve` = son propre code). Renvoie null ou la raison.
   */
  const poserCode = useCallback(
    async (membre, nouveau, preuve = null) => {
      if (!supabase) return 'horsLigne';
      const { data, error } = await supabase.rpc('cmp_code_poser', {
        hid: householdId, p_membre: membre, p_nouveau: nouveau, p_preuve: preuve,
      });
      if (error) return error.message;
      if (data === 'ok') await refresh();
      return data === 'ok' ? null : data;
    },
    [householdId, refresh],
  );

  /** Un membre sans compte de plus (un prénom suffit). */
  const ajouterProche = useCallback(
    async (nom) => {
      const propre = String(nom || '').trim().slice(0, 40);
      if (!propre || !supabase || !householdId) return false;
      const { error } = await supabase.from('proches').insert({ household_id: householdId, nom: propre });
      await refresh();
      return !error;
    },
    [householdId, refresh],
  );

  /** Retire un membre sans compte : il quitte la liste, son historique reste. */
  const retirerProche = useCallback(
    async (id) => {
      if (!supabase) return false;
      setProches((l) => l.map((p) => (p.id === id ? { ...p, actif: false } : p)));
      const { error } = await supabase.from('proches').update({ actif: false }).eq('id', id);
      await refresh();
      return !error;
    },
    [refresh],
  );

  return {
    rewards,
    claims,
    names,
    proches,
    ajouterProche,
    retirerProche,
    avecCode,
    pret: charge || codesConnus,
    ouvrirCode,
    quiCode,
    agirPour,
    prolongerCode,
    poserCode,
    otherUser,
    members,
    familleActivee,
    activerFamille,
    refresh,
    claimReward,
    claimCustom,
    useClaim,
    annulerAchat,
    validerBon,
  };
}
