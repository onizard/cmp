import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { sortForMonth, tasksVisibleIn } from './visibility.js';
import { comboProchain } from './combo.js';
import { etatReservation, RESERVATION_MS } from './reservation.js';

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
  doneAt: r.done_at,
  createdBy: r.created_by,
  dueAt: r.due_at,
  dueHasTime: r.due_has_time !== false,
  reservePar: r.reserve_par ?? null,
  reserveDebut: r.reserve_debut ?? null,
  reserveFin: r.reserve_fin ?? null,
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
  done_at: t.doneAt ?? null,
  created_by: t.createdBy ?? null,
  due_at: t.dueAt ?? null,
  due_has_time: t.dueHasTime !== false,
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
  if ('doneAt' in patch) row.done_at = patch.doneAt;
  if ('dueAt' in patch) row.due_at = patch.dueAt;
  if ('dueHasTime' in patch) row.due_has_time = patch.dueHasTime;
  // Changer l'échéance remet les rappels à zéro : les paliers déjà franchis
  // ne valent plus rien pour une nouvelle date.
  if ('dueAt' in patch) row.due_stage = 0;
  if ('reservePar' in patch) row.reserve_par = patch.reservePar;
  if ('reserveDebut' in patch) row.reserve_debut = patch.reserveDebut;
  if ('reserveFin' in patch) row.reserve_fin = patch.reserveFin;
  if ('deleted' in patch) row.deleted = patch.deleted;
  return row;
};

// Erreurs sur lesquelles le serveur ne reviendra pas. Les rejouer ne sert à
// rien et retient toute la file en otage : la modification suivante ne part
// plus. On les jette, puis on remet l'écran d'accord avec la base.
const REFUS_DEFINITIF = new Set([
  '42501', // privilège insuffisant : RLS, ou décoche réservée à l'auteur
  '23502', // colonne obligatoire absente
  '23503', // clé étrangère
  '23514', // contrainte de vérification
  '22P02', // valeur mal formée
]);

export const estDefinitif = (err) => Boolean(err) && REFUS_DEFINITIF.has(err.code);

/**
 * Qui peut décocher. On ne décoche que ce qu'on a coché soi-même : décocher la
 * tâche de l'autre lui retirerait ses points sans qu'il le sache.
 *
 * Une tâche cochée sans auteur enregistré — cochée avant que la colonne ne soit
 * remplie, ou dont l'auteur a supprimé son compte — n'appartient à personne :
 * chacun peut la décocher, sans quoi elle resterait cochée pour toujours.
 *
 * La même règle est posée dans la base (nas/db/decoche.sql), qui seule fait
 * autorité : une PWA sert sa version en cache, donc un téléphone en retard
 * d'une mise à jour ne connaît pas encore celle-ci.
 */
export const decochable = (task, userId) =>
  !task.done || !task.doneBy || task.doneBy === userId;

/**
 * Qui peut modifier une tâche — son texte, son échéance — ou la supprimer.
 * Seule la personne qui l'a ajoutée : c'est sa tâche, sa façon de la dire.
 * L'autre peut toujours la cocher ; c'est même ce qui rapporte le plus.
 *
 * Une tâche sans auteur enregistré (ajoutée avant que la colonne n'existe, ou
 * dont l'auteur a supprimé son compte) n'appartient à personne : chacun peut
 * la modifier, sans quoi elle resterait figée pour toujours.
 *
 * La base applique la même règle (nas/db/taches-auteur.sql), qui seule fait
 * autorité.
 */
export const modifiable = (task, userId) =>
  Boolean(task) && (!task.createdBy || task.createdBy === userId);

/**
 * Deux textes de tâche qui disent la même chose : on ignore la casse, les
 * accents et les espaces en trop. « Déboucher  le siphon » = « deboucher le
 * siphon ».
 */
export const memeTexte = (a, b) => {
  const norme = (x) =>
    String(x || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return norme(a) !== '' && norme(a) === norme(b);
};

/**
 * La tâche encore à faire qui porte déjà ce texte et se voit dans ce mois-là
 * (celles des mois passés y sont reportées), s'il y en a une. Deux tâches
 * identiques à faire en même temps, ce n'est presque jamais voulu : c'est un
 * ajout répété parce que le premier ne s'était pas vu.
 */
export const doublonAFaire = (tasks, month, text) =>
  (tasks || []).find(
    (t) => !t.deleted && !t.done && t.month <= month && memeTexte(t.text, text),
  ) || null;

// Les champs qui relèvent de la modification. Cocher et décocher n'en font pas
// partie : ils ont leur propre règle, plus haut.
const CHAMPS_DE_L_AUTEUR = ['text', 'deleted', 'dueAt', 'dueHasTime', 'month'];

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

// Combien de temps une écriture à nous prime sur les échos du serveur.
//
// Le temps réel renvoie aussi nos propres écritures, et l'écho d'une coche
// peut arriver APRÈS qu'on a décoché : sans garde, la tâche se recoche toute
// seule le temps d'un aller-retour. Personne ne le voit passer, mais le combo,
// lui, compte une tâche qui n'est plus cochée.
const GRACE_ECHO = 3000;

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
  // Quand on a touché chaque tâche pour la dernière fois, de notre côté.
  const ecritLocal = useRef(new Map());
  const echoIgnore = useRef(null);

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

  // Relit la base et écrase le cache local. Séparé de refresh(), qui vide la
  // file d'abord : ici c'est justement la file qui appelle.
  const resync = useCallback(async () => {
    if (!supabase || !householdId) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('household_id', householdId);
    if (!error && data) persist(data.map(fromRow));
  }, [householdId, persist]);

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
    let refuse = false;
    try {
      let q = getQueue();
      while (q.length > 0) {
        try {
          await sendOp(q[0]);
        } catch (err) {
          // Hors ligne ou erreur passagère : on garde l'opération pour plus
          // tard. Refus définitif : on la jette et on notera qu'il faut relire.
          if (!estDefinitif(err)) break;
          refuse = true;
        }
        q = q.slice(1);
        setQueue(q);
      }
    } finally {
      flushing.current = false;
    }
    // L'écran montre une modification que le serveur a refusée : on le remet
    // d'accord avec la base.
    if (refuse) await resync();
  }, [getQueue, sendOp, setQueue, resync]);

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
    await resync();
    setLoading(false);
  }, [householdId, flushQueue, resync]);

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
            // Une écriture à nous vient de partir sur cette tâche : c'est elle
            // qui fait foi, l'écho porte peut-être un état plus ancien. On le
            // laisse passer, et on relit une fois la fenêtre refermée pour ne
            // pas rater, au passage, une modification de l'autre.
            const ecrit = ecritLocal.current.get(mapped.id);
            if (ecrit && Date.now() - ecrit < GRACE_ECHO) {
              if (!echoIgnore.current) {
                echoIgnore.current = setTimeout(() => {
                  echoIgnore.current = null;
                  refresh();
                }, GRACE_ECHO);
              }
              return;
            }
            ecritLocal.current.delete(mapped.id);
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
      if (echoIgnore.current) clearTimeout(echoIgnore.current);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  // --- Mutations (optimistes + mises en file) ---

  const applyLocal = useCallback(
    (id, patch) => {
      ecritLocal.current.set(id, Date.now());
      const next = tasksRef.current.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t,
      );
      persist(next);
    },
    [persist],
  );

  /**
   * Ajoute une tâche. Renvoie { id } pour la nouvelle, ou { doublon: id } si
   * une tâche identique attend déjà — l'écran la montre alors au lieu d'en
   * créer une seconde.
   */
  const addTask = useCallback(
    (month, text) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const existante = doublonAFaire(tasksRef.current, month, trimmed);
      if (existante) return { doublon: existante.id };
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
        doneAt: null,
        createdBy: userId ?? null,
        dueAt: null,
        dueHasTime: true,
        deleted: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      persist([...tasksRef.current, task]);
      enqueue({ type: 'insert', row: toInsertRow(task) });
      return { id: task.id };
    },
    [householdId, userId, persist, enqueue],
  );

  const updateTask = useCallback(
    (id, patch) => {
      if (CHAMPS_DE_L_AUTEUR.some((c) => c in patch)) {
        const task = tasksRef.current.find((t) => t.id === id);
        if (!modifiable(task, userId)) return false;
      }
      applyLocal(id, patch);
      enqueue({ type: 'update', id, row: patchToRow(patch) });
      return true;
    },
    [applyLocal, enqueue, userId],
  );

  const peutDecocher = useCallback((task) => decochable(task, userId), [userId]);
  const peutModifier = useCallback((task) => modifiable(task, userId), [userId]);

  /**
   * Coche ou décoche. Renvoie false si la décoche est refusée, 'reservee' si
   * l'autre a réservé la tâche, sinon le
   * multiplicateur de combo que la coche vient de décrocher (1 = pas de
   * combo), pour que l'écran puisse l'annoncer.
   */
  const toggleDone = useCallback(
    (task, currentMonth) => {
      if (task.done && !peutDecocher(task)) return false;
      // Réservée par l'autre : elle est à lui tant que l'heure court.
      if (!task.done && etatReservation(task, tasksRef.current, userId) === 'autre') {
        return 'reservee';
      }
      if (task.done) {
        updateTask(task.id, { done: false, doneMonth: null, doneBy: null, doneAt: null });
        return 1;
      }
      // Le rang se lit avant d'écrire : la tâche qu'on coche n'est pas encore
      // dans le compte de la journée, et c'est elle qui prend le rang suivant.
      const combo = comboProchain(tasksRef.current, userId);
      updateTask(task.id, {
        done: true,
        doneMonth: currentMonth,
        doneBy: userId ?? null,
        doneAt: nowIso(),
      });
      return combo;
    },
    [updateTask, userId, peutDecocher],
  );

  /** Pose ou retire l'échéance d'une tâche. */
  const setDue = useCallback(
    (id, due) =>
      updateTask(id, {
        dueAt: due ? due.iso : null,
        dueHasTime: due ? due.hasTime : true,
      }),
    [updateTask],
  );

  /**
   * « Je m'en occupe » pour une heure. Renvoie false si les règles s'y
   * opposent (une autre en cours, déjà réservée aujourd'hui, prise par
   * l'autre). Le serveur repose les heures avec les siennes.
   */
  const reserver = useCallback(
    (task) => {
      if (etatReservation(task, tasksRef.current, userId) !== 'libre') return false;
      const debut = Date.now();
      return updateTask(task.id, {
        reservePar: userId,
        reserveDebut: new Date(debut).toISOString(),
        reserveFin: new Date(debut + RESERVATION_MS).toISOString(),
      });
    },
    [updateTask, userId],
  );

  /** Annule sa propre réservation : la tâche redevient libre pour l'autre. */
  const annulerReservation = useCallback(
    (task) => {
      if (etatReservation(task, tasksRef.current, userId) !== 'moi') return false;
      return updateTask(task.id, { reserveFin: nowIso() });
    },
    [updateTask, userId],
  );

  const removeTask = useCallback(
    (id) => updateTask(id, { deleted: true }),
    [updateTask],
  );

  return {
    userId,
    tasks,
    loading,
    online,
    pending,
    refresh,
    addTask,
    updateTask,
    setDue,
    toggleDone,
    peutDecocher,
    peutModifier,
    removeTask,
    reserver,
    annulerReservation,
  };
}
