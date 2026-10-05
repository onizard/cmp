import { useCallback, useEffect, useRef, useState } from 'react';

// Appui long, puis on glisse la tâche : au-dessus ou au-dessous de ses
// voisines, ou dans une autre catégorie.
//
// Une seconde d'appui sans bouger (la ligne se remplit doucement pour dire
// « continue ») : la tâche se soulève et suit le doigt. Bouger avant, c'est
// faire défiler la page ; lâcher avant, c'est un toucher ordinaire. Près du
// haut ou du bas de l'écran, la page défile toute seule. Échap annule.
//
// Le repérage se fait sur le document : chaque section porte
// data-section (sa clé, '' pour « sans catégorie »), chaque tâche
// data-tache. La cible est { section, index }, l'index comptant les tâches
// de la section SANS celle qu'on déplace.

export const APPUI_MS = 1000;
const TOLERANCE = 10; // px : au-delà, c'est un défilement, pas un appui
const BORD = 90; // px : zone de défilement automatique, en haut et en bas
const VITESSE = 14; // px par image

const tachesDe = (section, sauf) =>
  [...section.querySelectorAll(':scope [data-tache]')].filter(
    (li) => li.dataset.tache !== sauf && li.closest('[data-section]') === section,
  );

export function cibleAuPoint(x, y, sauf) {
  const el = typeof document !== 'undefined' ? document.elementFromPoint(x, y) : null;
  if (!el) return null;
  const section = el.closest('[data-section]');
  if (!section) return null;
  const lignes = tachesDe(section, sauf);
  const li = el.closest('[data-tache]');
  if (li && li.dataset.tache !== sauf && lignes.includes(li)) {
    const r = li.getBoundingClientRect();
    const i = lignes.indexOf(li);
    return { section: section.dataset.section, index: y > r.top + r.height / 2 ? i + 1 : i };
  }
  // Sur l'en-tête ou le vide d'une section : on dépose à la fin.
  return { section: section.dataset.section, index: lignes.length };
}

export default function useGlisser({ onDeposer, actif = true }) {
  const [appui, setAppui] = useState(null); // id de la tâche qui se charge
  const [glisse, setGlisse] = useState(null); // { id, dy }
  const [cible, setCible] = useState(null);
  const etat = useRef(null);
  const clicMange = useRef(false);
  const zone = useRef(null);

  const nettoyer = useCallback(() => {
    const e = etat.current;
    if (e) {
      clearTimeout(e.minuteur);
      cancelAnimationFrame(e.defile);
      window.removeEventListener('pointermove', e.bouger);
      window.removeEventListener('pointerup', e.lacher);
      window.removeEventListener('pointercancel', e.annuler);
      window.removeEventListener('keydown', e.touche);
    }
    etat.current = null;
    document.body.classList.remove('glisse-en-cours');
    setAppui(null);
    setGlisse(null);
    setCible(null);
  }, []);

  useEffect(() => nettoyer, [nettoyer]);

  // Pendant qu'on glisse, le doigt ne fait pas défiler la page. L'écouteur
  // est posé une fois pour toutes, non passif : le navigateur doit le
  // connaître dès le début du toucher pour qu'on puisse bloquer le défilement.
  useEffect(() => {
    const el = zone.current;
    if (!el) return undefined;
    const bloquer = (e) => {
      if (etat.current && etat.current.parti) e.preventDefault();
    };
    el.addEventListener('touchmove', bloquer, { passive: false });
    return () => el.removeEventListener('touchmove', bloquer);
  }, []);

  const debut = useCallback(
    (e, id) => {
      if (!actif || etat.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Seulement depuis la ligne de la tâche, pas depuis son menu ouvert.
      if (!e.target.closest('.task-row') || e.target.closest('input, textarea, form')) return;
      const e0 = {
        id,
        x: e.clientX,
        y: e.clientY,
        scroll: window.scrollY,
        parti: false,
        dernierY: e.clientY,
        dernierX: e.clientX,
      };
      const placer = () => {
        const dy = e0.dernierY - e0.y + (window.scrollY - e0.scroll);
        setGlisse({ id, dy });
        const c = cibleAuPoint(e0.dernierX, e0.dernierY, id);
        if (c) setCible(c);
      };
      e0.bouger = (ev) => {
        e0.dernierX = ev.clientX;
        e0.dernierY = ev.clientY;
        if (!e0.parti) {
          if (Math.hypot(ev.clientX - e0.x, ev.clientY - e0.y) > TOLERANCE) nettoyer();
          return;
        }
        placer();
      };
      e0.lacher = () => {
        const fini = etat.current;
        if (fini && fini.parti) {
          clicMange.current = true;
          setTimeout(() => {
            clicMange.current = false;
          }, 400);
          const c = cibleAuPoint(fini.dernierX, fini.dernierY, id);
          if (c) onDeposer(id, c.section, c.index);
        }
        nettoyer();
      };
      e0.annuler = () => nettoyer();
      e0.touche = (ev) => {
        if (ev.key === 'Escape') nettoyer();
      };
      e0.minuteur = setTimeout(() => {
        e0.parti = true;
        setAppui(null);
        document.body.classList.add('glisse-en-cours');
        navigator.vibrate?.(25);
        placer();
        // Défilement automatique près des bords.
        const pas = () => {
          if (!etat.current) return;
          const h = window.innerHeight;
          let v = 0;
          if (e0.dernierY < BORD) v = -VITESSE;
          else if (e0.dernierY > h - BORD) v = VITESSE;
          if (v) {
            window.scrollBy(0, v);
            placer();
          }
          e0.defile = requestAnimationFrame(pas);
        };
        e0.defile = requestAnimationFrame(pas);
      }, APPUI_MS);
      etat.current = e0;
      setAppui(id);
      window.addEventListener('pointermove', e0.bouger);
      window.addEventListener('pointerup', e0.lacher);
      window.addEventListener('pointercancel', e0.annuler);
      window.addEventListener('keydown', e0.touche);
    },
    [actif, nettoyer, onDeposer],
  );

  /** Les attributs à poser sur la ligne d'une tâche déplaçable. */
  const surTache = (id) => ({
    onPointerDown: (e) => debut(e, id),
    // Un appui long ne doit ni ouvrir le menu du téléphone, ni, au lâcher,
    // ouvrir celui de la tâche.
    onContextMenu: (e) => {
      if (etat.current) e.preventDefault();
    },
    onClickCapture: (e) => {
      if (clicMange.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  });

  return { zone, appui, glisse, cible, surTache };
}
