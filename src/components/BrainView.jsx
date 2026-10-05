import { useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import Brain from './Brain.jsx';
import Bon from './Bon.jsx';
import Defilant from './Defilant.jsx';
import CodeOperateur from './CodeOperateur.jsx';
import { libelleRecompense, libelleBon } from '../lib/libelle.js';
import { estFamille, classement, creditees, bonsCredites, tousLesMembres, tousLesNoms } from '../lib/famille.js';
import {
  pointsAvailable,
  pointsBreakdown,
  sortRewards,
  nextReward,
  jauge,
  formatPoints,
  etatBon,
  canClaimCustom,
  customMissing,
  REWARD_CUSTOM,
  POINT_ADD,
  POINT_OWN,
  POINT_OTHER,
  COMBO_BONUS,
} from '../lib/gamify.js';

const RANG_BON = { enAttente: 0, neuf: 1, honore: 2 };

export default function BrainView({ tasks, userId, rewards: store }) {
  const t = useT();
  const [openWish, setOpenWish] = useState(false);
  const [wish, setWish] = useState('');
  const [wishError, setWishError] = useState(null);
  const [showBareme, setShowBareme] = useState(false);

  // Famille : les membres sans compte (un enfant) regardent leurs points et
  // prennent leurs bons depuis ce téléphone. `qui` : la personne affichée.
  const proches = (store.proches || []).filter((p) => p.actif);
  const idsProches = new Set(proches.map((p) => p.id));
  const [quiChoisi, setQui] = useState(userId);
  const qui = quiChoisi === userId || idsProches.has(quiChoisi) ? quiChoisi : userId;
  const pourProche = idsProches.has(qui) ? qui : null;

  // Les points vont à qui a fait (famille.js).
  const tachesC = creditees(tasks);
  const bonsC = bonsCredites(store.claims);
  const noms = tousLesNoms(store.names, store.proches);
  const membres = tousLesMembres(store.members, store.proches);

  const other = store.otherUser;
  const myName = noms[qui] || t('cerveau.toi');
  const otherName = (other && store.names[other]) || t('cerveau.binome');

  const myPts = pointsAvailable(tachesC, bonsC, qui);
  const otherPts = other ? pointsAvailable(tachesC, bonsC, other) : 0;
  const detail = pointsBreakdown(tachesC, qui);

  // Famille : chacun peut avoir un code pour ses bons (codes.sql). Tapé une
  // fois, il vaut jusqu'à ce qu'on quitte l'onglet. Les récompenses de couple
  // (couple.sql) restent derrière le code couple, et jamais pour un enfant.
  const avecCode = new Set(store.avecCode || []);
  const [ouverts, setOuverts] = useState(() => new Set());
  const [coupleOuvert, setCoupleOuvert] = useState(false);
  const [demande, setDemande] = useState(null);
  const garde = (membre, faire) => {
    if (!avecCode.has(membre) || ouverts.has(membre)) {
      faire();
      return;
    }
    setDemande({
      titre: t('codes.titre', { nom: noms[membre] || t('cerveau.toi') }),
      valider: async (code) => {
        const r = await store.ouvrirCode(membre, code);
        if (r) return r === 'faux' ? t('codes.faux') : r;
        setOuverts((s) => new Set([...s, membre]));
        faire();
        return null;
      },
    });
  };
  const ouvrirCouple = () =>
    setDemande({
      titre: t('couple.titre'),
      valider: async (code) => {
        const r = await store.verifierCodeCouple(code);
        if (r) return r === 'faux' ? t('codes.faux') : r;
        setCoupleOuvert(true);
        return null;
      },
    });

  const familleTot = estFamille(membres, store.familleActivee);
  const sansCouple = store.rewards.filter((r) => !(familleTot && r.couple));
  const recompensesCouple = familleTot && !pourProche ? sortRewards(store.rewards.filter((r) => r.couple)) : [];
  const catalogue = sortRewards(sansCouple);
  const next = nextReward(sansCouple, myPts);

  // Le dessin se lit sur 100 points, puis repart du bas dans une autre teinte.
  // Le compteur, lui, n'a toujours aucune limite.
  const jaugeDe = (pts) => jauge(pts);

  // En famille (3 membres ou plus) : un classement au lieu du face-à-face, et
  // chaque bon désigne qui l'honorera.
  const famille = estFamille(membres, store.familleActivee);
  const nomDe = (id) =>
    noms[id] || (id === userId ? t('cerveau.toi') : t('famille.sansPrenom'));
  const rangs = famille ? classement(membres, tachesC, bonsC, noms) : [];
  const autresMembres = famille
    ? membres.filter((id) => id !== qui).map((id) => ({ id, nom: nomDe(id) }))
    : null;
  const MEDAILLES = ['🥇', '🥈', '🥉'];

  // L'inventaire : MES bons, les non utilisés d'abord, du plus récent au plus
  // ancien. Aucune limite — c'est une collection.
  //
  // Ceux de l'autre n'y figurent pas : ils ont été payés avec ses points, on
  // n'a pas à en disposer. Ils restent lus depuis la base, en revanche, car
  // c'est ce qui permet de calculer ses points à elle ou à lui.
  const mesClaims = bonsC
    .filter((c) => !c.deleted && c.userId === qui && !(familleTot && c.couple && !coupleOuvert))
    .slice()
    .sort((a, b) => {
      // D'abord ce qui attend mon « c'est fait », puis les bons neufs, puis
      // la collection des bons poinçonnés.
      const d = RANG_BON[etatBon(a)] - RANG_BON[etatBon(b)];
      if (d) return d;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  // Le dessin d'un bon suit sa récompense : on le retrouve par reward_id.
  const visuelDe = (c) => {
    if (!c.rewardId) return null;
    const r = store.rewards.find((x) => x.id === c.rewardId);
    return (r && r.visuel) || null;
  };

  // Après l'achat, on descend jusqu'au bon : c'est la confirmation qu'il a
  // bien été obtenu, et c'est là que se trouve « Annuler » si le doigt a
  // glissé. Sans ça il atterrit hors de vue, et la minute passe.
  const montrerBon = (id) => {
    if (!id) return;
    const calme =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() =>
      document
        .getElementById(`bon-${id}`)
        ?.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' }),
    );
  };

  const prendre = (r) =>
    garde(qui, async () => {
      montrerBon(await store.claimReward(r, pourProche));
    });

  const submitWish = (e) => {
    e.preventDefault();
    garde(qui, () => envoyerWish());
  };
  const envoyerWish = async () => {
    const err = await store.claimCustom(wish, pourProche);
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

      {proches.length > 0 && (
        <div className="qui-vue" role="group" aria-label={t('proches.pourQui')}>
          {[userId, ...proches.map((p) => p.id)].map((id) => (
            <button
              key={id}
              type="button"
              className="qui-choix"
              aria-pressed={id === qui}
              onClick={() => setQui(id)}
            >
              {id === userId ? store.names[userId] || t('proches.moi') : noms[id]}
            </button>
          ))}
        </div>
      )}

      {/* Sur ordinateur : deux colonnes, le classement à gauche, les
          récompenses à droite. Sur téléphone, l'une sous l'autre. */}
      <div className="brain-cols">
      <div className="brain-col">
      {famille ? (
        <section className="classement" aria-label={t('famille.classement')}>
          <h2 className="setlabel">{t('famille.classement')}</h2>
          <ol>
            {rangs.map((l) => (
              <li key={l.id} className={l.id === qui ? 'moi' : ''}>
                <span className="classement-rang" aria-label={`#${l.rang}`}>
                  {MEDAILLES[l.rang - 1] || l.rang}
                </span>
                <span className="classement-vase">
                  <Brain {...jaugeDe(l.points)} />
                </span>
                <span className="classement-nom">
                  {nomDe(l.id)}
                  {l.id === qui && noms[qui] ? (
                    <span className="classement-toi"> · {t('cerveau.toi')}</span>
                  ) : null}
                </span>
                <span className="pts">
                  <b>{formatPoints(l.points)}</b> {t('cerveau.pts')}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
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
      )}

      <p className="detail-line">
        {t(famille ? 'cerveau.detailFamille' : 'cerveau.detail', {
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
            <span>{t(famille ? 'cerveau.baremeAutreFamille' : 'cerveau.baremeAutre')}</span>
            <b>{formatPoints(POINT_OTHER)} pts</b>
          </div>
          <div className="rowline">
            <span>{t('cerveau.baremeCombo')}</span>
            <b>+{formatPoints(COMBO_BONUS)} pt</b>
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

      </div>
      <div className="brain-col">
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
                    onClick={() => prendre(r)}
                  >
                    {t('recompenses.prendre')}
                  </button>
                </li>
              );
            })}
          </ul>
          </Defilant>
        )}

        {store.couple && store.couple.code && familleTot && !pourProche && (
          <section className="couple-bloc">
            <h3 className="couple-titre">
              <span aria-hidden="true">{coupleOuvert ? '🔓' : '🔒'}</span> {t('couple.titre')}
            </h3>
            {coupleOuvert ? (
              <ul className="gage-list">
                {recompensesCouple.map((r) => {
                  const ok = myPts >= r.cost;
                  return (
                    <li key={r.id} className={`reward ${ok ? 'ok' : ''}`}>
                      <span className="reward-cost">{formatPoints(r.cost)}</span>
                      <span className="reward-label">{libelleRecompense(r)}</span>
                      <button className="btn btn-small btn-accent" type="button" disabled={!ok} onClick={() => prendre(r)}>
                        {t('recompenses.prendre')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                <p className="setnote">{t('couple.aide')}</p>
                <button className="btn btn-block" type="button" onClick={ouvrirCouple}>
                  {t('couple.ouvrir')}
                </button>
              </>
            )}
          </section>
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

      </div>
      </div>

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
                autre={c.pour ? nomDe(c.pour) : otherName}
                choix={autresMembres}
                onUtiliser={(pour) => garde(qui, () => store.useClaim(c.id, pour || null, idsProches.has(pour)))}
                onAnnuler={() => garde(qui, () => store.annulerAchat(c.id))}
                onValider={() => garde(qui, () => store.validerBon(c.id))}
              />
            ))}
          </div>
        )}
      </section>

      {demande && (
        <CodeOperateur
          titre={demande.titre}
          onValider={async (code) => {
            const r = await demande.valider(code);
            if (!r) setDemande(null);
            return r;
          }}
          onFermer={() => setDemande(null)}
        />
      )}
    </main>
  );
}
