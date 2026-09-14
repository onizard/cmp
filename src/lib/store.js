import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { sortForMonth, tasksVisibleIn } from './visibility.js';

// --- Correspondance base <-> modèle client ---

const fromRow = (r) => ({
  id: r.id,
  householdId: r.household_id,
  text: r.text,
  month: r.month,
  position: r.position,
  done: r.done,
  doneMonth: r.done_month,
  doneBy: r.done_by,
  deleted: r.deleted,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toInsertRow = (t) => ({
  id: t.id,
  household_id: t.householdId,
  text: t.text,
  month: t.month,
  position: t.position,
  done: t.done,
  done_month: t.doneMonth,
  done_by: t.doneBy ?? null,
  deleted: t.deleted,
});

const patchToRow = (patch) => {
  const row = {};
  if ('text' in patch) row.text = patch.text;
  if ('month' in patch) row.month = patch.month;
  if ('position' in patch) row.position = patch.position;
  if ('done' in patch) row.done = patch.done;
  if ('doneMonth' in patch) row.done_month = patch.doneMonth;
  if ('doneBy' in patch) row.done_by = patch.doneBy;
  if ('deleted' in patch) row.deleted = patch.deleted;
  return row;
};

// --- Stockage local (cache lecture hors ligne + file d'attente d'écritures) ---

const cacheKey = (hid) => `cmp:tasks:${hid}`;
const queueKey = (hid) => `cmp:queue:${hid}`;

const readLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeLS = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : on continue en mémoire */
  }
};

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const nowIso = () => new Date().toISOString();

/**
 * Hook principal : tâches d'un foyer, avec cache hors ligne, file d'attente
 * d'écritures et synchronisation temps réel.
 */
export function useTasks(householdId, userId) {
  const [tasks, setTasks] = useState(() =>
    householdId ? readLS(cacheKey(householdId), []) : [],
  );
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(() =>
    householdId ? readLS(queueKey(householdId), []).length : 0,
  );

  const tasksRef = useRef(tasks);
  const flushing = useRef(false);

  const persist = useCallback(
    (next) => {
      tasksRef.current = next;
      setTasks(next);
      if (householdId) writeLS(cacheKey(householdId), next);
    },
    [householdId],
  );

  const getQueue = useCallback(
    () => (householdId ? readLS(queueKey(householdId), []) : []),
    [householdId],
  );

  const setQueue = useCallback(
    (q) => {
      if (householdId) writeLS(queueKey(householdId), q);
      setPending(q.length);
    },
    [householdId],
  );

  // Applique une opération au serveur. Renvoie true si envoyée.
  const sendOp = useCallback(async (op) => {
    if (!supabase) return false;
    if (op.type === 'insert') {
      const { error } = await supabase.from('tasks').insert(op.row);
      // 23505 = doublon (déjà inséré) : on considère l'opération comme faite.
      if (error && error.code !== '23505') throw error;
    } else if (op.type === 'update') {
      const { error } = await supabase
        .from('tasks')
        .update(op.row)
        .eq('id', op.id);
      if (error) throw error;
    }
    return true;
  }, []);

  const flushQueue = useCallback(async () => {
    if (flushing.current || !supabase) return;
    flushing.current = true;
    try {
      let q = getQueue();
      while (q.length > 0) {
        try {
          await sendOp(q[0]);
        } catch {
          break; // hors ligne ou erreur transitoire : on réessaiera plus tard
        }
        q = q.slice(1);
        setQueue(q);
      }
    } finally {
      flushing.current = false;
    }
  }, [getQueue, sendOp, setQueue]);

  const enqueue = useCallback(
    (op) => {
      const q = [...getQueue(), op];
      setQueue(q);
      flushQueue();
    },
    [getQueue, setQueue, flushQueue],
  );

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) {
      setLoading(false);
      return;
    }
    await flushQueue();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('household_id', householdId);
    if (!error && data) persist(data.map(fromRow));
    setLoading(false);
  }, [householdId, flushQueue, persist]);

  // Chargement initial + temps réel + reprise au premier plan / reconnexion.
  useEffect(() => {
    if (!householdId) return undefined;
    let channel;
    refresh();

    if (supabase) {
      channel = supabase
        .channel(`tasks:${householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            const row = payload.new?.id ? payload.new : payload.old;
            if (!row) return;
            const mapped = fromRow(row);
            const others = tasksRef.current.filter((t) => t.id !== mapped.id);
            persist([...others, mapped]);
          },
        )
        .subscribe();
    }

    const onOnline = () => {
      setOnline(true);
      refresh();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    // Filet de sécurité : rafraîchissement périodique tant que l'app est visible,
    // au cas où le temps réel serait momentanément indisponible (auto-hébergement).
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) refresh();
    }, 25000);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
      clearInterval(poll);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  // --- Mutations (optimistes + mises en file) ---

  const applyLocal = useCallback(
    (id, patch) => {
      const next = tasksRef.current.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t,
      );
      persist(next);
    },
    [persist],
  );

  const addTask = useCallback(
    (month, text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const inMonth = tasksRef.current.filter(
        (t) => t.month === month && !t.deleted,
      );
      const position =
        inMonth.reduce((max, t) => Math.max(max, t.position), -1) + 1;
      const task = {
        id: uuid(),
        householdId,
        text: trimmed,
        month,
        position,
        done: false,
        doneMonth: null,
        doneBy: null,
        deleted: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      persist([...tasksRef.current, task]);
      enqueue({ type: 'insert', row: toInsertRow(task) });
    },
    [householdId, persist, enqueue],
  );

  const updateTask = useCallback(
    (id, patch) => {
      applyLocal(id, patch);
      enqueue({ type: 'update', id, row: patchToRow(patch) });
    },
    [applyLocal, enqueue],
  );

  const toggleDone = useCallback(
    (task, currentMonth) => {
      const patch = task.done
        ? { done: false, doneMonth: null, doneBy: null }
        : { done: true, doneMonth: currentMonth, doneBy: userId ?? null };
      updateTask(task.id, patch);
    },
    [updateTask, userId],
  );

  const removeTask = useCallback(
    (id) => updateTask(id, { deleted: true }),
    [updateTask],
  );

  // Monter / descendre parmi les tâches non cochées d'un mois.
  const moveTask = useCallback(
    (task, month, currentMonth, direction) => {
      const ordered = sortForMonth(
        tasksVisibleIn(tasksRef.current, month, currentMonth),
      ).filter((t) => !t.done);
      const idx = ordered.findIndex((t) => t.id === task.id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
      const a = ordered[idx];
      const b = ordered[swapIdx];
      updateTask(a.id, { position: b.position });
      updateTask(b.id, { position: a.position });
    },
    [updateTask],
  );

  return {
    tasks,
    loading,
    online,
    pending,
    refresh,
    addTask,
    updateTask,
    toggleDone,
    removeTask,
    moveTask,
  };
}
