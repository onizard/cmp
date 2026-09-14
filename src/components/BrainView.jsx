import { useState } from 'react';
import Brain from './Brain.jsx';
import {
  brainFill,
  pendingCount,
  pointsAvailable,
  gageProgress,
  canGift,
  gagesToHonour,
  GAGE_COST,
} from '../lib/gamify.js';

export default function BrainView({ tasks, userId, gages }) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const fill = brainFill(tasks);
  const pending = pendingCount(tasks);
  const available = pointsAvailable(tasks, gages.gages, userId);
  const prog = gageProgress(tasks, gages.gages, userId);
  const giftable = canGift(tasks, gages.gages, userId);
  const toHonour = gagesToHonour(gages.gages, userId);
  const given = gages.gages.filter((g) => !g.deleted && g.fromUser === userId && !g.done);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    gages.createGage(draft);
    setDraft('');
    setOpen(false);
  };

  const charge =
    pending === 0
      ? 'La tête est légère.'
      : pending === 1
        ? '1 chose en tête.'
        : `${pending} choses en tête.`;

  return (
    <main className="brain-view">
      <div className="brain-wrap">
        <Brain fill={fill} />
      </div>
      <p className="brain-charge">{charge}</p>

      <section className="points-card">
        <div className="points-line">
          <span className="points-num">{available}</span>
          <span className="points-label">
            {available <= 1 ? 'point à toi' : 'points à toi'}
          </span>
        </div>
        <div className="gauge" aria-hidden="true">
          <span style={{ width: `${(prog.done / prog.total) * 100}%` }} />
        </div>
        <p className="soft-text">
          {giftable
            ? 'Tu peux offrir un gage à l’autre.'
            : `Encore ${prog.remaining} tâche${prog.remaining > 1 ? 's' : ''} cochée${
                prog.remaining > 1 ? 's' : ''
              } pour débloquer un gage.`}
        </p>

        {giftable &&
          (open ? (
            <form className="gage-form" onSubmit={submit}>
              <label className="field-label" htmlFor="gage">
                Le gage à imposer
              </label>
              <input
                id="gage"
                className="field"
                value={draft}
                autoFocus
                placeholder="Massage 15 min ce soir…"
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="add-actions">
                <button className="btn btn-small btn-accent" type="submit" disabled={!gages.otherUser}>
                  Offrir (−{GAGE_COST})
                </button>
                <button className="btn btn-small" type="button" onClick={() => setOpen(false)}>
                  Annuler
                </button>
              </div>
              {!gages.otherUser && (
                <p className="soft-text">Invite d’abord l’autre personne (bouton « Foyer »).</p>
              )}
            </form>
          ) : (
            <button className="btn btn-accent" type="button" onClick={() => setOpen(true)}>
              Offrir un gage
            </button>
          ))}
      </section>

      {toHonour.length > 0 && (
        <section className="gage-section">
          <h2 className="gage-title">Tes gages à honorer</h2>
          <ul className="gage-list">
            {toHonour.map((g) => (
              <li key={g.id} className="gage-item">
                <span>{g.text}</span>
                <button className="btn btn-small" type="button" onClick={() => gages.honourGage(g.id)}>
                  C’est fait
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {given.length > 0 && (
        <section className="gage-section">
          <h2 className="gage-title">Gages offerts, en attente</h2>
          <ul className="gage-list">
            {given.map((g) => (
              <li key={g.id} className="gage-item soft">
                <span>{g.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
