import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const rewardFrom = (r) => ({
  id: r.id,
  householdId: r.household_id,
  label: r.label,
  cost: Number(r.cost),
  deleted: r.deleted,
  createdAt: r.created_at,
});

const claimFrom = (r) => ({
  id: r.id,
  householdId: r.household_id,
  rewardId: r.reward_id,
  userId: r.user_id,
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

  /** Ajoute une récompense au catalogue commun. */
  const addReward = useCallback(
    async (label, cost) => {
      const text = label.trim();
      const price = Number(cost);
      if (!text || !Number.isFinite(price) || price <= 0) return;
      const row = {
        id: uuid(),
        household_id: householdId,
        label: text,
        cost: price,
        deleted: false,
      };
      saveRewards([...rRef.current, rewardFrom(row)]);
      if (supabase) await supabase.from('rewards').insert(row);
    },
    [householdId, saveRewards],
  );

  /** Retire une récompense du catalogue (suppression logique). */
  const removeReward = useCallback(
    async (id) => {
      saveRewards(
        rRef.current.map((r) => (r.id === id ? { ...r, deleted: true } : r)),
      );
      if (supabase)
        await supabase.from('rewards').update({ deleted: true }).eq('id', id);
    },
    [saveRewards],
  );

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
      saveClaims([...cRef.current, claimFrom(row)]);
      if (supabase) await supabase.from('claims').insert(row);
    },
    [householdId, userId, saveClaims],
  );

  /** Annule une dépense (récupère les points). */
  const cancelClaim = useCallback(
    async (id) => {
      saveClaims(
        cRef.current.map((c) => (c.id === id ? { ...c, deleted: true } : c)),
      );
      if (supabase)
        await supabase.from('claims').update({ deleted: true }).eq('id', id);
    },
    [saveClaims],
  );

  return {
    rewards,
    claims,
    names,
    otherUser,
    refresh,
    addReward,
    removeReward,
    claimReward,
    cancelClaim,
  };
}
