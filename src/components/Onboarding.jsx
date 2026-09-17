import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Header from './Header.jsx';

export default function Onboarding({ account }) {
  const t = useT();
  // Un code reçu par lien arrive déjà rempli : il n'y a plus qu'à confirmer.
  const [code, setCode] = useState(account.invitation || '');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    await account.createHousehold();
    setBusy(false);
  };

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    await account.joinHousehold(code);
    setBusy(false);
  };

  return (
    <div className="screen">
      <Header />
      <div className="panel">
        <p className="lede">{t('foyer.rejoindre')}</p>
        <p className="soft-text">
          {account.invitation ? t('foyer.inviteReconnue') : t('foyer.rejoindreAide')}
        </p>
        <form onSubmit={join}>
          <label className="field-label" htmlFor="code">
            {t('foyer.code')}
          </label>
          <input
            id="code"
            className="field"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('foyer.codePlaceholder')}
          />
          {account.error && <p className="error">{account.error}</p>}
          <button className="btn btn-accent" type="submit" disabled={busy}>
            {busy ? t('app.instant') : t('foyer.bouton')}
          </button>
        </form>
      </div>

      <div className="panel">
        <p className="soft-text">
          {t('foyer.premiereFois')}
        </p>
        <button className="btn" type="button" onClick={create} disabled={busy}>
          {t('foyer.creer')}
        </button>
      </div>

      <p className="signout-line">
        <button className="link" type="button" onClick={account.signOut}>
          {t('auth.deconnexion')}
        </button>
      </p>
    </div>
  );
}
