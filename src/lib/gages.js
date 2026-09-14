import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const fromRow = (r) => ({
  id: r.id,
  householdId: r.household_id,
  fromUser: r.from_user,
  toUser: r.to_user,
  text: r.text,
  done: r.done,
  deleted: r.deleted,
  createdAt: r.created_at,
});

const cacheKey = (hid) => `cmp:gages:${hid}`;
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
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Gages du foyer + identité de « l'autre » membre. */
export function useGages(householdId, userId) {
  const [gages, setGages] = useState(() =>
    householdId ? readLS(cacheKey(householdId), []) : [],
  );
  const [otherUser, setOtherUser] = useState(null);
  const ref = useRef(gages);

  const persist = useCallback(
    (next) => {
      ref.current = next;
      setGages(next);
      if (householdId) writeLS(cacheKey(householdId), next);
    },
    [householdId],
  );

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) return;
    const { data } = await supabase
      .from('gages')
      .select('*')
      .eq('household_id', householdId);
    if (data) persist(data.map(fromRow));
    const { data: mem } = await supabase
      .from('members')
      .select('user_id')
      .eq('household_id', householdId);
    if (mem) {
      const other = mem.map((m) => m.user_id).find((id) => id !== userId);
      setOtherUser(other ?? null);
    }
  }, [householdId, userId, persist]);

  useEffect(() => {
    if (!householdId) return undefined;
    refresh();
    let channel;
    if (supabase) {
      channel = supabase
        .channel(`gages:${householdId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'gages', filter: `household_id=eq.${householdId}` },
          (payload) => {
            const row = payload.new?.id ? payload.new : payload.old;
            if (!row) return;
            const mapped = fromRow(row);
            const others = ref.current.filter((g) => g.id !== mapped.id);
            persist([...others, mapped]);
          },
        )
        .subscribe();
    }
    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const createGage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || !otherUser) return;
      const gage = {
        id: uuid(),
        householdId,
        fromUser: userId,
        toUser: otherUser,
        text: trimmed,
        done: false,
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      persist([...ref.current, gage]); // optimiste
      if (supabase) {
        await supabase.from('gages').insert({
          id: gage.id,
          household_id: householdId,
          from_user: userId,
          to_user: otherUser,
          text: trimmed,
        });
      }
    },
    [householdId, userId, otherUser, persist],
  );

  const honourGage = useCallback(
    async (id) => {
      persist(ref.current.map((g) => (g.id === id ? { ...g, done: true } : g)));
      if (supabase) {
        await supabase
          .from('gages')
          .update({ done: true, done_at: new Date().toISOString() })
          .eq('id', id);
      }
    },
    [persist],
  );

  return { gages, otherUser, createGage, honourGage, refresh };
}
