import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Brain from './Brain.jsx';
import {
  pointsAvailable,
  pointsBreakdown,
  sortRewards,
  nextReward,
  jauge,
  formatPoints,
  canClaimCustom,
  customMissing,
  REWARD_CUSTOM,
  POINT_ADD,
  POINT_OWN,
  POINT_OTHER,
} from '../lib/gamify.js';

export default function BrainView({ tasks, userId, rewards: store }) {
  const t = useT();
  const [openWish, setOpenWish] = useState(false);
  const [wish, setWish] = useState('');
  const [wishError, setWishError] = useState(null);
  const [showBareme, setShowBareme] = useState(false);

  const other = store.otherUser;
  const myName = store.names[userId] || t('cerveau.toi');
  const otherName = (other && store.names[other]) || t('cerveau.binome');

  const myPts = pointsAvailable(tasks, store.claims, userId);
  const otherPts = other ? pointsAvailable(tasks, store.claims, other) : 0;
  const detail = pointsBreakdown(tasks, userId);

  const catalogue = sortRewards(store.rewards);
  const next = nextReward(store.rewards, myPts);

  // Le dessin se lit sur 100 points, puis repart du bas dans une autre teinte.
  // Le compteur, lui, n'a toujours aucune limite.
  const jaugeDe = (pts) => jauge(pts);

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
      <p className="brain-lede">{t('cerveau.lede')}</p>

      <div className="brains">
        <div className="person">
          <div className="vase">
            <Brain {...jaugeDe(myPts)} />
          </div>
          <h3>{myName}</h3>
          <div className="pts">
            <b>{formatPoints(myPts)}</b> {t('cerveau.pts')}
          </div>
        </div>
        <div className="person">
          <div className="vase">
            <Brain {...jaugeDe(otherPts)} />
          </div>
          <h3>{otherName}</h3>
          <div className="pts">
            <b>{formatPoints(otherPts)}</b> {t('cerveau.pts')}
          </div>
        </div>
      </div>

      <p className="detail-line">
        {t('cerveau.detail', {
          ajoutees: detail.added,
          faites: detail.own,
          autres: detail.other,
        })}
        <button
          type="button"
          className="link bareme-link"
          onClick={() => setShowBareme((v) => !v)}
        >
          {t('cerveau.bareme')}
        </button>
      </p>

      {showBareme && (
        <div className="setcard bareme">
          <div className="rowline">
            <span>{t('cerveau.baremeAjouter')}</span>
            <b>{formatPoints(POINT_ADD)} pt</b>
          </div>
          <div className="rowline">
            <span>{t('cerveau.baremeSienne')}</span>
            <b>{formatPoints(POINT_OWN)} pt</b>
          </div>
          <div className="rowline">
            <span>{t('cerveau.baremeAutre')}</span>
            <b>{formatPoints(POINT_OTHER)} pts</b>
          </div>
          <p className="setnote">
{t('cerveau.baremeNote')}
          </p>
        </div>
      )}

      {next && (
        <section className="gage-card">
          <h4>{t('cerveau.prochaine', { nom: next.reward.label })}</h4>
          <div className="gauge" aria-hidden="true">
            <span
              style={{
                width: `${Math.round(Math.min(1, myPts / next.reward.cost) * 100)}%`,
              }}
            />
          </div>
          <p className="setnote">
            {t('cerveau.manque', { n: formatPoints(next.missing) })}
          </p>
        </section>
      )}

      <section className="gage-section">
        <h2 className="gage-title">{t('recompenses.titre')}</h2>
        {catalogue.length === 0 ? (
          <p className="setnote">
            {t('recompenses.vide')}
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
                    {t('recompenses.prendre')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <section className={`wish ${canClaimCustom(myPts) ? 'wish-open' : ''}`}>
          <h3 className="wish-title">{t('recompenses.surMesure')}</h3>
          {canClaimCustom(myPts) ? (
            openWish ? (
              <form onSubmit={submitWish}>
                <p className="wish-text">
                  {t('recompenses.surMesureInvite')}
                </p>
                <label className="field-label" htmlFor="wish">{t('recompenses.surMesureChamp')}</label>
                <input
                  id="wish"
                  className="field"
                  value={wish}
                  autoFocus
                  placeholder={t('recompenses.surMesurePlaceholder')}
                  onChange={(e) => {
                    setWishError(null);
                    setWish(e.target.value);
                  }}
                />
                {wishError && <p className="error">{wishError}</p>}
                <div className="add-actions">
                  <button className="btn btn-small btn-accent" type="submit">
                    {t('recompenses.surMesureObtenir', { n: REWARD_CUSTOM })}
                  </button>
                  <button
                    className="btn btn-small"
                    type="button"
                    onClick={() => setOpenWish(false)}
                  >
                    {t('app.annuler')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="wish-text">
                  {t('recompenses.surMesurePrete', { n: REWARD_CUSTOM })}
                </p>
                <button
                  className="btn btn-accent btn-block"
                  type="button"
                  onClick={() => setOpenWish(true)}
                >
                  {t('recompenses.surMesureBouton')}
                </button>
              </>
            )
          ) : (
            <>
              <p className="wish-text">
                {t('recompenses.surMesureAttente', { n: REWARD_CUSTOM })}
              </p>
              <div className="gauge" aria-hidden="true">
                <span style={{ width: `${Math.round((myPts / REWARD_CUSTOM) * 100)}%` }} />
              </div>
              <p className="wish-text">
                {t('recompenses.surMesureEncore', { n: formatPoints(customMissing(myPts)) })}
              </p>
            </>
          )}
        </section>

      </section>

      {mesClaims.length > 0 && (
        <section className="gage-section">
          <h2 className="gage-title">{t('recompenses.dejaOffert')}</h2>
          <ul className="gage-list">
            {mesClaims.map((c) => (
              <li key={c.id} className="gage-item">
                <span>
                  {!c.rewardId && <span className="claim-wish">{t('recompenses.surMesureBadge')}</span>}
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
                    {t('app.annuler')}
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
