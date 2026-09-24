import { useMemo, useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import { bilan, graduations } from '../lib/bilan.js';
import { formatPoints } from '../lib/gamify.js';
import { monthKey } from '../lib/visibility.js';

/**
 * Le bilan : ses propres chiffres, et seulement les siens.
 *
 * Un grand nombre d'abord — tout ce qu'on a gagné depuis le début, même ce qui
 * a été dépensé —, quatre tuiles, puis les tâches mois par mois. Le graphique
 * a son double en tableau : aucune valeur ne dépend de la couleur ni d'un doigt
 * posé au bon endroit.
 */

// Le nom court d'un mois, grégorien imposé (voir nomDuMois).
const moisCourt = (cle, lang) => {
  const [a, m] = cle.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(`${lang}-u-ca-gregory`, { month: 'short' }).format(new Date(a, m - 1, 1));
  } catch {
    return String(m);
  }
};
const moisLong = (cle, lang) => {
  const [a, m] = cle.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(`${lang}-u-ca-gregory`, { month: 'long', year: 'numeric' }).format(new Date(a, m - 1, 1));
  } catch {
    return cle;
  }
};

// Géométrie du graphique, en unités du viewBox : il s'étire ensuite à la
// largeur de l'écran.
const L = 320;
const H = 176;
const G = 26; // place des graduations, à gauche
const HAUT = 10;
const BAS = 24; // place des mois, en bas
const DROITE = 4;

// Une colonne : arrondie de 4 en haut, carrée sur la ligne de base.
const colonne = (x, y, w, h) => {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

function Graphique({ mois, t, lang }) {
  const [actif, setActif] = useState(null);
  const max = Math.max(1, ...mois.flatMap((m) => [m.creees, m.realisees]));
  const ticks = graduations(max);
  const haut = ticks[ticks.length - 1];
  const plotH = H - HAUT - BAS;
  const y = (v) => HAUT + plotH - (v / haut) * plotH;
  const bande = (L - G - DROITE) / mois.length;
  const w = Math.min(18, (bande - 14) / 2); // jamais plus de 18 : l'air reste de l'air
  const series = [
    { cle: 'creees', nom: t('bilan.creees'), var: 'var(--serie-1)' },
    { cle: 'realisees', nom: t('bilan.realisees'), var: 'var(--serie-2)' },
  ];

  const bulle = actif !== null && mois[actif];
  const cx = actif !== null ? G + bande * actif + bande / 2 : 0;
  const ancre = cx / L < 0.25 ? '0%' : cx / L > 0.75 ? '-100%' : '-50%';

  return (
    <div className="bilan-graph" dir="ltr" onPointerLeave={() => setActif(null)}>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={t('bilan.parMois')}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={G} x2={L - DROITE} y1={y(v)} y2={y(v)} className="bilan-grille" />
            <text x={G - 6} y={y(v) + 3.5} className="bilan-tick" textAnchor="end">{v}</text>
          </g>
        ))}
        {mois.map((m, i) => {
          const x0 = G + bande * i + bande / 2 - w - 1; // 2 de jour entre les deux colonnes
          return (
            <g key={m.mois} className={actif !== null && actif !== i ? 'bilan-eteint' : ''}>
              {series.map((s, k) => (
                <path key={s.cle} d={colonne(x0 + k * (w + 2), y(m[s.cle]), w, y(0) - y(m[s.cle]))} fill={s.var} />
              ))}
              <text x={G + bande * i + bande / 2} y={H - 7} className="bilan-mois" textAnchor="middle">
                {moisCourt(m.mois, lang)}
              </text>
              {/* La cible du doigt : toute la bande du mois, pas deux fines colonnes. */}
              <rect
                x={G + bande * i}
                y={0}
                width={bande}
                height={H}
                className="bilan-cible"
                tabIndex={0}
                aria-label={`${moisLong(m.mois, lang)} : ${s0(series, m)}`}
                onPointerEnter={() => setActif(i)}
                onPointerDown={() => setActif(actif === i ? null : i)}
                onFocus={() => setActif(i)}
                onBlur={() => setActif(null)}
              />
            </g>
          );
        })}
      </svg>
      {bulle && (
        <div className="bilan-bulle" style={{ left: `${(cx / L) * 100}%`, transform: `translateX(${ancre})` }}>
          <div className="bilan-bulle-titre">{moisLong(bulle.mois, lang)}</div>
          {series.map((s) => (
            <div key={s.cle} className="bilan-bulle-ligne">
              <i style={{ background: s.var }} />
              <b>{bulle[s.cle]}</b>
              <span>{s.nom}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Le texte lu par un lecteur d'écran pour un mois.
const s0 = (series, m) => series.map((s) => `${s.nom} ${m[s.cle]}`).join(', ');

export default function BilanView({ tasks, claims, userId }) {
  const t = useT();
  const lang = langue();
  const [tableau, setTableau] = useState(false);
  const b = useMemo(() => bilan(tasks, claims, userId, monthKey()), [tasks, claims, userId]);
  const rien = b.creees === 0 && b.realisees === 0;

  return (
    <main className="bilan">
      <section className="bilan-hero">
        <p className="bilan-hero-nom">{t('bilan.cumules')}</p>
        <p className="bilan-hero-valeur">
          {formatPoints(b.cumules)} <small>{t('cerveau.pts')}</small>
        </p>
        {b.bonus > 0 && <p className="bilan-hero-note">{t('bilan.dontCombos', { n: formatPoints(b.bonus) })}</p>}
      </section>

      <section className="bilan-tuiles">
        <div className="bilan-tuile"><span>{t('bilan.depenses')}</span><b>{formatPoints(b.depenses)}</b></div>
        <div className="bilan-tuile"><span>{t('bilan.disponibles')}</span><b>{formatPoints(b.disponibles)}</b></div>
        <div className="bilan-tuile"><span>{t('bilan.totalRealisees')}</span><b>{b.realisees}</b></div>
        <div className="bilan-tuile"><span>{t('bilan.totalCreees')}</span><b>{b.creees}</b></div>
      </section>

      <figure className="bilan-carte">
        <figcaption className="bilan-titre">{t('bilan.parMois')}</figcaption>
        {rien ? (
          <p className="bilan-vide">{t('bilan.vide')}</p>
        ) : (
          <>
            <div className="bilan-legende">
              <span><i style={{ background: 'var(--serie-1)' }} />{t('bilan.creees')}</span>
              <span><i style={{ background: 'var(--serie-2)' }} />{t('bilan.realisees')}</span>
            </div>
            {tableau ? (
              <table className="bilan-table">
                <thead>
                  <tr><th>{t('bilan.mois')}</th><th>{t('bilan.creees')}</th><th>{t('bilan.realisees')}</th></tr>
                </thead>
                <tbody>
                  {[...b.mois].reverse().map((m) => (
                    <tr key={m.mois}><td>{moisLong(m.mois, lang)}</td><td>{m.creees}</td><td>{m.realisees}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Graphique mois={b.mois} t={t} lang={lang} />
            )}
            <button type="button" className="link bilan-bascule" onClick={() => setTableau((v) => !v)}>
              {tableau ? t('bilan.voirGraphique') : t('bilan.voirTableau')}
            </button>
          </>
        )}
      </figure>
    </main>
  );
}
