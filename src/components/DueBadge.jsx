import { dueLevel, dueLabel } from '../lib/deadline.js';

/** Le chronomètre du logo d'échéance, en trait, aux couleurs héritées. */
export function Chrono({ size = 13 }) {
  return (
    <svg
      className="chrono"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13.5" r="8" />
      <path d="M12 9.5v4l2.5 1.8" />
      <path d="M9.5 2h5" />
      <path d="M12 2v3.5" />
      <path d="M19 6l1.6-1.6" />
    </svg>
  );
}

/** Pastille « ⏱ dans 3 h », dont la couleur monte avec l'urgence. */
export default function DueBadge({ dueAt, done, now = Date.now() }) {
  const level = dueLevel(dueAt, now);
  if (!level) return null;
  // Une tâche faite ne réclame plus rien : la pastille se calme.
  const tone = done ? 'fait' : level;
  return (
    <span className={`due due-${tone}`}>
      <Chrono />
      {done ? 'fait' : dueLabel(dueAt, now)}
    </span>
  );
}
