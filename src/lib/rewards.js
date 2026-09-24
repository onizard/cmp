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

/** Catalogue de récompenses du foyer, dépenses, et prénoms des membres. */
export function useRewards(householdId, userId) {
  const [rewards, setRewards] = useState(() =>
    householdId ? readLS(key(householdId, 'rewards'), []) : [],
  );
  const [claims, setClaims] = useState(() =>
    householdId ? readLS(key(householdId, 'claims'), []) : [],
  );
  const [names, setNames] = useState({});
  const [otherUser, setOtherUser] = useState(null);
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
    const [{ data: rw }, { data: cl }, { data: mem }] = await Promise.all([
      supabase.from('rewards').select('*').eq('household_id', householdId),
      supabase.from('claims').select('*').eq('household_id', householdId),
      supabase
        .from('members')
        .select('user_id, display_name')
        .eq('household_id', householdId),
    ]);
    if (rw) saveRewards(rw.map(rewardFrom));
    if (cl) saveClaims(cl.map(claimFrom));
    if (mem) {
      const map = {};
      mem.forEach((m) => {
        map[m.user_id] = m.display_name || '';
      });
      setNames(map);
      setOtherUser(mem.map((m) => m.user_id).find((id) => id !== userId) ?? null);
    }
  }, [householdId, userId, saveRewards, saveClaims]);

  useEffect(() => {
    if (!householdId) return undefined;
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [householdId, refresh]);

  /** Dépense ses points pour une récompense (on fige son nom et son coût). */
  const claimReward = useCallback(
    async (reward) => {
      const row = {
        id: uuid(),
        household_id: householdId,
        reward_id: reward.id,
        user_id: userId,
        label: reward.label,
        cost: reward.cost,
        deleted: false,
      };
      // Le visuel n'est pas copié sur le bon : on le retrouve par reward_id au
      // moment de l'affichage, pour qu'un nouveau dessin s'applique aussi aux
      // bons déjà obtenus.
      saveClaims([...cRef.current, { ...claimFrom(row), createdAt: new Date().toISOString() }]);
      // L'envoi part sans qu'on l'attende : le bon existe déjà à l'écran, et
      // l'appelant doit pouvoir le montrer tout de suite, même sur un réseau
      // lent. (Le constructeur de requête ne part qu'à l'appel de .then.)
      if (supabase) supabase.from('claims').insert(row).then(() => {});
      return row.id;
    },
    [householdId, userId, saveClaims],
  );

  /**
   * Est-ce mon bon ? On ne dispose pas de ce que l'autre a payé avec ses
   * points. La base applique la même règle (nas/db/bons-proprietaire.sql),
   * qui seule fait autorité : un téléphone en retard d'une mise à jour ne
   * connaît pas encore celle-ci.
   */
  const estAMoi = useCallback(
    (id) => {
      const bon = cRef.current.find((c) => c.id === id);
      return Boolean(bon) && bon.userId === userId;
    },
    [userId],
  );

  /** Poinçonne un bon : il a servi, il ne sert plus qu'au souvenir. */
  const useClaim = useCallback(
    async (id) => {
      if (!estAMoi(id)) return;
      const quand = new Date().toISOString();
      saveClaims(
        cRef.current.map((c) => (c.id === id ? { ...c, usedAt: quand } : c)),
      );
      if (supabase)
        await supabase.from('claims').update({ used_at: quand }).eq('id', id);
    },
    [saveClaims, estAMoi],
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
    async (label) => {
      const text = label.trim();
      if (!text) return 'Dis ce que tu demandes.';
      const row = {
        id: uuid(),
        household_id: householdId,
        reward_id: null,
        user_id: userId,
        label: text,
        cost: REWARD_CUSTOM,
        deleted: false,
      };
      saveClaims([...cRef.current, { ...claimFrom(row), createdAt: new Date().toISOString() }]);
      if (supabase) await supabase.from('claims').insert(row);
      return null;
    },
    [householdId, userId, saveClaims],
  );

  return {
    rewards,
    claims,
    names,
    otherUser,
    refresh,
    claimReward,
    claimCustom,
    useClaim,
    annulerAchat,
  };
}
