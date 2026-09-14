import { useState } from 'react';
import Header from './Header.jsx';

export default function Auth({ account }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await account.signInWithEmail(email);
    setBusy(false);
    if (ok) setSent(true);
  };

  return (
    <div className="screen">
      <Header />
      {sent ? (
        <div className="panel">
          <p className="lede">Regarde tes mails.</p>
          <p className="soft-text">
            On t'a envoyé un lien de connexion à <strong>{email}</strong>.
            Ouvre-le sur ce téléphone pour entrer.
          </p>
        </div>
      ) : (
        <form className="panel" onSubmit={submit}>
          <p className="lede">Se connecter par e-mail.</p>
          <p className="soft-text">
            Pas de mot de passe : tu reçois un lien à ouvrir.
          </p>
          <label className="field-label" htmlFor="email">
            Ton adresse e-mail
          </label>
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
          {account.error && <p className="error">{account.error}</p>}
          <button className="btn btn-accent" type="submit" disabled={busy}>
            {busy ? 'Envoi…' : 'Recevoir le lien'}
          </button>
        </form>
      )}
    </div>
  );
}
