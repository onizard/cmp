import { useState } from 'react';
import Brain from './Brain.jsx';
import {
  pointsAvailable,
  gageProgress,
  canGift,
  gagesToHonour,
  GAGE_COST,
} from '../lib/gamify.js';

export default function BrainView({ tasks, userId, gages }) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const other = gages.otherUser;
  const myName = gages.names[userId] || 'Toi';
  const otherName = (other && gages.names[other]) || 'Ton binôme';

  const myPts = pointsAvailable(tasks, gages.gages, userId);
  const otherPts = other ? pointsAvailable(tasks, gages.gages, other) : 0;

  const prog = gageProgress(tasks, gages.gages, userId);
  const giftable = canGift(tasks, gages.gages, userId);
  const toHonour = gagesToHonour(gages.gages, userId);
  const given = gages.gages.filter(
    (g) => !g.deleted && g.fromUser === userId && !g.done,
  );

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    gages.createGage(draft);
    setDraft('');
    setOpen(false);
  };

  return (
    <main className="brain-view">
      <p className="brain-lede">La charge que chacun·e a portée. 💛</p>

      <div className="brains">
        <div className="person">
          <div className="vase">
            <Brain fill={Math.min(1, myPts / GAGE_COST)} id="me" />
          </div>
          <h3>{myName}</h3>
          <div className="pts">
            <b>{myPts}</b> / {GAGE_COST} pts
          </div>
        </div>
        <div className="person">
          <div className="vase">
            <Brain fill={Math.min(1, otherPts / GAGE_COST)} id="other" />
          </div>
          <h3>{otherName}</h3>
          <div className="pts">
            <b>{otherPts}</b> / {GAGE_COST} pts
          </div>
        </div>
      </div>

      <section className="gage-card">
        <h4>Le prochain gage</h4>
        <p className="soft-text" style={{ margin: '0 0 4px' }}>
          À {GAGE_COST} points, tu offres un petit gage tout doux à l'autre.
        </p>
        <div className="gauge" aria-hidden="true">
          <span style={{ width: `${(prog.done / prog.total) * 100}%` }} />
        </div>
        <p className="soft-text" style={{ margin: 0 }}>
          {giftable
            ? 'Tu peux offrir un gage à l’autre. 🎁'
            : `Encore ${prog.remaining} tâche${prog.remaining > 1 ? 's' : ''} cochée${
                prog.remaining > 1 ? 's' : ''
              } pour débloquer un gage.`}
        </p>

        {giftable &&
          (open ? (
            <form className="gage-form" onSubmit={submit}>
              <label className="field-label" htmlFor="gage">
                Le gage à offrir
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
                <button
                  className="btn btn-small btn-accent"
                  type="submit"
                  disabled={!other}
                >
                  Offrir (−{GAGE_COST})
                </button>
                <button
                  className="btn btn-small"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </button>
              </div>
              {!other && (
                <p className="soft-text">
                  Invite d’abord l’autre personne (onglet « Mon compte »).
                </p>
              )}
            </form>
          ) : (
            <button
              className="btn btn-accent btn-block"
              type="button"
              onClick={() => setOpen(true)}
            >
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
                <button
                  className="btn btn-small"
                  type="button"
                  onClick={() => gages.honourGage(g.id)}
                >
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
