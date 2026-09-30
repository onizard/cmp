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
export function ReserveBadge({ task, userId, names }) {
  const t = useT();
  const maintenant = useMaintenant(reservationActive(task));
  if (!reservationActive(task, maintenant)) return null;
  const min = minutesRestantes(task, maintenant);
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
