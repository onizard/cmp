// Cerveau qui se remplit comme un vase. `fill` ∈ [0,1].
// Vide → quasi transparent ; plein → dégradé bleu (bas) vers rouge (haut), opaque.

const W = 200;
const H = 184;

// Contour du cerveau, calculé une fois : bosses arrondies (circonvolutions),
// creux au sommet (les deux hémisphères), base un peu plus étroite.
function brainOutline() {
  const cx = 100;
  const cy = 98;
  const rx = 80;
  const ry = 66;
  const bumps = 8;
  const steps = 220;
  const pts = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2; // 0 = sommet, sens horaire
    // circonvolutions : deux fréquences pour un rendu organique
    let wob = 8 * Math.sin(bumps * t) + 3 * Math.sin(3 * t + 1.2);
    // creux central au sommet → séparation des hémisphères
    const dTop = Math.min(t, Math.PI * 2 - t);
    wob -= 17 * Math.exp(-(dTop * dTop) / 0.05);
    // petite encoche en bas (cervelet)
    const dBot = Math.abs(t - Math.PI);
    wob -= 7 * Math.exp(-(dBot * dBot) / 0.06);
    // base légèrement plus étroite
    const xScale = 1 - 0.12 * ((1 - Math.cos(t)) / 2);
    const x = cx + Math.sin(t) * (rx + wob) * xScale;
    const y = cy - Math.cos(t) * (ry + wob);
    pts.push([x, y]);
  }
  // lissage : courbe quadratique passant par les milieux de segments
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let d = `M${f(mid(pts[pts.length - 1], pts[0]))}`;
  for (let i = 0; i < pts.length; i += 1) {
    const next = pts[(i + 1) % pts.length];
    d += ` Q${f(pts[i])} ${f(mid(pts[i], next))}`;
  }
  return `${d} Z`;
}

const OUTLINE = brainOutline();

// Quelques plis internes (traits décoratifs).
const FOLDS = [
  'M100,26 C96,60 104,90 100,158',
  'M100,60 C78,64 70,82 84,96',
  'M100,60 C122,64 130,82 116,96',
  'M100,110 C80,112 72,128 88,140',
  'M100,110 C120,112 128,128 112,140',
  'M62,58 C50,70 52,86 64,92',
  'M138,58 C150,70 148,86 136,92',
];

export default function Brain({ fill = 0 }) {
  const clamped = Math.max(0, Math.min(1, fill));
  const top = H * (1 - clamped); // le liquid monte depuis le bas
  const opacity = clamped === 0 ? 0 : 0.25 + 0.75 * clamped;

  return (
    <svg
      className="brain-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Cerveau rempli à ${Math.round(clamped * 100)} %`}
    >
      <defs>
        <linearGradient
          id="brainGrad"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={H}
          x2="0"
          y2="0"
        >
          <stop offset="0" stopColor="#2f6db0" />
          <stop offset="0.35" stopColor="#3fae8f" />
          <stop offset="0.6" stopColor="#e6b73e" />
          <stop offset="0.8" stopColor="#e07b39" />
          <stop offset="1" stopColor="#c23b30" />
        </linearGradient>
        <clipPath id="brainClip">
          <path d={OUTLINE} />
        </clipPath>
      </defs>

      {/* Remplissage, borné à la forme du cerveau */}
      <g clipPath="url(#brainClip)">
        <rect x="0" y="0" width={W} height={H} fill="var(--card)" />
        <rect
          className="brain-liquid"
          x="0"
          y={top}
          width={W}
          height={H}
          fill="url(#brainGrad)"
          opacity={opacity}
        />
      </g>

      {/* Plis + contour par-dessus */}
      <g
        fill="none"
        stroke="var(--ink)"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        {FOLDS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path
        d={OUTLINE}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
