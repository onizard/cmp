import { useState } from 'react';
import Header from './Header.jsx';
import InstallHint from './InstallHint.jsx';

// Trois écrans, un seul à la fois : se connecter, créer un compte, ou se
// faire renvoyer un lien quand le mot de passe est perdu.
export default function Auth({ account }) {
  const [mode, setMode] = useState('connexion');
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
      await account.signUp(email, password);
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
          <p className="lede">Regarde tes mails.</p>
          <p className="soft-text">
            On t'a envoyé un lien à <strong>{email}</strong>. Ouvre-le pour
            entrer, puis choisis un nouveau mot de passe dans « Mon compte ».
          </p>
          <button className="btn btn-block" type="button" onClick={() => go('connexion')}>
            Revenir
          </button>
        </div>
        <InstallHint />
      </div>
    );
  }

  return (
    <div className="screen">
      <Header />
      <form className="panel" onSubmit={submit}>
        <p className="lede">
          {creation ? 'Créer ton compte.' : oubli ? 'Mot de passe oublié.' : 'Se connecter.'}
        </p>
        <p className="soft-text">
          {creation
            ? 'Deux champs, et tu entres. Aucun mail à aller chercher.'
            : oubli
              ? 'On t’envoie un lien pour rentrer et en choisir un nouveau.'
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

        {!oubli && (
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
              : oubli
                ? 'Recevoir le lien'
                : 'Se connecter'}
        </button>

        <p className="authlinks">
          {mode === 'connexion' ? (
            <>
              <button type="button" onClick={() => go('oubli')}>
                Mot de passe oublié ?
              </button>
              <span aria-hidden="true"> · </span>
              <button type="button" onClick={() => go('creation')}>
                Créer un compte
              </button>
            </>
          ) : (
            <button type="button" onClick={() => go('connexion')}>
              Revenir à la connexion
            </button>
          )}
        </p>
      </form>
      <InstallHint />
    </div>
  );
}
