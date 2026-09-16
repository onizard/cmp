// Mise à jour de l'application sans intervention.
//
// • on interroge le serveur toutes les minutes pendant que l'appli est ouverte
// • quand une nouvelle version est prête et qu'on revient sur l'appli, elle
//   s'applique toute seule (moment sûr : personne n'est en train de saisir)
// • sinon un bandeau propose de l'appliquer tout de suite

import { registerSW } from 'virtual:pwa-register';

const CHECK_MS = 60_000;

let applyFn = () => {};
let pending = false;

/** Démarre la surveillance. `onAvailable(true)` quand une version attend. */
export function initUpdates(onAvailable) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pending = true;
      onAvailable(true);
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        reg.update().catch(() => {});
      };
      setInterval(check, CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        // De retour sur l'appli : si une version attend, on l'applique ;
        // sinon on en profite pour vérifier.
        if (pending) applyFn();
        else check();
      });
    },
  });
  applyFn = () => {
    pending = false;
    updateSW(true); // active la nouvelle version et recharge
  };
}

/** Applique la mise à jour en attente (bouton du bandeau). */
export const applyUpdate = () => applyFn();
