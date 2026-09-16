import { useState } from 'react';
import Header from './Header.jsx';
import InstallHint from './InstallHint.jsx';

export default function Auth({ account }) {
  const [mode, setMode] = useState('connexion'); // connexion | creation | lien
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'lien') {
      const ok = await account.sendMagicLink(email);
      if (ok) setSent(true);
    } else if (mode === 'creation') {
      await account.signUp(email, password);
    } else {
      await account.signIn(email, password);
    }
    setBusy(false);
  };

  const go = (next) => {
    setMode(next);
    setSent(false);
  };

  if (sent) {
    return (
      <div className="screen">
        <Header />
        <div className="panel">
          <p className="lede">Regarde tes mails.</p>
          <p className="soft-text">
            On t'a envoyé un lien de connexion à <strong>{email}</strong>.
            Ouvre-le, puis pose-toi un mot de passe dans « Mon compte » : tu
            n'auras plus jamais à passer par ta boîte mail.
          </p>
          <button className="btn" type="button" onClick={() => go('connexion')}>
            Revenir
          </button>
        </div>
        <InstallHint />
      </div>
    );
  }

  const creation = mode === 'creation';
  const lien = mode === 'lien';

  return (
    <div className="screen">
      <Header />
      <form className="panel" onSubmit={submit}>
        <p className="lede">
          {creation ? 'Créer ton compte.' : lien ? 'Recevoir un lien.' : 'Se connecter.'}
        </p>
        <p className="soft-text">
          {creation
            ? 'Deux champs, et tu entres. Pas de mail à aller chercher.'
            : lien
              ? "Pour qui n'a pas encore de mot de passe."
              : 'Ton e-mail et ton mot de passe.'}
        </p>

        <label className="field-label" htmlFor="email">Ton adresse e-mail</label>
        <input
          id="email"
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom@exemple.fr"
        />

        {!lien && (
          <>
            <label className="field-label" htmlFor="pass">Ton mot de passe</label>
            <input
              id="pass"
              className="field"
              type="password"
              autoComplete={creation ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères au minimum"
            />
          </>
        )}

        {account.error && <p className="error">{account.error}</p>}

        <button className="btn btn-accent btn-block" type="submit" disabled={busy}>
          {busy
            ? 'Un instant…'
            : creation
              ? 'Créer mon compte'
              : lien
                ? 'Recevoir le lien'
                : 'Se connecter'}
        </button>

        <p className="authswitch">
          {creation ? (
            <>
              Déjà un compte ?{' '}
              <button type="button" onClick={() => go('connexion')}>
                Se connecter
              </button>
            </>
          ) : (
            <>
              Première fois ?{' '}
              <button type="button" onClick={() => go('creation')}>
                Créer un compte
              </button>
            </>
          )}
        </p>

        {!lien && (
          <p className="authswitch">
            <button type="button" onClick={() => go('lien')}>
              Pas encore de mot de passe ? Recevoir un lien
            </button>
          </p>
        )}
        {lien && (
          <p className="authswitch">
            <button type="button" onClick={() => go('connexion')}>
              Revenir au mot de passe
            </button>
          </p>
        )}
      </form>
      <InstallHint />
    </div>
  );
}
