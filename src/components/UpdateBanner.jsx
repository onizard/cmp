import { useEffect, useState } from 'react';
import { initUpdates, applyUpdate } from '../lib/updates.js';
import { useT } from '../i18n/index.js';

export default function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const t = useT();

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
      <span>{t('maj.prete')}</span>
      <button type="button" onClick={applyUpdate}>
        {t('maj.bouton')}
      </button>
    </div>
  );
}
