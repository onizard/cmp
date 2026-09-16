import { useState } from 'react';

export default function Account({ account }) {
  const [name, setName] = useState(account.displayName || '');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const email = account.session?.user?.email || '';
  const code = account.household?.id || '';

  const saveName = async () => {
    await account.updateDisplayName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="account">
      <p className="brain-lede">Mon compte</p>

      <section className="setgroup">
        <h2 className="setlabel">Profil</h2>
        <div className="setcard">
          <label className="field-label" htmlFor="prenom">
            Prénom
          </label>
          <input
            id="prenom"
            className="field"
            value={name}
            placeholder="Ton prénom"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
          />
          <label className="field-label" htmlFor="mail">
            Email
          </label>
          <input id="mail" className="field" value={email} disabled />
          {saved && <p className="soft-text" style={{ margin: 0 }}>Prénom enregistré.</p>}
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">Le foyer</h2>
        <div className="setcard">
          <p className="setnote">
            Transmets ce code à ta moitié pour qu'elle rejoigne le même foyer.
            Elle le colle une seule fois à l'ouverture de l'appli.
          </p>
          <div className="codebox">{code}</div>
          <button className="btn btn-accent" type="button" onClick={copy}>
            {copied ? 'Copié ✓' : "Copier le code d'invitation"}
          </button>
        </div>
      </section>

      <button className="btn btn-block" type="button" onClick={account.signOut}>
        Se déconnecter
      </button>

      <p className="miniquit">
        {confirmLeave ? (
          <>
            Quitter vraiment le foyer ?{' '}
            <button type="button" onClick={account.leaveHousehold}>
              oui, quitter
            </button>{' '}
            ·{' '}
            <button type="button" onClick={() => setConfirmLeave(false)}>
              annuler
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)}>
            Quitter le foyer
          </button>
        )}
      </p>

      <p className="ver">charge mentale partagée · v1.0</p>
    </main>
  );
}
