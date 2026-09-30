// Installer l'application sur l'écran d'accueil.
//
// Deux mondes séparés :
//  - Android/Chrome envoie un événement `beforeinstallprompt` qu'on garde
//    sous le coude pour offrir un vrai bouton « Installer » ;
//  - iOS n'a rien de tout cela. Aucun site ne peut s'installer tout seul :
//    il faut passer par le menu Partager. On explique donc le geste.
import { estNatif } from './natif.js';
import { useEffect, useState } from 'react';

const ua = () =>
  (typeof navigator !== 'undefined' && navigator.userAgent) || '';

/** Déjà posée sur l'écran d'accueil ? */
export const isStandalone = () => {
  // L'appli des stores est, par définition, déjà installée.
  if (estNatif) return true;
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
  // Les navigateurs intégrés aux messageries : c'est le vrai piège. Ils n'ont
  // pas du tout l'entrée « Sur l'écran d'accueil », il faut d'abord en sortir.
  if (/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|LinkedInApp|Twitter|Pinterest|GSA\//i.test(s)) {
    return 'integre';
  }
  if (/CriOS/i.test(s)) return 'chrome';
  if (/FxiOS/i.test(s)) return 'firefox';
  if (/EdgiOS/i.test(s)) return 'edge';
  return 'safari';
};

/** Le nom de l'application dans laquelle la page est coincée, si on le sait. */
export const appHote = () => {
  const s = ua();
  if (/WhatsApp/i.test(s)) return 'WhatsApp';
  if (/Instagram/i.test(s)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(s)) return 'Facebook';
  if (/Snapchat/i.test(s)) return 'Snapchat';
  if (/LinkedInApp/i.test(s)) return 'LinkedIn';
  if (/Twitter/i.test(s)) return 'X';
  return null;
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

  return {
    mode,
    install,
    navigateur: isIOS() ? iosBrowser() : null,
    hote: appHote(),
  };
}
