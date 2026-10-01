import { useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import { carriedFromLabel } from '../lib/visibility.js';
import { buildDue, splitDue, dueFull, dueLevel } from '../lib/deadline.js';
import DueBadge, { Chrono } from './DueBadge.jsx';
import { ReserveBadge, ReserveActions, useMaintenant } from './Reservation.jsx';
import { reservationActive } from '../lib/reservation.js';

export default function TaskItem({ task, month, currentMonth, store, onCombo, names = {}, eclat = false, signer = null, noms = {} }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const [dueOpen, setDueOpen] = useState(false);
  const [refus, setRefus] = useState(false);
  const start = splitDue(task.dueAt, task.dueHasTime);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);

  // Réservée par l'autre : la case se grise tant que l'heure court. L'horloge
  // lente redessine la ligne à l'échéance pour la rendre de nouveau cochable.
  const maintenant = useMaintenant(reservationActive(task));
  const bloquee =
    reservationActive(task, maintenant) && task.reservePar !== store.userId;
  // Mode entreprise : chaque action est signée d'un code opérateur, et c'est
  // la base qui juge (auteur, qui a coché). Le menu s'ouvre donc toujours.
  const entreprise = Boolean(signer);
  const peutModifier = entreprise || store.peutModifier(task);
  const carried = carriedFromLabel(task, month);
  const level = task.done ? null : dueLevel(task.dueAt);

  // En entreprise, la modification ne part qu'avec un code valide.
  const modifier = (titre, patch) =>
    signer(titre, task.text, (code) => store.modifierOp(task, code, patch));

  const saveDue = (e) => {
    e.preventDefault();
    const due = buildDue(date, time);
    if (entreprise) {
      modifier(t('entreprise.quiModifie'), { dueAt: due ? due.iso : null, dueHasTime: due ? due.hasTime : true });
    } else {
      store.setDue(task.id, due);
    }
    setDueOpen(false);
    setOpen(false);
  };

  const clearDue = () => {
    if (entreprise) modifier(t('entreprise.quiModifie'), { dueAt: null, dueHasTime: true });
    else store.setDue(task.id, null);
    setDate('');
    setTime('');
    setDueOpen(false);
    setOpen(false);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (text && text !== task.text) {
      if (entreprise) modifier(t('entreprise.quiModifie'), { text });
      else store.updateTask(task.id, { text });
    }
    setEditing(false);
  };

  const remove = () => {
    if (entreprise) modifier(t('entreprise.quiSupprime'), { deleted: true });
    else store.removeTask(task.id);
    setOpen(false);
  };

  const cocher = () => {
    if (entreprise) {
      signer(
        task.done ? t('entreprise.quiDecoche') : t('entreprise.quiCoche'),
        task.text,
        async (code) => {
          const r = await store.cocherOp(task, code, currentMonth);
          if (!r.erreur && r.combo > 1) onCombo(r.combo);
          return r;
        },
      );
      return;
    }
    const combo = store.toggleDone(task, currentMonth);
    if (combo === false || combo === 'reservee') {
      // On explique au lieu de rester inerte : un bouton mort passe
      // pour une panne.
      setRefus(combo === false ? 'decoche' : 'reservee');
      setTimeout(() => setRefus(false), 3200);
      return;
    }
    if (combo > 1) onCombo(combo);
  };

  // Qui a créé, qui a fait : en entreprise, c'est tout l'intérêt.
  const signature = entreprise
    ? task.done && task.doneOp && noms[task.doneOp]
      ? t('entreprise.faitPar', { nom: noms[task.doneOp] })
      : task.createdOp && noms[task.createdOp]
        ? t('entreprise.par', { nom: noms[task.createdOp] })
        : null
    : null;

  return (
    <li
      data-tache={task.id}
      className={`task ${task.done ? 'done' : ''} ${level ? `has-due due-lvl-${level}` : ''} ${eclat ? 'task-eclat' : ''} ${bloquee ? 'task-bloquee' : ''}`}
    >
      <div className="task-row">
        <button
          type="button"
          className="check"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? t('taches.decocher') : t('taches.cocher')}
          onClick={cocher}
        >
          <span className="check-box">{task.done ? '✓' : ''}</span>
        </button>

        {editing && !task.done ? (
          <form className="edit" onSubmit={saveEdit}>
            <input
              className="field"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="edit-actions">
              <button className="btn btn-small btn-accent" type="submit">
                {t('app.enregistrer')}
              </button>
              <button
                className="btn btn-small"
                type="button"
                onClick={() => {
                  setDraft(task.text);
                  setEditing(false);
                }}
              >
                {t('app.annuler')}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="task-text"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="task-label">{task.text}</span>
            {carried && <span className="carried">{carried}</span>}
            <span className="task-badges">
              {signature && <span className="op-signature">{signature}</span>}
              <ReserveBadge task={task} userId={store.userId} names={names} />
              <DueBadge dueAt={task.dueAt} done={task.done} />
            </span>
          </button>
        )}
      </div>

      {refus === 'decoche' && <p className="refus">{t('taches.decocheInterdite')}</p>}
      {refus === 'reservee' && (
        <p className="refus">
          {t('reserver.bloquee', {
            qui: names[task.reservePar] || t('cerveau.binome'),
            h: new Date(task.reserveFin).toLocaleTimeString(langue(), { hour: '2-digit', minute: '2-digit' }),
          })}
        </p>
      )}

      {open && !editing && dueOpen && !task.done && (
        <form className="due-form" onSubmit={saveDue}>
          <p className="due-form-title">
            <Chrono size={15} /> {t('echeance.titre')}
          </p>
          <div className="due-fields">
            <label className="due-field">
              <span className="field-label">{t('echeance.jour')}</span>
              <input
                className="field"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="due-field">
              <span className="field-label">{t('echeance.heure')}</span>
              <input
                className="field"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <p className="due-note">
{t('echeance.aide')}
          </p>
          <div className="edit-actions">
            <button className="btn btn-small btn-urgent" type="submit" disabled={!date}>
              {t('app.enregistrer')}
            </button>
            {task.dueAt && (
              <button className="btn btn-small" type="button" onClick={clearDue}>
                {t('echeance.retirer')}
              </button>
            )}
            <button
              className="btn btn-small"
              type="button"
              onClick={() => setDueOpen(false)}
            >
              {t('app.annuler')}
            </button>
          </div>
        </form>
      )}

      {/* La tâche de l'autre : on la coche, on ne la réécrit pas. On explique
          pourquoi plutôt que d'ouvrir un menu vide. */}
      {open && !peutModifier && (
        <div className="actions actions-autre">
          {!entreprise && (
            <ReserveActions
              task={task}
              store={store}
              userId={store.userId}
              names={names}
              onFait={() => setOpen(false)}
            />
          )}
          <p className="refus refus-doux">{t('taches.modifInterdite')}</p>
          {task.dueAt && (
            <p className="due-recap">
              {t('echeance.recap', { quand: dueFull(task.dueAt, task.dueHasTime) })}
            </p>
          )}
        </div>
      )}

      {/* Une tâche faite n'a plus rien à changer : ni texte, ni échéance. On
          peut seulement la supprimer. */}
      {open && peutModifier && task.done && (
        <div className="actions" role="group" aria-label={t('taches.actions')}>
          <button className="action action-danger" type="button" onClick={remove}>
            {t('taches.supprimer')}
          </button>
        </div>
      )}

      {open && !editing && !dueOpen && peutModifier && !task.done && (
        <div className="actions" role="group" aria-label={t('taches.actions')}>
          {/* D'abord « je m'en occupe », puis l'échéance seule sur sa ligne,
              puis modifier et supprimer côte à côte : les deux gestes qui
              touchent à la tâche elle-même. */}
          {!entreprise && (
            <ReserveActions
              task={task}
              store={store}
              userId={store.userId}
              names={names}
              onFait={() => setOpen(false)}
            />
          )}
          <button
            className="action action-due"
            type="button"
            onClick={() => setDueOpen(true)}
          >
            <Chrono />
            {task.dueAt ? t('echeance.modifier') : t('echeance.ajouter')}
          </button>
          <div className="actions-ligne">
            <button
              className="action"
              type="button"
              onClick={() => {
                setEditing(true);
                setOpen(false);
              }}
            >
              {t('taches.modifier')}
            </button>
            <button className="action action-danger" type="button" onClick={remove}>
              {t('taches.supprimer')}
            </button>
          </div>
          {task.dueAt && (
            <p className="due-recap">
              {t('echeance.recap', { quand: dueFull(task.dueAt, task.dueHasTime) })}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
