// Cœur-cerveau qui se remplit comme un vase. `fill` ∈ [0,1].
// Dégradé corail → violet → bleu, contour bleu nuit.

const HEART =
  'M50,80 C50,80 10,53 10,29 C10,15 22,8 32,13 C41,17 46,24 50,31 ' +
  'C54,24 59,17 68,13 C78,8 90,15 90,29 C90,53 50,80 50,80 Z';

export default function Brain({ fill = 0, id = 'b' }) {
  const clamped = Math.max(0, Math.min(1, fill));
  const y = 80 - 70 * clamped; // le liquide monte depuis le bas

  return (
    <svg
      className="brain-svg"
      viewBox="0 0 100 92"
      role="img"
      aria-label={`Rempli à ${Math.round(clamped * 100)} %`}
    >
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f0919c" />
          <stop offset="0.5" stopColor="#b486cc" />
          <stop offset="1" stopColor="#8b9de6" />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <path d={HEART} />
        </clipPath>
      </defs>

      <path d={HEART} fill="#f4eadd" />
      <g clipPath={`url(#clip-${id})`}>
        <rect
          className="brain-liquid"
          x="0"
          y={y}
          width="100"
          height="92"
          fill={`url(#grad-${id})`}
        />
      </g>
      <path
        d="M50,31 C50,45 50,60 50,78"
        fill="none"
        stroke="#17284c"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d={HEART} fill="none" stroke="#17284c" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
