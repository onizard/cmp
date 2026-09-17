import { LANGUES, langue, definirLangue, useT } from '../i18n/index.js';

/** Choix de la langue. Le changement est immédiat, rien à recharger. */
export default function LangPicker() {
  const t = useT();
  const courante = langue();
  // La langue active passe en dernier, seule sur sa ligne. Aucune langue
  // n'occupe donc durablement la première place : celle qu'on choisit quitte
  // la grille, et celle qui la remplace n'est pas mise en avant pour autant.
  const ordre = [
    ...LANGUES.filter((l) => l.code !== courante),
    ...LANGUES.filter((l) => l.code === courante),
  ];
  return (
    <section className="setgroup">
      <h2 className="setlabel">{t('compte.langue')}</h2>
      <div className="setcard">
        <div className="langues">
          {ordre.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              dir={l.dir}
              aria-pressed={l.code === courante}
              className={`langue ${l.code === courante ? 'actif' : ''}`}
              onClick={() => definirLangue(l.code)}
            >
              {l.nom}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
