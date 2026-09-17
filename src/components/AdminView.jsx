import { useEffect } from 'react';
import { part, nombre, courbe, total } from '../lib/stats.js';

function Tuile({ valeur, libelle, detail }) {
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
  const W = 300;
  const H = 64;
  const { ligne, aire, max, n } = courbe(points, W, H);
  if (!n) return null;
  return (
    <section className="setgroup">
      <h2 className="setlabel">Inscriptions · 30 derniers jours</h2>
      <div className="setcard">
        <p className="courbe-tete">
          <b>{nombre(total(points))}</b> comptes créés · pointe à {max} par jour
        </p>
        <svg
          className="courbe"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Inscriptions quotidiennes, ${total(points)} au total`}
        >
          <polygon points={aire} className="courbe-aire" />
          <polyline points={ligne} className="courbe-ligne" />
        </svg>
        <p className="courbe-pied">
          <span>il y a 30 j</span>
          <span>aujourd’hui</span>
        </p>
      </div>
    </section>
  );
}

export default function AdminView({ admin }) {
  const { stats, loading, error, refresh } = admin;

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <main className="account">
        <p className="brain-lede">Tableau de bord</p>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="account">
        <p className="brain-lede">Tableau de bord</p>
        <p className="notice">{loading ? 'Un instant…' : 'Rien à afficher.'}</p>
      </main>
    );
  }

  const s = stats;

  return (
    <main className="account">
      <p className="brain-lede">Tableau de bord</p>

      <section className="setgroup">
        <h2 className="setlabel">Les gens</h2>
        <div className="stats">
          <Tuile valeur={s.comptes} libelle="comptes" detail={`+${s.comptes_7j} cette semaine`} />
          <Tuile valeur={s.actifs_7j} libelle="actifs 7 j" detail={`${s.actifs_30j} sur 30 j`} />
          <Tuile valeur={s.foyers} libelle="foyers" detail={`${s.foyers_a_deux} à deux`} />
          <Tuile valeur={s.notifs} libelle="notifications" detail="appareils abonnés" />
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">L’usage</h2>
        <div className="setcard">
          <Jauge
            libelle="Comptes qui ont créé une tâche"
            n={s.actives}
            total={s.comptes}
            aide="Le vrai taux d’activation : combien vont au-delà de l’inscription."
          />
          <Jauge
            libelle="Comptes revenus dans les 7 jours"
            n={s.actifs_7j}
            total={s.comptes}
            aide="Ce chiffre-là dit si l’application tient dans la durée."
          />
          <Jauge
            libelle="Foyers à deux"
            n={s.foyers_a_deux}
            total={s.foyers}
            aide="Seul, l’intérêt de l’application s’effondre."
          />
          <Jauge
            libelle="Foyers actifs sur 30 jours"
            n={s.foyers_actifs}
            total={s.foyers}
          />
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">Ce qu’ils en font</h2>
        <div className="stats">
          <Tuile valeur={s.taches} libelle="tâches" detail={`+${s.taches_7j} cette semaine`} />
          <Tuile valeur={s.cochees_7j} libelle="cochées 7 j" />
          <Tuile valeur={s.echeances} libelle="échéances" />
          <Tuile valeur={s.recompenses} libelle="récompenses prises" />
        </div>
      </section>

      <Courbe points={s.courbe} />

      <button className="btn btn-block" type="button" onClick={refresh} disabled={loading}>
        {loading ? 'Actualisation…' : 'Actualiser'}
      </button>

      <p className="miniquit">
        Chiffres agrégés. Aucune tâche, aucun contenu de foyer n’est lisible ici.
      </p>
    </main>
  );
}
