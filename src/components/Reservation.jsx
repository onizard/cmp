import { useEffect, useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import {
  etatReservation,
  maReservation,
  minutesRestantes,
  reservationActive,
} from '../lib/reservation.js';

const heure = (iso) =>
  new Date(iso).toLocaleTimeString(langue(), { hour: '2-digit', minute: '2-digit' });

/**
 * Une horloge lente, seulement tant qu'une réservation court : l'état ne sert
 * qu'à redessiner toutes les 30 s, l'heure lue est toujours la vraie.
 */
export function useMaintenant(actif) {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!actif) return undefined;
    const h = setInterval(() => setTic((n) => n + 1), 30_000);
    return () => clearInterval(h);
  }, [actif]);
  return Date.now();
}

/**
 * La pastille « 🙋 Vanessa s'en occupe · 42 min », sur la ligne de la tâche.
 * Elle se retire d'elle-même quand l'heure est passée.
 */
export function ReserveBadge({ task, userId, names, noms = null }) {
  const t = useT();
  const maintenant = useMaintenant(reservationActive(task));
  if (!reservationActive(task, maintenant)) return null;
  const min = minutesRestantes(task, maintenant);
  // En entreprise, le compte est partagé : on nomme toujours le membre.
  if (noms) {
    return (
      <span className="reserve reserve-autre">
        <span aria-hidden="true">🙋</span>
        {t('reserver.badgeAutre', { min, qui: noms[task.reserveOp] || '?' })}
      </span>
    );
  }
  const moi = task.reservePar === userId;
  return (
    <span className={`reserve ${moi ? 'reserve-moi' : 'reserve-autre'}`}>
      <span aria-hidden="true">🙋</span>
      {moi
        ? t('reserver.badgeMoi', { min })
        : t('reserver.badgeAutre', { min, qui: names[task.reservePar] || t('cerveau.binome') })}
    </span>
  );
}

/**
 * Le haut du menu d'une tâche en attente : réserver, annuler, ou dire
 * pourquoi on ne peut pas.
 */
export function ReserveActions({ task, store, userId, names, onFait }) {
  const t = useT();
  const etat = etatReservation(task, store.tasks, userId);
  if (!etat) return null;

  if (etat === 'autre') {
    const qui = names[task.reservePar] || t('cerveau.binome');
    return (
      <div className="reserve-bloc">
        <p className="reserve-note reserve-note-autre">
          <span aria-hidden="true">🙋 </span>
          {t('reserver.jusquaAutre', { qui, h: heure(task.reserveFin) })}
        </p>
      </div>
    );
  }

  if (etat === 'moi') {
    return (
      <div className="reserve-bloc">
        <button
          className="action action-reserve-annuler"
          type="button"
          onClick={() => {
            store.annulerReservation(task);
            onFait();
          }}
        >
          {t('reserver.annuler')}
        </button>
        <p className="reserve-note">{t('reserver.jusquaMoi', { h: heure(task.reserveFin) })}</p>
      </div>
    );
  }

  const bloque = etat !== 'libre';
  const autre = etat === 'uneAutre' ? maReservation(store.tasks, userId) : null;
  return (
    <div className="reserve-bloc">
      <button
        className="action action-reserve"
        type="button"
        disabled={bloque}
        onClick={() => {
          store.reserver(task);
          onFait();
        }}
      >
        <span aria-hidden="true">🙋</span>
        {t('reserver.bouton')}
      </button>
      {etat === 'aujourdhui' && <p className="reserve-note">{t('reserver.aujourdhui')}</p>}
      {autre && <p className="reserve-note">{t('reserver.uneAutre', { tache: autre.text })}</p>}
    </div>
  );
}

/** Ce que la base répond, dit avec des mots (null : rien à dire, on ferme). */
function motDuRefus(t, r, noms) {
  if (r.refus === 'autre') {
    return t('reserver.jusquaEquipe', { qui: noms[r.qui] || '?', h: heure(r.fin) });
  }
  if (r.refus === 'aujourdhui') return t('reserver.aujourdhui');
  if (r.refus === 'uneAutre') return t('reserver.uneAutre', { tache: r.tache || '' });
  if (r.refus === 'pasToi') return t('reserver.pasToi');
  return null;
}

/**
 * Mode entreprise : le même « je m'en occupe (1 h) », signé d'un code. On ne
 * sait qui agit qu'une fois le code tapé : c'est la base qui tranche, et la
 * fenêtre du code dit pourquoi elle refuse.
 */
export function ReserveActionsOp({ task, store, noms, signer, onFait }) {
  const t = useT();
  const maintenant = useMaintenant(reservationActive(task));
  if (task.done || task.deleted) return null;

  const signerPuis = (titre, action) =>
    signer(titre, task.text, async (code) => {
      const r = await action(task, code);
      if (r.erreur) return r;
      if (r.refus) {
        const mot = motDuRefus(t, r, noms);
        if (mot) return { erreur: mot };
      }
      onFait();
      return r;
    });

  if (reservationActive(task, maintenant)) {
    const qui = noms[task.reserveOp] || '?';
    return (
      <div className="reserve-bloc">
        <p className="reserve-note reserve-note-autre">
          <span aria-hidden="true">🙋 </span>
          {t('reserver.jusquaEquipe', { qui, h: heure(task.reserveFin) })}
        </p>
        <button
          className="action action-reserve-annuler"
          type="button"
          onClick={() => signerPuis(t('entreprise.quiLibere'), store.libererOp)}
        >
          {t('reserver.liberer')}
        </button>
      </div>
    );
  }

  return (
    <div className="reserve-bloc">
      <button
        className="action action-reserve"
        type="button"
        onClick={() => signerPuis(t('entreprise.quiReserve'), store.reserverOp)}
      >
        <span aria-hidden="true">🙋</span>
        {t('reserver.bouton')}
      </button>
    </div>
  );
}
