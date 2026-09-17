import { useState } from 'react';
import Header from './Header.jsx';

export default function Onboarding({ account }) {
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
        <p className="lede">Rejoindre le foyer.</p>
        <p className="soft-text">
          {account.invitation
            ? 'Ton invitation est reconnue. Il ne reste qu’à confirmer.'
            : "Si l'autre personne t'a envoyé un code d'invitation, colle-le ici."}
        </p>
        <form onSubmit={join}>
          <label className="field-label" htmlFor="code">
            Code d'invitation
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
            placeholder="colle le code ici"
          />
          {account.error && <p className="error">{account.error}</p>}
          <button className="btn btn-accent" type="submit" disabled={busy}>
            {busy ? 'Un instant…' : 'Rejoindre'}
          </button>
        </form>
      </div>

      <div className="panel">
        <p className="soft-text">
          Tu installes la maison pour la première fois ?
        </p>
        <button className="btn" type="button" onClick={create} disabled={busy}>
          Créer un nouveau foyer
        </button>
      </div>

      <p className="signout-line">
        <button className="link" type="button" onClick={account.signOut}>
          Se déconnecter
        </button>
      </p>
    </div>
  );
}
