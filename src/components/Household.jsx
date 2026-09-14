import { useState } from 'react';

export default function Household({ account }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = account.household.id;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="foyer">
      <button
        className="link"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Foyer
      </button>
      {open && (
        <div className="foyer-body">
          <p className="soft-text">
            Pour que l'autre personne rejoigne cette maison, transmets-lui ce
            code d'invitation. Elle le colle une seule fois à l'ouverture.
          </p>
          <code className="invite-code">{code}</code>
          <div className="foyer-actions">
            <button className="btn btn-small" type="button" onClick={copy}>
              {copied ? 'Copié' : 'Copier le code'}
            </button>
            <button
              className="btn btn-small"
              type="button"
              onClick={account.signOut}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
