// Le cœur-cerveau du logo, qui se remplit comme un vase.
// On réutilise le dessin réel : `heart-mask.png` donne la silhouette
// intérieure (elle borne le dégradé) et `heart-line.png` le tracé bleu nuit
// posé par-dessus. `fill` ∈ [0,1].

import { t } from '../i18n/index.js';
import { HAUTEUR_POUR_SURFACE } from '../lib/heartFill.js';

// `fill` est une part de SURFACE, pas de hauteur. Le bas du cœur étant une
// pointe, verser 10 % de hauteur ne colorerait rien : on convertit.
const hauteurPour = (part) => {
  const p = Math.max(0, Math.min(1, part)) * 100;
  const bas = Math.floor(p);
  const haut = Math.min(100, bas + 1);
  const entre = p - bas;
  return (
    HAUTEUR_POUR_SURFACE[bas] +
    (HAUTEUR_POUR_SURFACE[haut] - HAUTEUR_POUR_SURFACE[bas]) * entre
  );
};

export default function Brain({ fill = 0, teinte = 0 }) {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  const hauteur = hauteurPour(fill);
  return (
    <div
      className="brainmark"
      role="img"
      aria-label={t('cerveau.rempliA', { n: pct })}
    >
      <div className="brainmark-hollow" />
      <div
        className={`brainmark-liquid teinte-${teinte}`}
        style={{ clipPath: `inset(${100 - hauteur}% 0 0 0)` }}
      />
      <img className="brainmark-line" src="/heart-line.png" alt="" />
    </div>
  );
}
