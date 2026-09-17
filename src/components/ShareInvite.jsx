import { useEffect, useState } from 'react';
import {
  lienDInvitation,
  messageDInvitation,
  messageDecouverte,
} from '../lib/invite.js';

export default function ShareInvite({ code, prenom }) {
  const [qr, setQr] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(null);

  const origine = typeof window !== 'undefined' ? window.location.origin : '';
  const lienFoyer = lienDInvitation(origine, code);
  const lienNu = origine ? `${origine.replace(/\/+$/, '')}/` : null;

  // Le générateur de QR pèse une douzaine de kilo-octets : on ne le charge
  // qu'au moment où quelqu'un demande à voir le code.
  useEffect(() => {
    if (!ouvert || !lienFoyer || qr) return undefined;
    let vivant = true;
    import('qrcode')
      .then((m) =>
        m.default.toString(lienFoyer, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#17284C', light: '#FFFFFF' },
        }),
      )
      .then((svg) => vivant && setQr(svg))
      .catch(() => vivant && setQr(''));
    return () => {
      vivant = false;
    };
  }, [ouvert, lienFoyer, qr]);

  // Un seul bouton : la feuille du téléphone mène déjà à WhatsApp, aux SMS,
  // au mail, au presse-papier. Là où elle n'existe pas, on copie.
  const partager = async (quoi, texte, url) => {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Charge mentale partagée', text: texte, url });
      } catch {
        /* partage annulé */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${texte}\n${url}`);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 1900);
    } catch {
      setCopie(null);
    }
  };

  return (
    <>
      <button
        className="btn btn-accent btn-block"
        type="button"
        disabled={!lienFoyer}
        onClick={() =>
          partager('foyer', messageDInvitation(prenom), lienFoyer)
        }
      >
        {copie === 'foyer' ? 'Lien copié ✓' : 'Inviter ma moitié'}
      </button>

      <button
        className="btn btn-block"
        type="button"
        onClick={() => partager('appli', messageDecouverte(), lienNu)}
      >
        {copie === 'appli' ? 'Lien copié ✓' : 'Partager l’application'}
      </button>

      {lienFoyer && (
        <p className="qr-lien">
          <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
            {ouvert ? 'Masquer le QR d’invitation' : 'Afficher le QR d’invitation'}
          </button>
        </p>
      )}

      {ouvert && (
        <div className="qr-foyer">
          {qr ? (
            <div
              className="qr-image"
              role="img"
              aria-label="QR code d’invitation"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : (
            <p className="setnote">Un instant…</p>
          )}
        </div>
      )}

      <p className="code-repli">
        Code du foyer : <span>{code}</span>
      </p>
    </>
  );
}
