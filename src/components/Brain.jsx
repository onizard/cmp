// Le cœur-cerveau du logo, qui se remplit comme un vase.
// On réutilise le dessin réel : `heart-mask.png` donne la silhouette
// intérieure (elle borne le dégradé) et `heart-line.png` le tracé bleu nuit
// posé par-dessus. `fill` ∈ [0,1].

import { t } from '../i18n/index.js';

export default function Brain({ fill = 0, teinte = 0 }) {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return (
    <div
      className="brainmark"
      role="img"
      aria-label={t('cerveau.rempliA', { n: pct })}
    >
      <div className="brainmark-hollow" />
      <div
        className={`brainmark-liquid teinte-${teinte}`}
        style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
      />
      <img className="brainmark-line" src="/heart-line.png" alt="" />
    </div>
  );
}
