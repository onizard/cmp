import { useEffect, useState } from 'react';
import { part, nombre, courbe, total } from '../lib/stats.js';
import { useT } from '../i18n/index.js';

function Tuile({ valeur, libelle, detail, onClick, ouvert }) {
  if (onClick) {
    return (
      <button
        type="button"
        className={`stat stat-clic ${ouvert ? 'ouvert' : ''}`}
        aria-expanded={ouvert}
        onClick={onClick}
      >
        <div className="stat-val">{nombre(valeur)}</div>
        <div className="stat-lab">{libelle}</div>
        {detail && <div className="stat-det">{detail}</div>}
      </button>
    );
  }
  return (
    <div className="stat">
      <div className="stat-val">{nombre(valeur)}</div>
      <div className="stat-lab">{libelle}</div>
      {detail && <div className="stat-det">{detail}</div>}
    </div>
  );
}

function Jauge({ libelle, n, total: t, aide }) {
  const pct = part(n, t);
  return (
    <div className="mesure">
      <div className="mesure-tete">
        <span>{libelle}</span>
        <b>{pct} %</b>
      </div>
      <div className="mesure-piste" role="img" aria-label={`${pct} %`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {aide && <p className="mesure-aide">{aide}</p>}
    </div>
  );
}

// Inscriptions par jour : une seule série, donc pas de légende — le titre la nomme.
function Courbe({ points }) {
  const t = useT();
  const W = 300;
  const H = 64;
  const { ligne, aire, max, n } = courbe(points, W, H);
  if (!n) return null;
  return (
    <section className="setgroup">
      <h2 className="setlabel">{t('admin.courbe')}</h2>
      <div className="setcard">
        <p className="courbe-tete">
          {t('admin.courbeTete', { n: nombre(total(points)), max })}
        </p>
        <svg
          className="courbe"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('admin.courbe')}
        >
          <polygon points={aire} className="courbe-aire" />
          <polyline points={ligne} className="courbe-ligne" />
        </svg>
        <p className="courbe-pied">
          <span>{t('admin.ilYa30')}</span>
          <span>{t('admin.aujourdhui')}</span>
        </p>
      </div>
    </section>
  );
}

// Date courte, dans la langue en cours.
const jour = (iso) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

export default function AdminView({ admin }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const { stats, loading, error, refresh } = admin;

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <main className="account">
        <p className="brain-lede">{t('admin.titre')}</p>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="account">
        <p className="brain-lede">{t('admin.titre')}</p>
        <p className="notice">{loading ? t('app.instant') : t('admin.rien')}</p>
      </main>
    );
  }

  const s = stats;

  return (
    <main className="account">
      <p className="brain-lede">{t('admin.titre')}</p>

      <section className="setgroup">
        <h2 className="setlabel">{t('admin.gens')}</h2>
        <div className="stats">
          <Tuile valeur={s.comptes} libelle={t('admin.comptes')} detail={t('admin.cetteSemaine', { n: s.comptes_7j })} />
          <Tuile valeur={s.actifs_7j} libelle={t('admin.actifs7')} detail={t('admin.sur30', { n: s.actifs_30j })} />
          <Tuile
            valeur={s.foyers}
            libelle={t('admin.foyers')}
            detail={t('admin.aDeux', { n: s.foyers_a_deux })}
            ouvert={ouvert}
            onClick={() => {
              setOuvert((v) => !v);
              if (!admin.foyers) admin.chargerFoyers();
            }}
          />
          <Tuile valeur={s.notifs} libelle={t('admin.notifs')} detail={t('admin.appareils')} />
        </div>
      </section>

      {ouvert && (
        <section className="setgroup">
          <h2 className="setlabel">{t('admin.foyersDetail')}</h2>
          {!admin.foyers ? (
            <p className="notice">{t('app.instant')}</p>
          ) : admin.foyers.length === 0 ? (
            <p className="notice">{t('admin.rien')}</p>
          ) : (
            <div className="foyers">
              {admin.foyers.map((f) => (
                <div className="foyer" key={f.id}>
                  <p className="foyer-tete">
                    <b>{t('admin.membresN', { n: f.membres })}</b>
                    <span>
                      {t('admin.tachesN', { n: f.taches })} ·{' '}
                      {t('admin.restantesN', { n: f.restantes })}
                    </span>
                  </p>
                  <ul className="foyer-gens">
                    {f.gens.map((g) => (
                      <li key={g.email}>
                        <b>{g.prenom || t('admin.sansPrenom')}</b>
                        <span className="foyer-mail">{g.email}</span>
                        <span className="foyer-vu">
                          {g.vu
                            ? t('admin.vuLe', { quand: jour(g.vu) })
                            : t('admin.jamaisVenu')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="foyer-code">{f.id}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="setgroup">
        <h2 className="setlabel">{t('admin.usage')}</h2>
        <div className="setcard">
          <Jauge
            libelle={t('admin.activation')}
            n={s.actives}
            total={s.comptes}
            aide={t('admin.activationAide')}
          />
          <Jauge
            libelle={t('admin.retour')}
            n={s.actifs_7j}
            total={s.comptes}
            aide={t('admin.retourAide')}
          />
          <Jauge
            libelle={t('admin.foyersADeux')}
            n={s.foyers_a_deux}
            total={s.foyers}
            aide={t('admin.foyersADeuxAide')}
          />
          <Jauge
            libelle={t('admin.foyersActifs')}
            n={s.foyers_actifs}
            total={s.foyers}
          />
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">{t('admin.quoi')}</h2>
        <div className="stats">
          <Tuile valeur={s.taches} libelle={t('admin.taches')} detail={t('admin.cetteSemaine', { n: s.taches_7j })} />
          <Tuile valeur={s.cochees_7j} libelle={t('admin.cochees')} />
          <Tuile valeur={s.echeances} libelle={t('admin.echeances')} />
          <Tuile valeur={s.recompenses} libelle={t('admin.recompenses')} />
        </div>
      </section>

      <Courbe points={s.courbe} />

      <button className="btn btn-block" type="button" onClick={refresh} disabled={loading}>
        {loading ? t('admin.actualisation') : t('admin.actualiser')}
      </button>

      <p className="miniquit">{t('admin.agrege')}</p>
    </main>
  );
}
