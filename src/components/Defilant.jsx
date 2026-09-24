import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Une zone de hauteur bornée qui défile, sans barre visible.
 *
 * Sans barre, rien ne dit qu'il y a une suite : un bord s'estompe donc tant
 * qu'il reste du contenu de ce côté-là, et redevient net quand on y arrive.
 * Une liste assez courte pour tenir entière ne s'estompe nulle part.
 */
export default function Defilant({ label, className = '', children }) {
  const ref = useRef(null);
  const [bords, setBords] = useState({ haut: false, bas: false });

  const mesurer = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 2 px de marge : les arrondis de sous-pixel laisseraient sinon un fondu
    // résiduel au bout de la liste.
    const haut = el.scrollTop > 2;
    const bas = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setBords((b) => (b.haut === haut && b.bas === bas ? b : { haut, bas }));
  }, []);

  useEffect(() => {
    mesurer();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    // Le contenu change (langue, points, catalogue) : on remesure.
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    if (el.firstElementChild) obs.observe(el.firstElementChild);
    return () => obs.disconnect();
  }, [mesurer, children]);

  return (
    <div
      ref={ref}
      className={`defilant ${className}`}
      data-haut={bords.haut ? '1' : undefined}
      data-bas={bords.bas ? '1' : undefined}
      onScroll={mesurer}
      // Sans barre, il faut pouvoir y entrer au clavier pour la faire défiler.
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}
