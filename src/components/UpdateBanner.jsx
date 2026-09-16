import { useEffect, useState } from 'react';
import { initUpdates, applyUpdate } from '../lib/updates.js';

export default function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      initUpdates(setReady);
    } catch {
      /* pas de service worker (navigation privée, etc.) */
    }
  }, []);

  if (!ready) return null;

  return (
    <div className="update-bar" role="status">
      <span>Une nouvelle version est prête.</span>
      <button type="button" onClick={applyUpdate}>
        Mettre à jour
      </button>
    </div>
  );
}
