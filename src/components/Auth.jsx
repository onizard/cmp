import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Header from './Header.jsx';
import InstallHint from './InstallHint.jsx';
import { dejaVenu } from '../lib/account.js';

// Trois écrans, un seul à la fois : se connecter, créer un compte, ou se
// faire renvoyer un lien quand le mot de passe est perdu. Un appareil qui n'a
// jamais servi ouvre sur la création : qui a déjà un compte est en général
// déjà connecté.
export default function Auth({ account }) {
  const t = useT();
  const [mode, setMode] = useState(() => (dejaVenu() ? 'connexion' : 'creation'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const creation = mode === 'creation';
  const oubli = mode === 'oubli';

  const go = (next) => {
    setMode(next);
    setSent(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (oubli) {
      if (await account.sendMagicLink(email)) setSent(true);
    } else if (creation) {
      // Compte existant et mauvais mot de passe : on bascule sur la connexion,
      // l'e-mail déjà rempli.
      if ((await account.signUp(email, password)) === 'dejaInscrit') setMode('connexion');
    } else {
      await account.signIn(email, password);
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <div className="screen">
        <Header />
        <div className="panel">
          <p className="lede">{t('auth.lienEnvoye')}</p>
          <p className="soft-text">
{t('auth.lienEnvoyeAide', { email })}
          </p>
          <button className="btn btn-block" type="button" onClick={() => go('connexion')}>
            {t('app.revenir')}
          </button>
        </div>
        <InstallHint />
      </div>
    );
  }

  return (
    <div className="screen">
      <Header />
      <InstallHint />
      <form className="panel" onSubmit={submit}>
        <p className="lede">
          {creation ? t('auth.creation') : oubli ? t('auth.oubli') : t('auth.connexion')}
        </p>
        <p className="soft-text">
          {creation
            ? t('auth.creationAide')
            : oubli
              ? t('auth.oubliAide')
              : t('auth.connexionAide')}
        </p>

        <label className="field-label" htmlFor="email">{t('auth.email')}</label>
        <input
          id="email"
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
        />

        {!oubli && (
          <>
            <label className="field-label" htmlFor="pass">{t('auth.motDePasse')}</label>
            <input
              id="pass"
              className="field"
              type="password"
              autoComplete={creation ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.motDePassePlaceholder')}
            />
          </>
        )}

        {account.error && <p className="error">{account.error}</p>}

        <button className="btn btn-accent btn-block" type="submit" disabled={busy}>
          {busy
            ? t('app.instant')
            : creation
              ? t('auth.creerMonCompte')
              : oubli
                ? t('auth.recevoirLien')
                : t('auth.seConnecter')}
        </button>

        <p className="authlinks">
          {mode === 'connexion' ? (
            <>
              <button type="button" onClick={() => go('oubli')}>
                {t('auth.oublieLien')}
              </button>
              <span aria-hidden="true"> · </span>
              <button type="button" onClick={() => go('creation')}>
                {t('auth.creerLien')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => go('connexion')}>
              {creation ? t('auth.dejaUnCompte') : t('auth.retourConnexion')}
            </button>
          )}
        </p>
      </form>
    </div>
  );
}
