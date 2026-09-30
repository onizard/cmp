// L'application tourne-t-elle dans l'appli des stores (Capacitor) ou dans un
// navigateur ?
//
// Dans l'appli native, la page n'est pas servie par le NAS : elle est
// embarquée dans l'appli (capacitor://localhost sur iPhone, https://localhost
// sur Android). Tout ce qui dépend de l'adresse du site — liens d'invitation,
// lien magique, API — doit donc viser l'adresse publique, pas l'origine de la
// page. Et ce qui n'a de sens que dans un navigateur (service worker, poser
// l'appli sur l'écran d'accueil) s'efface.
import { Capacitor } from '@capacitor/core';

export const estNatif = Capacitor.isNativePlatform();

/** 'ios', 'android' ou 'web'. */
export const plateforme = Capacitor.getPlatform();

/** L'adresse publique du site, sans barre finale. */
export const origineWeb = () => {
  if (estNatif) return String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
};
