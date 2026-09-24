import { useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import Brain from './Brain.jsx';
import Bon from './Bon.jsx';
import Defilant from './Defilant.jsx';
import { libelleRecompense, libelleBon } from '../lib/libelle.js';
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

  // L'inventaire : MES bons, les non utilisés d'abord, du plus récent au plus
  // ancien. Aucune limite — c'est une collection.
  //
  // Ceux de l'autre n'y figurent pas : ils ont été payés avec ses points, on
  // n'a pas à en disposer. Ils restent lus depuis la base, en revanche, car
  // c'est ce qui permet de calculer ses points à elle ou à lui.
  const mesClaims = store.claims
    .filter((c) => !c.deleted && c.userId === userId)
    .slice()
    .sort((a, b) => {
      if (Boolean(a.usedAt) !== Boolean(b.usedAt)) return a.usedAt ? 1 : -1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  // Le dessin d'un bon suit sa récompense : on le retrouve par reward_id.
  const visuelDe = (c) => {
    if (!c.rewardId) return null;
    const r = store.rewards.find((x) => x.id === c.rewardId);
    return (r && r.visuel) || null;
  };

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
          <div className="rowline">
            <span>{t('cerveau.baremeCombo')}</span>
            <b>×2, ×3, ×4…</b>
          </div>
          <p className="setnote">{t('cerveau.baremeComboNote')}</p>
          <p className="setnote">
{t('cerveau.baremeNote')}
          </p>
        </div>
      )}

      {next && (
        <section className="gage-card">
          <h4>{t('cerveau.prochaine', { nom: libelleRecompense(next.reward) })}</h4>
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
          <Defilant label={t('recompenses.titre')}>
          <ul className="gage-list">
            {catalogue.map((r) => {
              const ok = myPts >= r.cost;
              return (
                <li key={r.id} className={`reward ${ok ? 'ok' : ''}`}>
                  <span className="reward-cost">{formatPoints(r.cost)}</span>
                  <span className="reward-label">{libelleRecompense(r)}</span>
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
          </Defilant>
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

      <section className="setgroup">
        <h2 className="setlabel">{t('inventaire.titre')}</h2>
        {mesClaims.length === 0 ? (
          <p className="setnote">{t('inventaire.vide')}</p>
        ) : (
          <div className="bons">
            {mesClaims.map((c) => (
              <Bon
                key={c.id}
                bon={c}
                libelle={libelleBon(c, store.rewards)}
                visuel={visuelDe(c)}
                lang={langue()}
                onUtiliser={() => store.useClaim(c.id)}
              />
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
