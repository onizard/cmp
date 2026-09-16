// Installer l'application sur l'écran d'accueil.
//
// Deux mondes séparés :
//  - Android/Chrome envoie un événement `beforeinstallprompt` qu'on garde
//    sous le coude pour offrir un vrai bouton « Installer » ;
//  - iOS n'a rien de tout cela. Aucun site ne peut s'installer tout seul :
//    il faut passer par le menu Partager. On explique donc le geste.
import { useEffect, useState } from 'react';

const ua = () =>
  (typeof navigator !== 'undefined' && navigator.userAgent) || '';

/** Déjà posée sur l'écran d'accueil ? */
export const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
};

/** iPhone ou iPad (y compris l'iPad qui se fait passer pour un Mac). */
export const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  if (/iPhone|iPad|iPod/i.test(ua())) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

/** Sur iOS, quel navigateur ? Le geste n'est pas au même endroit. */
export const iosBrowser = () => {
  const s = ua();
  if (/CriOS/i.test(s)) return 'chrome';
  if (/FxiOS/i.test(s)) return 'firefox';
  if (/EdgiOS/i.test(s)) return 'edge';
  return 'safari';
};

/**
 * Donne l'état d'installation de l'appli :
 *   { mode: 'installed' | 'bouton' | 'ios' | 'aucun', install }
 * `install` ouvre la vraie boîte de dialogue quand elle existe.
 */
export function useInstall() {
  const [prompt, setPrompt] = useState(null);
  const [done, setDone] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setPrompt(null);
      setDone(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    return outcome === 'accepted';
  };

  let mode = 'aucun';
  if (done) mode = 'installed';
  else if (prompt) mode = 'bouton';
  else if (isIOS()) mode = 'ios';

  return { mode, install, navigateur: isIOS() ? iosBrowser() : null };
}
