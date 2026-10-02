import { useEffect, useState } from 'react';
import { LANGUES, langue, definirLangue, useT } from '../i18n/index.js';

/**
 * Choix de la langue : un bouton qui montre la langue en cours ; il ouvre une
 * petite fenêtre avec toutes les langues. Le changement est immédiat, rien à
 * recharger, et la fenêtre se referme.
 */
export default function LangPicker() {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const courante = langue();
  const active = LANGUES.find((l) => l.code === courante) || LANGUES[0];

  // Échap referme, comme un toucher à côté.
  useEffect(() => {
    if (!ouvert) return undefined;
    const touche = (e) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [ouvert]);

  return (
    <>
      <button className="btn btn-block lang-bouton" type="button" onClick={() => setOuvert(true)}>
        <span aria-hidden="true">🌐</span> {t('compte.langue')} ·{' '}
        <span lang={active.code} dir={active.dir}>
          {active.nom}
        </span>
      </button>

      {ouvert && (
        <div
          className="code-voile"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lang-titre"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOuvert(false);
          }}
        >
          <div className="code-carte lang-carte">
            <h2 id="lang-titre" className="code-titre">
              {t('compte.langue')}
            </h2>
            <ul className="lang-liste">
              {LANGUES.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    lang={l.code}
                    dir={l.dir}
                    aria-pressed={l.code === courante}
                    className={`lang-choix ${l.code === courante ? 'actif' : ''}`}
                    onClick={() => {
                      definirLangue(l.code);
                      setOuvert(false);
                    }}
                  >
                    <span>{l.nom}</span>
                    {l.code === courante && <span aria-hidden="true">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn btn-block" type="button" onClick={() => setOuvert(false)}>
              {t('app.annuler')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
