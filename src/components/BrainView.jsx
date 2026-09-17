import { useState } from 'react';
import Brain from './Brain.jsx';
import {
  pointsAvailable,
  pointsBreakdown,
  sortRewards,
  nextReward,
  rewardFill,
  formatPoints,
  canClaimCustom,
  customMissing,
  REWARD_CUSTOM,
  POINT_ADD,
  POINT_OWN,
  POINT_OTHER,
} from '../lib/gamify.js';

export default function BrainView({ tasks, userId, rewards: store }) {
  const [openWish, setOpenWish] = useState(false);
  const [wish, setWish] = useState('');
  const [wishError, setWishError] = useState(null);
  const [showBareme, setShowBareme] = useState(false);

  const other = store.otherUser;
  const myName = store.names[userId] || 'Toi';
  const otherName = (other && store.names[other]) || 'Ton binôme';

  const myPts = pointsAvailable(tasks, store.claims, userId);
  const otherPts = other ? pointsAvailable(tasks, store.claims, other) : 0;
  const detail = pointsBreakdown(tasks, userId);

  const catalogue = sortRewards(store.rewards);
  const next = nextReward(store.rewards, myPts);

  // Le dessin se remplit vers la prochaine récompense ; le compteur, lui,
  // n'a aucune limite.
  const fillFor = (pts) => rewardFill(store.rewards, pts);

  const mesClaims = store.claims
    .filter((c) => !c.deleted)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6);

  const submitWish = async (e) => {
    e.preventDefault();
    const err = await store.claimCustom(wish);
    if (err) {
      setWishError(err);
      return;
    }
    setWishError(null);
    setWish('');
    setOpenWish(false);
  };

  return (
    <main className="brain-view">
      <p className="brain-lede">Ce que chacun·e a porté. 💛</p>

      <div className="brains">
        <div className="person">
          <div className="vase">
            <Brain fill={fillFor(myPts)} id="me" />
          </div>
          <h3>{myName}</h3>
          <div className="pts">
            <b>{formatPoints(myPts)}</b> pts
          </div>
        </div>
        <div className="person">
          <div className="vase">
            <Brain fill={fillFor(otherPts)} id="other" />
          </div>
          <h3>{otherName}</h3>
          <div className="pts">
            <b>{formatPoints(otherPts)}</b> pts
          </div>
        </div>
      </div>

      <p className="detail-line">
        {detail.added} ajoutée{detail.added > 1 ? 's' : ''} · {detail.own} faite
        {detail.own > 1 ? 's' : ''} · {detail.other} pour l’autre
        <button
          type="button"
          className="link bareme-link"
          onClick={() => setShowBareme((v) => !v)}
        >
          barème
        </button>
      </p>

      {showBareme && (
        <div className="setcard bareme">
          <div className="rowline">
            <span>Ajouter une tâche</span>
            <b>{formatPoints(POINT_ADD)} pt</b>
          </div>
          <div className="rowline">
            <span>Cocher sa propre tâche</span>
            <b>{formatPoints(POINT_OWN)} pt</b>
          </div>
          <div className="rowline">
            <span>Cocher la tâche de l’autre</span>
            <b>{formatPoints(POINT_OTHER)} pts</b>
          </div>
          <p className="setnote">
            Les points se cumulent sans limite. Dépense-les quand tu veux, ou
            épargne pour une récompense plus forte.
          </p>
        </div>
      )}

      {next && (
        <section className="gage-card">
          <h4>Prochaine récompense : {next.reward.label}</h4>
          <div className="gauge" aria-hidden="true">
            <span style={{ width: `${Math.round(fillFor(myPts) * 100)}%` }} />
          </div>
          <p className="setnote">
            Encore <b>{formatPoints(next.missing)}</b> pts pour te l’offrir.
          </p>
        </section>
      )}

      <section className="gage-section">
        <h2 className="gage-title">Les récompenses</h2>
        {catalogue.length === 0 ? (
          <p className="setnote">
            Le catalogue est vide pour l’instant.
          </p>
        ) : (
          <ul className="gage-list">
            {catalogue.map((r) => {
              const ok = myPts >= r.cost;
              return (
                <li key={r.id} className={`reward ${ok ? 'ok' : ''}`}>
                  <span className="reward-cost">{formatPoints(r.cost)}</span>
                  <span className="reward-label">{r.label}</span>
                  <button
                    className="btn btn-small btn-accent"
                    type="button"
                    disabled={!ok}
                    onClick={() => store.claimReward(r)}
                  >
                    Prendre
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <section className={`wish ${canClaimCustom(myPts) ? 'wish-open' : ''}`}>
          <h3 className="wish-title">Récompense sur mesure</h3>
          {canClaimCustom(myPts) ? (
            openWish ? (
              <form onSubmit={submitWish}>
                <p className="wish-text">
                  Dis ce que tu veux. Tu l’obtiens tout de suite.
                </p>
                <label className="field-label" htmlFor="wish">Ta demande</label>
                <input
                  id="wish"
                  className="field"
                  value={wish}
                  autoFocus
                  placeholder="Un week-end à deux…"
                  onChange={(e) => {
                    setWishError(null);
                    setWish(e.target.value);
                  }}
                />
                {wishError && <p className="error">{wishError}</p>}
                <div className="add-actions">
                  <button className="btn btn-small btn-accent" type="submit">
                    Obtenir ({REWARD_CUSTOM} pts)
                  </button>
                  <button
                    className="btn btn-small"
                    type="button"
                    onClick={() => setOpenWish(false)}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="wish-text">
                  Tu as tes {REWARD_CUSTOM} points. Demande ce que tu veux, sans
                  passer par le catalogue.
                </p>
                <button
                  className="btn btn-accent btn-block"
                  type="button"
                  onClick={() => setOpenWish(true)}
                >
                  Demander ma récompense
                </button>
              </>
            )
          ) : (
            <>
              <p className="wish-text">
                À <b>{REWARD_CUSTOM} points</b>, tu demandes ce que tu veux,
                obtenu sur-le-champ.
              </p>
              <div className="gauge" aria-hidden="true">
                <span style={{ width: `${Math.round((myPts / REWARD_CUSTOM) * 100)}%` }} />
              </div>
              <p className="wish-text">
                Encore <b>{formatPoints(customMissing(myPts))}</b> points.
              </p>
            </>
          )}
        </section>

      </section>

      {mesClaims.length > 0 && (
        <section className="gage-section">
          <h2 className="gage-title">Déjà offert</h2>
          <ul className="gage-list">
            {mesClaims.map((c) => (
              <li key={c.id} className="gage-item">
                <span>
                  {!c.rewardId && <span className="claim-wish">sur mesure</span>}
                  {c.label}
                  <span className="claim-who">
                    {' '}
                    — {store.names[c.userId] || (c.userId === userId ? myName : otherName)}
                  </span>
                </span>
                {c.userId === userId && (
                  <button
                    className="btn btn-small"
                    type="button"
                    onClick={() => store.cancelClaim(c.id)}
                  >
                    Annuler
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
