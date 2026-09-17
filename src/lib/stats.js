// Mise en forme des statistiques du tableau de bord.

/** Part en pourcentage, arrondie, sans division par zéro. */
export const part = (n, total) => {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.round(((Number(n) || 0) * 100) / t);
};

/** Nombre à la française : 1 248 plutôt que 1248. */
export const nombre = (n) => {
  const v = Number(n) || 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Trace la courbe des inscriptions en coordonnées SVG.
 * Renvoie la ligne et l'aire fermée sous elle, plus le maximum affiché.
 */
export function courbe(points, w = 300, h = 64) {
  const série = Array.isArray(points) ? points : [];
  if (série.length === 0) return { ligne: '', aire: '', max: 0, n: 0 };

  // Un plancher à 1 évite qu'une série de zéros s'écrase sur l'axe.
  const max = Math.max(1, ...série.map((p) => Number(p.n) || 0));
  const pas = série.length > 1 ? w / (série.length - 1) : 0;
  const y = (v) => h - ((Number(v) || 0) / max) * h;

  const coords = série.map((p, i) => [
    Math.round(i * pas * 100) / 100,
    Math.round(y(p.n) * 100) / 100,
  ]);

  const ligne = coords.map(([x, yy]) => `${x},${yy}`).join(' ');
  const aire = `0,${h} ${ligne} ${coords[coords.length - 1][0]},${h}`;
  return { ligne, aire, max, n: série.length };
}

/** Total d'une série, pour l'intitulé de la courbe. */
export const total = (points) =>
  (Array.isArray(points) ? points : []).reduce((s, p) => s + (Number(p.n) || 0), 0);
